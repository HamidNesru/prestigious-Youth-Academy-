import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const db = new Database(process.env.DB_FILE || path.join(__dirname, "..", "school.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT,
  plan TEXT DEFAULT 'trial'
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','parent'))
);
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  section TEXT NOT NULL DEFAULT 'A',
  teacher_id INTEGER REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  class_id INTEGER REFERENCES classes(id),
  parent_id INTEGER REFERENCES users(id),
  student_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  birth_date TEXT
);
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  name_am TEXT
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','excused')),
  UNIQUE(student_id, date)
);
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  term INTEGER NOT NULL,
  score REAL NOT NULL,
  UNIQUE(student_id, subject_id, term)
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  paid_on TEXT NOT NULL,
  method TEXT,
  reference TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  from_user INTEGER NOT NULL REFERENCES users(id),
  to_user INTEGER NOT NULL REFERENCES users(id),
  student_id INTEGER REFERENCES students(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read INTEGER NOT NULL DEFAULT 0
);
`);

export function seedIfEmpty() {
  const count = (db.prepare("SELECT COUNT(*) c FROM schools").get() as { c: number }).c;
  if (count > 0) return;
  const hash = (p: string) => bcrypt.hashSync(p, 10);
  const school = db.prepare("INSERT INTO schools(name,city) VALUES (?,?)").run("Demo Hope Academy", "Addis Ababa").lastInsertRowid as number;

  const addUser = db.prepare("INSERT INTO users(school_id,name,email,phone,password_hash,role) VALUES (?,?,?,?,?,?)");
  addUser.run(school, "School Admin", "admin@demo.school", "0911000000", hash("admin123"), "admin");
  const t1 = addUser.run(school, "Ato Bekele Tadesse", "teacher@demo.school", "0911000001", hash("teacher123"), "teacher").lastInsertRowid as number;
  const t2 = addUser.run(school, "W/ro Selamawit Haile", "selam@demo.school", "0911000002", hash("teacher123"), "teacher").lastInsertRowid as number;
  const p1 = addUser.run(school, "Ato Girma Alemu", "parent@demo.school", "0922000001", hash("parent123"), "parent").lastInsertRowid as number;
  const p2 = addUser.run(school, "W/ro Tigist Mengistu", "tigist@demo.school", "0922000002", hash("parent123"), "parent").lastInsertRowid as number;

  const addClass = db.prepare("INSERT INTO classes(school_id,name,section,teacher_id) VALUES (?,?,?,?)");
  const c1 = addClass.run(school, "Grade 5", "A", t1).lastInsertRowid as number;
  const c2 = addClass.run(school, "Grade 6", "A", t2).lastInsertRowid as number;

  const addSubject = db.prepare("INSERT INTO subjects(school_id,name,name_am) VALUES (?,?,?)");
  const subs = [
    ["Mathematics", "ሒሳብ"], ["English", "እንግሊዝኛ"], ["Amharic", "አማርኛ"],
    ["Environmental Science", "አካባቢ ሳይንስ"], ["Civics", "ሥነ ዜጋ"],
  ].map(([n, a]) => addSubject.run(school, n, a).lastInsertRowid as number);

  const addStudent = db.prepare("INSERT INTO students(school_id,class_id,parent_id,student_code,full_name,gender,birth_date) VALUES (?,?,?,?,?,?,?)");
  const roster: [number, number | null, string, string, string][] = [
    [c1, p1, "S-0001", "Abel Girma", "M"], [c1, p2, "S-0002", "Hana Tigist", "F"],
    [c1, null, "S-0003", "Dawit Kebede", "M"], [c1, null, "S-0004", "Meron Solomon", "F"],
    [c1, null, "S-0005", "Yonas Tesfaye", "M"], [c2, p1, "S-0006", "Liya Girma", "F"],
    [c2, null, "S-0007", "Samuel Assefa", "M"], [c2, null, "S-0008", "Bethel Mulugeta", "F"],
  ];
  const studentIds = roster.map(([c, p, code, name, g]) =>
    addStudent.run(school, c, p, code, name, g, "2015-01-01").lastInsertRowid as number);

  const addGrade = db.prepare("INSERT INTO grades(student_id,subject_id,term,score) VALUES (?,?,?,?)");
  studentIds.forEach((sid, i) => subs.forEach((sub, j) => addGrade.run(sid, sub, 1, 55 + ((i * 7 + j * 11) % 44))));

  const addInv = db.prepare("INSERT INTO invoices(school_id,student_id,title,amount,due_date) VALUES (?,?,?,?,?)");
  const addPay = db.prepare("INSERT INTO payments(invoice_id,amount,paid_on,method,reference) VALUES (?,?,?,?,?)");
  studentIds.forEach((sid, i) => {
    const inv = addInv.run(school, sid, "Tuition - Semester 1", 4500, "2026-12-01").lastInsertRowid as number;
    if (i % 3 === 0) addPay.run(inv, 4500, "2026-11-05", "Cash", `RCPT-${1000 + i}`);
    else if (i % 3 === 1) addPay.run(inv, 2000, "2026-11-10", "Telebirr", `TB-${2000 + i}`);
  });

  const today = new Date();
  const addAtt = db.prepare("INSERT OR IGNORE INTO attendance(student_id,date,status) VALUES (?,?,?)");
  for (let d = 1; d <= 5; d++) {
    const dt = new Date(today); dt.setDate(today.getDate() - d);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    const iso = dt.toISOString().slice(0, 10);
    studentIds.forEach((sid, i) => addAtt.run(sid, iso, (i + d) % 6 === 0 ? "absent" : (i + d) % 7 === 0 ? "late" : "present"));
  }

  db.prepare("INSERT INTO messages(school_id,from_user,to_user,student_id,body) VALUES (?,?,?,?,?)")
    .run(school, t1, p1, studentIds[0], "Hello! Abel did very well in Mathematics this semester. Please encourage him to keep reading at home.");
}
