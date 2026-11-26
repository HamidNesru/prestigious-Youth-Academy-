import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db, seedIfEmpty } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  console.error("JWT_SECRET must be set in production");
  process.exit(1);
}
if (process.env.SEED_DEMO !== "false") seedIfEmpty();

type Role = "admin" | "teacher" | "parent";
interface Auth { id: number; schoolId: number; role: Role; name: string }
type AuthedReq = Request & { auth: Auth };

const app = express();
app.use(cors());
app.use(express.json());

const wrap = (fn: (req: AuthedReq, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    try { fn(req as AuthedReq, res); } catch (e) { next(e); }
  };

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ error: "Not signed in" });
  try {
    (req as AuthedReq).auth = jwt.verify(h.slice(7), JWT_SECRET) as Auth;
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}
const roles = (...allowed: Role[]) => (req: Request, res: Response, next: NextFunction) =>
  allowed.includes((req as AuthedReq).auth.role) ? next() : res.status(403).json({ error: "Not allowed" });

// ---------- access helpers (all queries are scoped to the user's school) ----------
function canSeeStudent(a: Auth, studentId: number): boolean {
  const s = db.prepare("SELECT s.parent_id, c.teacher_id FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.id=? AND s.school_id=?")
    .get(studentId, a.schoolId) as { parent_id: number | null; teacher_id: number | null } | undefined;
  if (!s) return false;
  if (a.role === "admin") return true;
  if (a.role === "teacher") return s.teacher_id === a.id;
  return s.parent_id === a.id;
}
function canManageClass(a: Auth, classId: number): boolean {
  const c = db.prepare("SELECT teacher_id FROM classes WHERE id=? AND school_id=?").get(classId, a.schoolId) as { teacher_id: number | null } | undefined;
  if (!c) return false;
  return a.role === "admin" || (a.role === "teacher" && c.teacher_id === a.id);
}

// ---------- auth ----------
app.post("/api/auth/login", wrap((req, res) => {
  const { email, password } = req.body ?? {};
  const u = db.prepare("SELECT * FROM users WHERE lower(email)=lower(?)").get(String(email ?? "")) as
    { id: number; school_id: number; name: string; role: Role; password_hash: string } | undefined;
  if (!u || !bcrypt.compareSync(String(password ?? ""), u.password_hash))
    return res.status(401).json({ error: "Wrong email or password" });
  const auth: Auth = { id: u.id, schoolId: u.school_id, role: u.role, name: u.name };
  res.json({ token: jwt.sign(auth, JWT_SECRET, { expiresIn: "12h" }), user: auth });
}));

app.use("/api", requireAuth);

app.get("/api/me", wrap((req, res) => {
  const school = db.prepare("SELECT id,name,city,plan FROM schools WHERE id=?").get(req.auth.schoolId);
  res.json({ user: req.auth, school });
}));

// ---------- dashboard ----------
app.get("/api/dashboard", wrap((req, res) => {
  const a = req.auth;
  const sid = a.schoolId;
  if (a.role === "parent") {
    const kids = db.prepare("SELECT s.id, s.full_name, c.name cls, c.section FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.parent_id=? AND s.school_id=?").all(a.id, sid) as { id: number }[];
    const out = kids.map((k) => ({
      ...k,
      balance: (db.prepare("SELECT COALESCE(SUM(i.amount),0) - COALESCE((SELECT SUM(p.amount) FROM payments p JOIN invoices i2 ON i2.id=p.invoice_id WHERE i2.student_id=?),0) b FROM invoices i WHERE i.student_id=?").get(k.id, k.id) as { b: number }).b,
      absences: (db.prepare("SELECT COUNT(*) c FROM attendance WHERE student_id=? AND status='absent'").get(k.id) as { c: number }).c,
    }));
    const unread = (db.prepare("SELECT COUNT(*) c FROM messages WHERE to_user=? AND read=0").get(a.id) as { c: number }).c;
    return res.json({ children: out, unread });
  }
  const classFilter = a.role === "teacher" ? "AND c.teacher_id=" + Number(a.id) : "";
  const students = (db.prepare(`SELECT COUNT(*) c FROM students s LEFT JOIN classes c ON c.id=s.class_id WHERE s.school_id=? ${classFilter}`).get(sid) as { c: number }).c;
  const classes = (db.prepare(`SELECT COUNT(*) c FROM classes c WHERE c.school_id=? ${a.role === "teacher" ? "AND c.teacher_id=" + Number(a.id) : ""}`).get(sid) as { c: number }).c;
  const today = new Date().toISOString().slice(0, 10);
  const att = db.prepare(`SELECT a.status, COUNT(*) c FROM attendance a JOIN students s ON s.id=a.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE s.school_id=? AND a.date=? ${classFilter} GROUP BY a.status`).all(sid, today) as { status: string; c: number }[];
  const unread = (db.prepare("SELECT COUNT(*) c FROM messages WHERE to_user=? AND read=0").get(a.id) as { c: number }).c;
  const result: Record<string, unknown> = { students, classes, attendanceToday: att, unread };
  if (a.role === "admin") {
    const billed = (db.prepare("SELECT COALESCE(SUM(amount),0) t FROM invoices WHERE school_id=?").get(sid) as { t: number }).t;
    const paid = (db.prepare("SELECT COALESCE(SUM(p.amount),0) t FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.school_id=?").get(sid) as { t: number }).t;
    result.fees = { billed, paid, outstanding: billed - paid };
    result.teachers = (db.prepare("SELECT COUNT(*) c FROM users WHERE school_id=? AND role='teacher'").get(sid) as { c: number }).c;
  }
  res.json(result);
}));

// ---------- users (admin) ----------
app.get("/api/users", roles("admin", "teacher"), wrap((req, res) => {
  const role = req.query.role as string | undefined;
  const rows = role
    ? db.prepare("SELECT id,name,email,phone,role FROM users WHERE school_id=? AND role=? ORDER BY name").all(req.auth.schoolId, role)
    : db.prepare("SELECT id,name,email,phone,role FROM users WHERE school_id=? ORDER BY role,name").all(req.auth.schoolId);
  res.json(req.auth.role === "teacher" ? (rows as { role: string }[]).filter((r) => r.role === "parent" || r.role === "admin") : rows);
}));
app.post("/api/users", roles("admin"), wrap((req, res) => {
  const { name, email, phone, password, role } = req.body ?? {};
  if (!name || !email || !password || !["teacher", "parent", "admin"].includes(role)) return res.status(400).json({ error: "Missing fields" });
  if (String(password).length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  try {
    const r = db.prepare("INSERT INTO users(school_id,name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)")
      .run(req.auth.schoolId, name, email, phone ?? null, bcrypt.hashSync(String(password), 10), role);
    res.status(201).json({ id: r.lastInsertRowid });
  } catch {
    res.status(409).json({ error: "Email already in use" });
  }
}));

// ---------- classes & subjects ----------
app.get("/api/classes", wrap((req, res) => {
  const a = req.auth;
  const base = `SELECT c.id,c.name,c.section,c.teacher_id,u.name teacher_name,
    (SELECT COUNT(*) FROM students s WHERE s.class_id=c.id) student_count
    FROM classes c LEFT JOIN users u ON u.id=c.teacher_id WHERE c.school_id=?`;
  if (a.role === "teacher") return res.json(db.prepare(base + " AND c.teacher_id=? ORDER BY c.name").all(a.schoolId, a.id));
  if (a.role === "parent") return res.json(db.prepare(base + " AND c.id IN (SELECT class_id FROM students WHERE parent_id=?) ORDER BY c.name").all(a.schoolId, a.id));
  res.json(db.prepare(base + " ORDER BY c.name").all(a.schoolId));
}));
app.post("/api/classes", roles("admin"), wrap((req, res) => {
  const { name, section, teacher_id } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "Name required" });
  if (teacher_id && !db.prepare("SELECT 1 FROM users WHERE id=? AND school_id=? AND role='teacher'").get(teacher_id, req.auth.schoolId))
    return res.status(400).json({ error: "Unknown teacher" });
  const r = db.prepare("INSERT INTO classes(school_id,name,section,teacher_id) VALUES (?,?,?,?)").run(req.auth.schoolId, name, section || "A", teacher_id ?? null);
  res.status(201).json({ id: r.lastInsertRowid });
}));
app.get("/api/subjects", wrap((req, res) => {
  res.json(db.prepare("SELECT id,name,name_am FROM subjects WHERE school_id=? ORDER BY id").all(req.auth.schoolId));
}));
app.post("/api/subjects", roles("admin"), wrap((req, res) => {
  const { name, name_am } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "Name required" });
  const r = db.prepare("INSERT INTO subjects(school_id,name,name_am) VALUES (?,?,?)").run(req.auth.schoolId, name, name_am ?? null);
  res.status(201).json({ id: r.lastInsertRowid });
}));

// ---------- students ----------
app.get("/api/students", wrap((req, res) => {
  const a = req.auth;
  const classId = req.query.classId ? Number(req.query.classId) : null;
  let sql = `SELECT s.id,s.student_code,s.full_name,s.gender,s.birth_date,s.class_id,s.parent_id,
    c.name class_name,c.section,p.name parent_name,p.phone parent_phone
    FROM students s LEFT JOIN classes c ON c.id=s.class_id LEFT JOIN users p ON p.id=s.parent_id WHERE s.school_id=?`;
  const args: unknown[] = [a.schoolId];
  if (a.role === "teacher") { sql += " AND c.teacher_id=?"; args.push(a.id); }
  if (a.role === "parent") { sql += " AND s.parent_id=?"; args.push(a.id); }
  if (classId) { sql += " AND s.class_id=?"; args.push(classId); }
  res.json(db.prepare(sql + " ORDER BY c.name, s.full_name").all(...args));
}));
app.post("/api/students", roles("admin"), wrap((req, res) => {
  const { full_name, gender, birth_date, class_id, parent_id } = req.body ?? {};
  if (!full_name) return res.status(400).json({ error: "Name required" });
  if (class_id && !db.prepare("SELECT 1 FROM classes WHERE id=? AND school_id=?").get(class_id, req.auth.schoolId)) return res.status(400).json({ error: "Unknown class" });
  if (parent_id && !db.prepare("SELECT 1 FROM users WHERE id=? AND school_id=? AND role='parent'").get(parent_id, req.auth.schoolId)) return res.status(400).json({ error: "Unknown parent" });
  const n = (db.prepare("SELECT COUNT(*) c FROM students WHERE school_id=?").get(req.auth.schoolId) as { c: number }).c + 1;
  const code = `S-${String(n).padStart(4, "0")}`;
  const r = db.prepare("INSERT INTO students(school_id,class_id,parent_id,student_code,full_name,gender,birth_date) VALUES (?,?,?,?,?,?,?)")
    .run(req.auth.schoolId, class_id ?? null, parent_id ?? null, code, full_name, gender ?? null, birth_date ?? null);
  res.status(201).json({ id: r.lastInsertRowid, student_code: code });
}));
app.put("/api/students/:id", roles("admin"), wrap((req, res) => {
  const id = Number(req.params.id);
  const { full_name, gender, birth_date, class_id, parent_id } = req.body ?? {};
  const r = db.prepare("UPDATE students SET full_name=COALESCE(?,full_name),gender=COALESCE(?,gender),birth_date=COALESCE(?,birth_date),class_id=?,parent_id=? WHERE id=? AND school_id=?")
    .run(full_name ?? null, gender ?? null, birth_date ?? null, class_id ?? null, parent_id ?? null, id, req.auth.schoolId);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: "Not found" });
}));
app.delete("/api/students/:id", roles("admin"), wrap((req, res) => {
  const r = db.prepare("DELETE FROM students WHERE id=? AND school_id=?").run(Number(req.params.id), req.auth.schoolId);
  r.changes ? res.json({ ok: true }) : res.status(404).json({ error: "Not found" });
}));

// ---------- attendance ----------
app.get("/api/attendance", roles("admin", "teacher"), wrap((req, res) => {
  const classId = Number(req.query.classId);
  const date = String(req.query.date ?? "");
  if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: "classId and date required" });
  if (!canManageClass(req.auth, classId)) return res.status(403).json({ error: "Not allowed" });
  res.json(db.prepare(`SELECT s.id student_id, s.full_name, s.student_code, a.status
    FROM students s LEFT JOIN attendance a ON a.student_id=s.id AND a.date=?
    WHERE s.class_id=? AND s.school_id=? ORDER BY s.full_name`).all(date, classId, req.auth.schoolId));
}));
app.post("/api/attendance", roles("admin", "teacher"), wrap((req, res) => {
  const { classId, date, records } = req.body ?? {};
  if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !Array.isArray(records)) return res.status(400).json({ error: "Invalid payload" });
  if (!canManageClass(req.auth, Number(classId))) return res.status(403).json({ error: "Not allowed" });
  const valid = new Set((db.prepare("SELECT id FROM students WHERE class_id=? AND school_id=?").all(classId, req.auth.schoolId) as { id: number }[]).map((s) => s.id));
  const up = db.prepare("INSERT INTO attendance(student_id,date,status) VALUES (?,?,?) ON CONFLICT(student_id,date) DO UPDATE SET status=excluded.status");
  const tx = db.transaction(() => {
    for (const r of records as { student_id: number; status: string }[]) {
      if (!valid.has(r.student_id) || !["present", "absent", "late", "excused"].includes(r.status)) continue;
      up.run(r.student_id, date, r.status);
    }
  });
  tx();
  res.json({ ok: true });
}));
app.get("/api/attendance/student/:id", wrap((req, res) => {
  const id = Number(req.params.id);
  if (!canSeeStudent(req.auth, id)) return res.status(403).json({ error: "Not allowed" });
  const rows = db.prepare("SELECT date,status FROM attendance WHERE student_id=? ORDER BY date DESC LIMIT 60").all(id);
  const summary = db.prepare("SELECT status, COUNT(*) c FROM attendance WHERE student_id=? GROUP BY status").all(id);
  res.json({ rows, summary });
}));

// ---------- grades & report card ----------
app.get("/api/grades", roles("admin", "teacher"), wrap((req, res) => {
  const classId = Number(req.query.classId), subjectId = Number(req.query.subjectId), term = Number(req.query.term);
  if (!classId || !subjectId || !term) return res.status(400).json({ error: "classId, subjectId, term required" });
  if (!canManageClass(req.auth, classId)) return res.status(403).json({ error: "Not allowed" });
  res.json(db.prepare(`SELECT s.id student_id, s.full_name, s.student_code, g.score
    FROM students s LEFT JOIN grades g ON g.student_id=s.id AND g.subject_id=? AND g.term=?
    WHERE s.class_id=? AND s.school_id=? ORDER BY s.full_name`).all(subjectId, term, classId, req.auth.schoolId));
}));
app.post("/api/grades", roles("admin", "teacher"), wrap((req, res) => {
  const { classId, subjectId, term, records } = req.body ?? {};
  if (!classId || !subjectId || !term || !Array.isArray(records)) return res.status(400).json({ error: "Invalid payload" });
  if (!canManageClass(req.auth, Number(classId))) return res.status(403).json({ error: "Not allowed" });
  if (!db.prepare("SELECT 1 FROM subjects WHERE id=? AND school_id=?").get(subjectId, req.auth.schoolId)) return res.status(400).json({ error: "Unknown subject" });
  const valid = new Set((db.prepare("SELECT id FROM students WHERE class_id=? AND school_id=?").all(classId, req.auth.schoolId) as { id: number }[]).map((s) => s.id));
  const up = db.prepare("INSERT INTO grades(student_id,subject_id,term,score) VALUES (?,?,?,?) ON CONFLICT(student_id,subject_id,term) DO UPDATE SET score=excluded.score");
  const del = db.prepare("DELETE FROM grades WHERE student_id=? AND subject_id=? AND term=?");
  db.transaction(() => {
    for (const r of records as { student_id: number; score: number | null }[]) {
      if (!valid.has(r.student_id)) continue;
      if (r.score === null || r.score === undefined || (r.score as unknown) === "") { del.run(r.student_id, subjectId, term); continue; }
      const sc = Number(r.score);
      if (!Number.isFinite(sc) || sc < 0 || sc > 100) continue;
      up.run(r.student_id, subjectId, term, sc);
    }
  })();
  res.json({ ok: true });
}));
app.get("/api/report-card/:studentId", wrap((req, res) => {
  const id = Number(req.params.studentId);
  const term = Number(req.query.term || 1);
  if (!canSeeStudent(req.auth, id)) return res.status(403).json({ error: "Not allowed" });
  const student = db.prepare(`SELECT s.id,s.full_name,s.student_code,s.class_id,c.name class_name,c.section,sc.name school_name,sc.city
    FROM students s LEFT JOIN classes c ON c.id=s.class_id JOIN schools sc ON sc.id=s.school_id WHERE s.id=?`).get(id) as { class_id: number | null };
  const subjects = db.prepare(`SELECT sub.id,sub.name,sub.name_am,g.score FROM subjects sub
    LEFT JOIN grades g ON g.subject_id=sub.id AND g.student_id=? AND g.term=? WHERE sub.school_id=? ORDER BY sub.id`).all(id, term, req.auth.schoolId) as { score: number | null }[];
  const scored = subjects.filter((s) => s.score !== null) as { score: number }[];
  const total = scored.reduce((a, b) => a + b.score, 0);
  const average = scored.length ? total / scored.length : null;
  let rank: number | null = null, classSize = 0;
  if (student.class_id) {
    const avgs = db.prepare(`SELECT s.id, AVG(g.score) av FROM students s JOIN grades g ON g.student_id=s.id AND g.term=? WHERE s.class_id=? GROUP BY s.id ORDER BY av DESC`).all(term, student.class_id) as { id: number; av: number }[];
    classSize = avgs.length;
    const idx = avgs.findIndex((x) => x.id === id);
    rank = idx >= 0 ? idx + 1 : null;
  }
  const att = db.prepare("SELECT status, COUNT(*) c FROM attendance WHERE student_id=? GROUP BY status").all(id);
  res.json({ student, term, subjects, total, average, rank, classSize, attendance: att });
}));

// ---------- fees ----------
app.get("/api/invoices", wrap((req, res) => {
  const a = req.auth;
  let sql = `SELECT i.id,i.title,i.amount,i.due_date,i.student_id,s.full_name,s.student_code,c.name class_name,
    COALESCE((SELECT SUM(amount) FROM payments p WHERE p.invoice_id=i.id),0) paid
    FROM invoices i JOIN students s ON s.id=i.student_id LEFT JOIN classes c ON c.id=s.class_id WHERE i.school_id=?`;
  const args: unknown[] = [a.schoolId];
  if (a.role === "teacher") return res.status(403).json({ error: "Not allowed" });
  if (a.role === "parent") { sql += " AND s.parent_id=?"; args.push(a.id); }
  res.json(db.prepare(sql + " ORDER BY i.id DESC").all(...args));
}));
app.post("/api/invoices", roles("admin"), wrap((req, res) => {
  const { title, amount, due_date, student_id, class_id } = req.body ?? {};
  const amt = Number(amount);
  if (!title || !Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "Title and positive amount required" });
  let ids: number[] = [];
  if (student_id) ids = (db.prepare("SELECT id FROM students WHERE id=? AND school_id=?").all(student_id, req.auth.schoolId) as { id: number }[]).map((s) => s.id);
  else if (class_id) ids = (db.prepare("SELECT id FROM students WHERE class_id=? AND school_id=?").all(class_id, req.auth.schoolId) as { id: number }[]).map((s) => s.id);
  else ids = (db.prepare("SELECT id FROM students WHERE school_id=?").all(req.auth.schoolId) as { id: number }[]).map((s) => s.id);
  const ins = db.prepare("INSERT INTO invoices(school_id,student_id,title,amount,due_date) VALUES (?,?,?,?,?)");
  db.transaction(() => ids.forEach((id) => ins.run(req.auth.schoolId, id, title, amt, due_date ?? null)))();
  res.status(201).json({ created: ids.length });
}));
app.post("/api/payments", roles("admin"), wrap((req, res) => {
  const { invoice_id, amount, method, reference, paid_on } = req.body ?? {};
  const inv = db.prepare("SELECT i.amount, COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id=i.id),0) paid FROM invoices i WHERE i.id=? AND i.school_id=?")
    .get(invoice_id, req.auth.schoolId) as { amount: number; paid: number } | undefined;
  if (!inv) return res.status(404).json({ error: "Invoice not found" });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "Positive amount required" });
  if (amt > inv.amount - inv.paid + 0.0001) return res.status(400).json({ error: "Payment is more than the balance" });
  const r = db.prepare("INSERT INTO payments(invoice_id,amount,paid_on,method,reference) VALUES (?,?,?,?,?)")
    .run(invoice_id, amt, paid_on || new Date().toISOString().slice(0, 10), method ?? "Cash", reference ?? null);
  res.status(201).json({ id: r.lastInsertRowid });
}));
app.get("/api/payments/:invoiceId", wrap((req, res) => {
  const inv = db.prepare("SELECT i.id, s.parent_id FROM invoices i JOIN students s ON s.id=i.student_id WHERE i.id=? AND i.school_id=?").get(Number(req.params.invoiceId), req.auth.schoolId) as { parent_id: number | null } | undefined;
  if (!inv) return res.status(404).json({ error: "Not found" });
  if (req.auth.role === "teacher" || (req.auth.role === "parent" && inv.parent_id !== req.auth.id)) return res.status(403).json({ error: "Not allowed" });
  res.json(db.prepare("SELECT id,amount,paid_on,method,reference FROM payments WHERE invoice_id=? ORDER BY id").all(Number(req.params.invoiceId)));
}));

// ---------- messages (parent <-> teacher/admin) ----------
app.get("/api/messages", wrap((req, res) => {
  const a = req.auth;
  const rows = db.prepare(`SELECT m.id,m.body,m.created_at,m.read,m.from_user,m.to_user,m.student_id,
    f.name from_name,f.role from_role,t.name to_name,s.full_name student_name
    FROM messages m JOIN users f ON f.id=m.from_user JOIN users t ON t.id=m.to_user LEFT JOIN students s ON s.id=m.student_id
    WHERE m.school_id=? AND (m.from_user=? OR m.to_user=?) ORDER BY m.id DESC LIMIT 200`).all(a.schoolId, a.id, a.id);
  res.json(rows);
}));
app.post("/api/messages", wrap((req, res) => {
  const a = req.auth;
  const { to_user, body, student_id } = req.body ?? {};
  if (!to_user || !String(body ?? "").trim()) return res.status(400).json({ error: "Recipient and message required" });
  const target = db.prepare("SELECT id,role FROM users WHERE id=? AND school_id=?").get(to_user, a.schoolId) as { id: number; role: Role } | undefined;
  if (!target) return res.status(400).json({ error: "Unknown recipient" });
  if (a.role === "parent" && target.role === "parent") return res.status(403).json({ error: "Parents can only message staff" });
  if (a.role === "teacher" && target.role === "teacher") return res.status(403).json({ error: "Message a parent or the admin" });
  if (student_id && !canSeeStudent(a, Number(student_id)) && a.role !== "admin") return res.status(403).json({ error: "Not allowed" });
  const r = db.prepare("INSERT INTO messages(school_id,from_user,to_user,student_id,body) VALUES (?,?,?,?,?)")
    .run(a.schoolId, a.id, to_user, student_id ?? null, String(body).trim().slice(0, 2000));
  res.status(201).json({ id: r.lastInsertRowid });
}));
app.post("/api/messages/:id/read", wrap((req, res) => {
  db.prepare("UPDATE messages SET read=1 WHERE id=? AND to_user=?").run(Number(req.params.id), req.auth.id);
  res.json({ ok: true });
}));
// who can the current user message?
app.get("/api/contacts", wrap((req, res) => {
  const a = req.auth;
  if (a.role === "parent") {
    return res.json(db.prepare(`SELECT DISTINCT u.id,u.name,u.role FROM users u WHERE u.school_id=? AND (u.role='admin' OR u.id IN
      (SELECT c.teacher_id FROM students s JOIN classes c ON c.id=s.class_id WHERE s.parent_id=?)) ORDER BY u.role,u.name`).all(a.schoolId, a.id));
  }
  if (a.role === "teacher") {
    return res.json(db.prepare(`SELECT DISTINCT u.id,u.name,u.role FROM users u WHERE u.school_id=? AND (u.role='admin' OR u.id IN
      (SELECT s.parent_id FROM students s JOIN classes c ON c.id=s.class_id WHERE c.teacher_id=?)) ORDER BY u.role,u.name`).all(a.schoolId, a.id));
  }
  res.json(db.prepare("SELECT id,name,role FROM users WHERE school_id=? AND id<>? ORDER BY role,name").all(a.schoolId, a.id));
}));

// ---------- serve built client in production ----------
const clientDist = path.join(__dirname, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => console.log(`School API running on http://localhost:${PORT}`));
