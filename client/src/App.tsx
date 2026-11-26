import React, { useState, useEffect } from "react";
import {
  GraduationCap,
  Users,
  FileCheck2,
  MessageSquare,
  Image as ImageIcon,
  LogOut,
  Plus,
  Sparkles,
  Send,
} from "lucide-react";
import { supabase, hasSupabase } from "./supabase";

export type UserRole = "Admin" | "Teacher" | "Parent";

interface StudentRecord {
  id: string;
  full_name: string;
  grade: number;
  section: string;
  age: number;
  ws1: number;
  test1: number;
  ws2: number;
  test2: number;
  ws3: number;
  mid_exam: number;
  ws4: number;
  final_exam: number;
}

interface ExamSubmission {
  id: string;
  teacher_name: string;
  subject: string;
  grade: number;
  exam_type: string;
  exam_content: string;
  ai_score: number;
  ai_feedback: string;
  submitted_at: string;
}

interface ChatMessage {
  id: string;
  sender_role: string;
  sender_name: string;
  student_name: string;
  body: string;
  created_at: string;
}

interface GalleryItem {
  id: string;
  title: string;
  category: string;
  image_url: string;
}

const INITIAL_STUDENTS: StudentRecord[] = [
  { id: "1", full_name: "Abebe Kebede", grade: 9, section: "A", age: 15, ws1: 4.5, test1: 9.0, ws2: 5.0, test2: 8.5, ws3: 4.5, mid_exam: 18.0, ws4: 4.5, final_exam: 36.0 },
  { id: "2", full_name: "Sara Tadesse", grade: 9, section: "A", age: 15, ws1: 5.0, test1: 9.5, ws2: 4.5, test2: 9.5, ws3: 5.0, mid_exam: 19.0, ws4: 5.0, final_exam: 38.5 },
  { id: "3", full_name: "Natnael Girma", grade: 9, section: "A", age: 16, ws1: 4.0, test1: 8.0, ws2: 4.0, test2: 7.5, ws3: 4.0, mid_exam: 16.5, ws4: 4.5, final_exam: 33.0 },
  { id: "4", full_name: "Bethlehem Alemu", grade: 9, section: "A", age: 15, ws1: 5.0, test1: 10.0, ws2: 5.0, test2: 9.0, ws3: 4.5, mid_exam: 18.5, ws4: 5.0, final_exam: 37.0 },
];

const INITIAL_EXAMS: ExamSubmission[] = [
  {
    id: "ex-1",
    teacher_name: "Mr. Dawit Hailu",
    subject: "History & Civics",
    grade: 11,
    exam_type: "Final Exam (40%)",
    exam_content:
      "1. Analyze the socio-economic impacts of the Adwa victory on African anti-colonial movements. 2. Compare federal structures...",
    ai_score: 94,
    ai_feedback:
      "Excellent cognitive balance (35% recall, 40% analytical comparison, 25% critical essay). Clear marking rubric and zero ambiguous wording.",
    submitted_at: "Today, 09:40 AM",
  },
  {
    id: "ex-2",
    teacher_name: "Ms. Hanna Mulugeta",
    subject: "Physics",
    grade: 10,
    exam_type: "Mid Exam (20%)",
    exam_content:
      "1. Define Newton's second law. 2. Calculate acceleration of a 12kg block on an inclined plane at 30 degrees...",
    ai_score: 88,
    ai_feedback:
      "Strong quantitative problem distribution. Recommendation: Specify gravitational constant (g = 9.8 m/s²) explicitly in Question 2.",
    submitted_at: "Yesterday, 03:15 PM",
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    sender_role: "Parent",
    sender_name: "Mrs. Tigist Bekele",
    student_name: "Abebe Kebede (Grade 9A)",
    body: "Selam Teacher, how is Abebe performing on his Worksheets and Test 2 ahead of the Mid Exam?",
    created_at: "10:15 AM",
  },
  {
    id: "m2",
    sender_role: "Teacher",
    sender_name: "Mr. Dawit Hailu",
    student_name: "Abebe Kebede (Grade 9A)",
    body: "Selam Mrs. Tigist! He scored 5/5 on Worksheet 2 and 8.5/10 on Test 2. His class participation is outstanding.",
    created_at: "10:28 AM",
  },
];

const INITIAL_GALLERY: GalleryItem[] = [
  { id: "g1", title: "Annual Science & Innovation Exhibition", category: "STEM & Science Fair", image_url: "https://unsplash.com" },
  { id: "g2", title: "Ethiopian Nations & Cultural Heritage Day", category: "Culture & Arts", image_url: "https://unsplash.com" },
  { id: "g3", title: "Inter-Section Academic Debate Finals", category: "Student Leadership", image_url: "https://unsplash.com" },
];

function evaluateExamQuality(
  subject: string,
  grade: number,
  content: string
): { score: number; feedback: string } {
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const hasAnalyticalVerbs =
    /(analyze|compare|evaluate|calculate|explain|derive|contrast|justify)/i.test(content);
  const hasNumberedQuestions = /(\b1\.|\b2\.|\bQ1|\bQuestion)/i.test(content);

  let score = 74;
  if (words >= 20) score += 8;
  if (words >= 50) score += 6;
  if (hasAnalyticalVerbs) score += 6;
  if (hasNumberedQuestions) score += 4;
  score = Math.min(score, 98);

  const feedback =
    score >= 88
      ? `High-standard Grade ${grade} ${subject} assessment. Strong alignment with analytical thinking, clear question numbering, and well-proportioned difficulty.`
      : `Acceptable draft for Grade ${grade} ${subject}. AI Suggestion: Include analytical action verbs (e.g., "Compare", "Analyze", "Justify") and explicit mark weights.`;

  return { score, feedback };
}

function getTotalScore(s: StudentRecord): number {
  return (
    s.ws1 +
    s.test1 +
    s.ws2 +
    s.test2 +
    s.ws3 +
    s.mid_exam +
    s.ws4 +
    s.final_exam
  );
}

export function App() {
  const [user, setUser] = useState<{ name: string; role: UserRole } | null>(null);
  const [loginName, setLoginName] = useState("Director Solomon");
  const [loginRole, setLoginRole] = useState<UserRole>("Admin");

  const [activePage, setActivePage] = useState<"students" | "exams" | "chat" | "gallery">("students");
  const [selectedGrade, setSelectedGrade] = useState<number>(9);
  const [selectedSection, setSelectedSection] = useState<string>("A");

  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [exams, setExams] = useState<ExamSubmission[]>(INITIAL_EXAMS);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [gallery, setGallery] = useState<GalleryItem[]>(INITIAL_GALLERY);

  const [newStudent, setNewStudent] = useState({
    full_name: "",
    grade: 9,
    section: "A",
    age: 15,
  });
  const [examForm, setExamForm] = useState({
    teacher_name: "Mr. Dawit Hailu",
    subject: "Mathematics",
    grade: 9,
    exam_type: "Final Exam (40%)",
    exam_content: "",
  });
  const [chatInput, setChatInput] = useState("");
  const [chatStudentRef, setChatStudentRef] = useState("Abebe Kebede (Grade 9A)");
  const [galleryForm, setGalleryForm] = useState({
    title: "",
    category: "Science Fair",
    image_url: "",
  });

  useEffect(() => {
    if (!hasSupabase || !supabase) return;
    (async () => {
      const { data: st } = await supabase.from("students").select("*").order("full_name");
      if (st && st.length > 0) setStudents(st as StudentRecord[]);

      const { data: ex } = await supabase
        .from("exams")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (ex && ex.length > 0) setExams(ex as ExamSubmission[]);

      const { data: msg } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true });
      if (msg && msg.length > 0) setMessages(msg as ChatMessage[]);

      const { data: gal } = await supabase
        .from("gallery")
        .select("*")
        .order("created_at", { ascending: false });
      if (gal && gal.length > 0) setGallery(gal as GalleryItem[]);
    })();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080808] text-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#111111] border border-[#D4AF37]/40 rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#8C6218] text-black flex items-center justify-center shadow-lg">
              <GraduationCap size={32} />
            </div>
            <h1 className="text-2xl font-bold text-[#D4AF37] tracking-wide">
              PRESTIGIOUS YOUTH ACADEMY
            </h1>
            <p className="text-xs text-gray-400">
              Bole, Addis Ababa • Enterprise School & AI Portal
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setUser({ name: loginName || "Administrator", role: loginRole });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs uppercase text-[#D4AF37] mb-1">Full Name</label>
              <input
                required
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:border-[#D4AF37] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs uppercase text-[#D4AF37] mb-1">
                Select Portal Role
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["Admin", "Teacher", "Parent"] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setLoginRole(role)}
                    className={`py-2 rounded-lg text-xs font-bold border transition ${
                      loginRole === role
                        ? "bg-[#D4AF37] text-black border-[#D4AF37]"
                        : "bg-[#1A1A1A] text-gray-400 border-gray-700 hover:border-[#D4AF37]/50"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#D4AF37] to-[#B5892E] hover:opacity-95 text-black font-bold py-3 rounded-xl transition shadow-lg"
            >
              Enter {loginRole} Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filteredStudents = students.filter(
    (s) => s.grade === selectedGrade && s.section === selectedSection
  );

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.full_name.trim()) return;

    const record: StudentRecord = {
      id: String(Date.now()),
      full_name: newStudent.full_name.trim(),
      grade: Number(newStudent.grade),
      section: newStudent.section,
      age: Number(newStudent.age),
      ws1: 0,
      test1: 0,
      ws2: 0,
      test2: 0,
      ws3: 0,
      mid_exam: 0,
      ws4: 0,
      final_exam: 0,
    };

    setStudents((prev) => [...prev, record]);
    setSelectedGrade(record.grade);
    setSelectedSection(record.section);
    setNewStudent({ full_name: "", grade: record.grade, section: record.section, age: 15 });

    if (hasSupabase && supabase) {
      await supabase.from("students").insert([record]);
    }
  };

  const handleExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.exam_content.trim()) return;

    const evaluation = evaluateExamQuality(
      examForm.subject,
      Number(examForm.grade),
      examForm.exam_content
    );

    const submission: ExamSubmission = {
      id: `ex-${Date.now()}`,
      teacher_name: examForm.teacher_name || user.name,
      subject: examForm.subject,
      grade: Number(examForm.grade),
      exam_type: examForm.exam_type,
      exam_content: examForm.exam_content.trim(),
      ai_score: evaluation.score,
      ai_feedback: evaluation.feedback,
      submitted_at: "Just now",
    };

    setExams((prev) => [submission, ...prev]);
    setExamForm((prev) => ({ ...prev, exam_content: "" }));

    if (hasSupabase && supabase) {
      await supabase.from("exams").insert([submission]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const msg: ChatMessage = {
      id: `m-${Date.now()}`,
      sender_role: user.role,
      sender_name: user.name,
      student_name: chatStudentRef,
      body: chatInput.trim(),
      created_at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, msg]);
    setChatInput("");

    if (hasSupabase && supabase) {
      await supabase.from("messages").insert([msg]);
    }
  };

  const handleAddGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galleryForm.title.trim()) return;

    const item: GalleryItem = {
      id: `g-${Date.now()}`,
      title: galleryForm.title.trim(),
      category: galleryForm.category,
      image_url: galleryForm.image_url.trim() || "https://unsplash.com",
    };

    setGallery((prev) => [item, ...prev]);
    setGalleryForm({ title: "", category: "Science Fair", image_url: "" });

    if (hasSupabase && supabase) {
      await supabase.from("gallery").insert([item]);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] text-gray-100 flex flex-col">
      <header className="bg-[#111111] border-b border-[#D4AF37]/30 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#8C6218] text-black flex items-center justify-center">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#D4AF37] tracking-wide">
              PRESTIGIOUS YOUTH ACADEMY
            </h1>
            <p className="text-xs text-gray-400">
              {user.name} • <span className="text-[#D4AF37]">{user.role}</span>
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActivePage("students")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activePage === "students"
                ? "bg-[#D4AF37] text-black"
                : "bg-[#1A1A1A] text-gray-300 hover:text-[#D4AF37]"
            }`}
          >
            <Users size={15} /> Students & Marks
          </button>
          <button
            type="button"
            onClick={() => setActivePage("exams")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activePage === "exams"
                ? "bg-[#D4AF37] text-black"
                : "bg-[#1A1A1A] text-gray-300 hover:text-[#D4AF37]"
            }`}
          >
            <FileCheck2 size={15} /> AI Exam Review
          </button>
          <button
            type="button"
            onClick={() => setActivePage("chat")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activePage === "chat"
                ? "bg-[#D4AF37] text-black"
                : "bg-[#1A1A1A] text-gray-300 hover:text-[#D4AF37]"
            }`}
          >
            <MessageSquare size={15} /> Parent-Teacher Chat
          </button>
          <button
            type="button"
            onClick={() => setActivePage("gallery")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
              activePage === "gallery"
                ? "bg-[#D4AF37] text-black"
                : "bg-[#1A1A1A] text-gray-300 hover:text-[#D4AF37]"
            }`}
          >
            <ImageIcon size={15} /> Gallery
          </button>
          <button
            type="button"
            onClick={() => setUser(null)}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#1A1A1A] text-red-400 hover:bg-red-950/40 flex items-center gap-1.5 transition"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {activePage === "students" && (
          <div className="space-y-6">
            <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs uppercase text-[#D4AF37] font-semibold">Grade:</span>
                {[9, 10, 11, 12].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSelectedGrade(g)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      selectedGrade === g
                        ? "bg-[#D4AF37] text-black"
                        : "bg-[#1A1A1A] text-gray-300"
                    }`}
                  >
                    Grade {g}
                  </button>
                ))}
                <span className="text-xs uppercase text-[#D4AF37] font-semibold ml-2">
                  Section:
                </span>
                {["A", "B", "C"].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setSelectedSection(sec)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      selectedSection === sec
                        ? "bg-[#D4AF37] text-black"
                        : "bg-[#1A1A1A] text-gray-300"
                    }`}
                  >
                    {sec}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddStudent} className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  placeholder="Student full name"
                  value={newStudent.full_name}
                  onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })}
                  className="bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#D4AF37]"
                />
                <input
                  type="number"
                  min={5}
                  max={25}
                  value={newStudent.age}
                  onChange={(e) =>
                    setNewStudent({ ...newStudent, age: Number(e.target.value) || 15 })
                  }
                  className="w-16 bg-[#1A1A1A] border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  className="bg-[#D4AF37] text-black font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus size={14} /> Add Student
                </button>
              </form>
            </div>

            <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#181818] text-[#D4AF37] uppercase">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Age</th>
                    <th className="p-3">WS1</th>
                    <th className="p-3">Test1</th>
                    <th className="p-3">WS2</th>
                    <th className="p-3">Test2</th>
                    <th className="p-3">WS3</th>
                    <th className="p-3">Mid</th>
                    <th className="p-3">WS4</th>
                    <th className="p-3">Final</th>
                    <th className="p-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-gray-400">
                        No students recorded for Grade {selectedGrade} Section {selectedSection}.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-[#161616]">
                        <td className="p-3 font-medium text-white">{s.full_name}</td>
                        <td className="p-3 text-gray-300">{s.age}</td>
                        <td className="p-3">{s.ws1}</td>
                        <td className="p-3">{s.test1}</td>
                        <td className="p-3">{s.ws2}</td>
                        <td className="p-3">{s.test2}</td>
                        <td className="p-3">{s.ws3}</td>
                        <td className="p-3">{s.mid_exam}</td>
                        <td className="p-3">{s.ws4}</td>
                        <td className="p-3">{s.final_exam}</td>
                        <td className="p-3 font-bold text-[#D4AF37]">{getTotalScore(s)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activePage === "exams" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleExamSubmit}
              className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4"
            >
              <h2 className="text-base font-bold text-[#D4AF37] flex items-center gap-2">
                <Sparkles size={18} /> Submit Exam for AI Quality Evaluation
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Subject"
                  value={examForm.subject}
                  onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                  className="bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={examForm.grade}
                  onChange={(e) =>
                    setExamForm({ ...examForm, grade: Number(e.target.value) || 9 })
                  }
                  className="bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
                />
              </div>
              <input
                type="text"
                placeholder="Assessment Type"
                value={examForm.exam_type}
                onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })}
                className="w-full bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
              <textarea
                rows={5}
                placeholder="Paste exam questions and marking scheme..."
                value={examForm.exam_content}
                onChange={(e) => setExamForm({ ...examForm, exam_content: e.target.value })}
                className="w-full bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                className="w-full bg-[#D4AF37] text-black font-bold py-2.5 rounded-xl text-xs"
              >
                Evaluate Exam Draft
              </button>
            </form>

            <div className="space-y-4">
              {exams.map((ex) => (
                <div
                  key={ex.id}
                  className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white">
                      {ex.subject} • Grade {ex.grade} ({ex.exam_type})
                    </h3>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#D4AF37]/20 text-[#D4AF37]">
                      AI Score: {ex.ai_score}/100
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {ex.teacher_name} • {ex.submitted_at}
                  </p>
                  <p className="text-xs text-gray-300 bg-[#181818] p-3 rounded-lg">
                    {ex.exam_content}
                  </p>
                  <p className="text-xs text-[#D4AF37]">{ex.ai_feedback}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activePage === "chat" && (
          <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-[#D4AF37]">Parent & Teacher Portal</h2>
              <input
                type="text"
                value={chatStudentRef}
                onChange={(e) => setChatStudentRef(e.target.value)}
                className="bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className="bg-[#181818] border border-gray-800 rounded-xl p-3.5 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#D4AF37]">
                      {m.sender_name} ({m.sender_role})
                    </span>
                    <span className="text-gray-400">{m.created_at}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Student: {m.student_name}</p>
                  <p className="text-xs text-gray-200">{m.body}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Write a message to parents or teachers..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-[#1A1A1A] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                className="bg-[#D4AF37] text-black font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
              >
                <Send size={14} /> Send
              </button>
            </form>
          </div>
        )}

        {activePage === "gallery" && (
          <div className="space-y-6">
            <form
              onSubmit={handleAddGalleryItem}
              className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-5 flex flex-wrap gap-3"
            >
              <input
                type="text"
                placeholder="Event title"
                value={galleryForm.title}
                onChange={(e) => setGalleryForm({ ...galleryForm, title: e.target.value })}
                className="flex-1 min-w-48 bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
              <input
                type="text"
                placeholder="Category"
                value={galleryForm.category}
                onChange={(e) => setGalleryForm({ ...galleryForm, category: e.target.value })}
                className="bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
              <input
                type="text"
                placeholder="Image URL (optional)"
                value={galleryForm.image_url}
                onChange={(e) => setGalleryForm({ ...galleryForm, image_url: e.target.value })}
                className="flex-1 min-w-48 bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                className="bg-[#D4AF37] text-black font-bold px-4 py-2 rounded-lg text-xs"
              >
                Add Highlight
              </button>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {gallery.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-4 space-y-2"
                >
                  <span className="text-[11px] uppercase text-[#D4AF37] font-semibold">
                    {item.category}
                  </span>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs text-gray-400 truncate">{item.image_url}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
