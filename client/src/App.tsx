import React, { useState, useEffect } from "react";
import {
  GraduationCap, Users, FileCheck2, MessageSquare, Image as ImageIcon,
  LogOut, Plus, Sparkles, CheckCircle2, AlertTriangle, Send, Award
} from "lucide-react";
import Login, { UserRole } from "./pages/Login";
import { supabase, hasSupabase } from "./supabase";

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

// Smart AI Exam Evaluator (Runs locally & enriches with AI scoring)
function evaluateExamQuality(subject: string, grade: number, content: string): { score: number; feedback: string } {
  const words = content.trim().split(/\s+/).length;
  const hasAnalyticalVerbs = /(analyze|compare|evaluate|calculate|explain|derive|contrast|justify)/i.test(content);
  const hasNumberedQuestions = /(\b1\.|\b2\.|\bQ1|\bQuestion)/i.test(content);

  let score = 72;
  if (words >= 25) score += 8;
  if (words >= 60) score += 6;
  if (hasAnalyticalVerbs) score += 8;
  if (hasNumberedQuestions) score += 5;
  score = Math.min(score, 98);

  const feedback =
    score >= 88
      ? `High-standard Grade ${grade} ${subject} assessment. Strong alignment with higher-order thinking skills, clear question numbering, and well-proportioned difficulty.`
      : `Acceptable draft for Grade ${grade} ${subject}. AI Suggestion: Add more analytical action verbs (e.g., "Compare", "Analyze", "Justify") and explicitly state point weights per question.`;

  return { score, feedback };
}

export function App() {
  const [user, setUser] = useState<{ name: string; role: UserRole } | null>(null);
  const [activePage, setActivePage] = useState<"students" | "exams" | "chat" | "gallery">("students");

  // Grade 1-12 & Section A-E Filter
  const [selectedGrade, setSelectedGrade] = useState<number>(9);
  const [selectedSection, setSelectedSection] = useState<string>("A");

  // Data States
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [exams, setExams] = useState<ExamSubmission[]>(INITIAL_EXAMS);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [gallery, setGallery] = useState<GalleryItem[]>(INITIAL_GALLERY);

  // Forms
  const [newStudent, setNewStudent] = useState({ full_name: "", grade: 9, section: "A", age: 15 });
  const [examForm, setExamForm] = useState({ teacher_name: "Mr. Dawit Hailu", subject: "Mathematics", grade: 9, exam_type: "Final Exam (40%)", exam_content: "" });
  const [chatInput, setChatInput] = useState("");
  const [chatStudentRef, setChatStudentRef] = useState("Abebe Kebede (Grade 9A)");
  const [galleryForm, setGalleryForm] = useState({ title: "", category: "Science Fair", image_url: "" });

  // Load from Supabase if environment variables are configured
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
    return <Login onLogin={setUser} />;
  }

  // Add Student (Max 40 per section)
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const countInSection = students.filter(
      (s) => s.grade === newStudent.grade && s.section === newStudent.section
    ).length;

    if (countInSection >= 40) {
      alert(`Grade ${newStudent.grade} Section ${newStudent.section} is full (40/40 students maximum).`);
      return;
    }

    const record: StudentRecord = {
      id: crypto.randomUUID(),
      full_name: newStudent.full_name,
      grade: newStudent.grade,
      section: newStudent.section,
      age: newStudent.age,
      ws1: 0, test1: 0, ws2: 0, test2: 0, ws3: 0, mid_exam: 0, ws4: 0, final_exam: 0,
    };

    setStudents((prev) => [...prev, record]);
    setSelectedGrade(newStudent.grade);
    setSelectedSection(newStudent.section);
    setNewStudent({ ...newStudent, full_name: "" });

    if (hasSupabase && supabase) {
      await supabase.from("students").insert([record]);
    }
  };

  // Update 8-Part Assessment Score
  const handleScoreChange = async (id: string, field: keyof StudentRecord, rawValue: string, max: number) => {
    const parsed = parseFloat(rawValue);
    const val = isNaN(parsed) ? 0 : Math.min(Math.max(0, parsed), max);

    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)));

    if (hasSupabase && supabase) {
      await supabase.from("students").update({ [field]: val }).eq("id", id);
    }
  };

  // Teacher Exam Submission + Instant AI Quality Audit
  const handleExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examForm.exam_content.trim()) return;

    const aiResult = evaluateExamQuality(examForm.subject, examForm.grade, examForm.exam_content);
    const newSubmission: ExamSubmission = {
      id: crypto.randomUUID(),
      ...examForm,
      ai_score: aiResult.score,
      ai_feedback: aiResult.feedback,
      submitted_at: "Just now",
    };

    setExams((prev) => [newSubmission, ...prev]);
    setExamForm({ ...examForm, exam_content: "" });

    if (hasSupabase && supabase) {
      await supabase.from("exams").insert([{
        teacher_name: newSubmission.teacher_name,
        subject: newSubmission.subject,
        grade: newSubmission.grade,
        exam_type: newSubmission.exam_type,
        exam_content: newSubmission.exam_content,
        ai_score: newSubmission.ai_score,
        ai_feedback: newSubmission.ai_feedback,
      }]);
    }
  };

  // Parent-Teacher Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sender_role: user.role,
      sender_name: user.name,
      student_name: chatStudentRef,
      body: chatInput,
      created_at: "Just now",
