import React, { useState, useEffect } from "react";
import {
  GraduationCap, Users, FileCheck2, MessageSquare, Image as ImageIcon,
  LogOut, Plus, Sparkles, CheckCircle2, Send, Award, ShieldCheck
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
    exam_content: "1. Analyze the socio-economic impacts of the Adwa victory on African anti-colonial movements. 2. Compare federal structures...",
    ai_score: 94,
    ai_feedback: "Excellent cognitive balance (35% recall, 40% analytical comparison, 25% critical essay). Clear marking rubric and zero ambiguous wording.",
    submitted_at: "Today, 09:40 AM",
  },
  {
    id: "ex-2",
    teacher_name: "Ms. Hanna Mulugeta",
    subject: "Physics",
    grade: 10,
    exam_type: "Mid Exam (20%)",
    exam_content: "1. Define Newton's second law. 2. Calculate acceleration of a 12kg block on an inclined plane at 30 degrees...",
    ai_score: 88,
    ai_feedback: "Strong quantitative problem distribution. Recommendation: Specify gravitational constant (g = 9.8 m/s²) explicitly in Question 2.",
    submitted_at: "Yesterday, 03:15 PM",
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  { id: "m1", sender_role: "Parent", sender_name: "Mrs. Tigist Bekele", student_name: "Abebe Kebede (Grade 9A)", body: "Selam Teacher, how is Abebe performing on his Worksheets and Test 2 ahead of the Mid Exam?", created_at: "10:15 AM" },
  { id: "m2", sender_role: "Teacher", sender_name: "Mr. Dawit Hailu", student_name: "Abebe Kebede (Grade 9A)", body: "Selam Mrs. Tigist! He scored 5/5 on Worksheet 2 and 8.5/10 on Test 2. His class participation is outstanding.", created_at: "10:28 AM" },
];

const INITIAL_GALLERY: GalleryItem[] = [
  { id: "g1", title: "Annual Science & Innovation Exhibition", category: "STEM & Science Fair", image_url: "https://unsplash.com" },
  { id: "g2", title: "Ethiopian Nations & Cultural Heritage Day", category: "Culture & Arts", image_url: "https://unsplash.com" },
  { id: "g3", title: "Inter-Section Academic Debate Finals", category: "Student Leadership", image_url: "https://unsplash.com" },
];

function evaluateExamQuality(subject: string, grade: number, content: string): { score: number; feedback: string } {
  const words = content.trim().split(/\s+/).length;
  const hasAnalyticalVerbs = /(analyze|compare|evaluate|calculate|explain|derive|contrast|justify)/i.test(content);
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

  const [newStudent, setNewStudent] = useState({ full_name: "", grade: 9, section: "A", age: 15 });
  const [examForm, setExamForm] = useState({ teacher_name: "Mr. Dawit Hailu", subject: "Mathematics", grade: 9, exam_type: "Final Exam (40%)", exam_content: "" });
  const [chatInput, setChatInput] = useState("");
  const [chatStudentRef, setChatStudentRef] = useState("Abebe Kebede (Grade 9A)");
  const [galleryForm, setGalleryForm] = useState({ title: "", category: "Science Fair", image_url: "" });

  useEffect(() => {
    if (!hasSupabase || !supabase) return;
    (async () => {
      const { data: st } = await supabase.from("students").select("*").order("full_name");
      if (st && st.length > 0) setStudents(st);

      const { data: ex } = await supabase.from("exams").select("*").order("submitted_at", { ascending: false });
      if (ex && ex.length > 0) setExams(ex);

      const { data: msg } = await supabase.from("messages").select("*").order("created_at", { ascending: true });
      if (msg && msg.length > 0) setMessages(msg);

      const { data: gal } = await supabase.from("gallery").select("*").order("created_at", { ascending: false });
      if (gal && gal.length > 0) setGallery(gal);
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
            <h1 className="text-2xl font-bold text-[#D4AF37] tracking-wide">PRESTIGIOUS YOUTH ACADEMY</h1>
            <p className="text-xs text-gray-400">Bole, Addis Ababa • Enterprise School & AI Portal</p>
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
              <label className="block text-xs uppercase text-[#D4AF37] mb-1">Select Portal Role</label>
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
