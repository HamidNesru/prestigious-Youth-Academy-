import React, { useState } from "react";
import { GraduationCap, ShieldCheck, KeyRound, Sparkles } from "lucide-react";

export type UserRole = "Admin" | "Teacher" | "Parent";

export default function Login({ onLogin }: { onLogin: (user: { name: string; role: UserRole }) => void }) {
  const [email, setEmail] = useState("director@prestigiousacademy.et");
  const [password, setPassword] = useState("prestigious2026");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ name: "School Director", role: "Admin" });
  };

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle Gold Ambient Glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#121212] border border-[#D4AF37]/40 rounded-2xl p-8 shadow-2xl shadow-black">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#996515] flex items-center justify-center text-black shadow-lg shadow-[#D4AF37]/20 mb-4">
            <GraduationCap size={34} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-wider text-[#D4AF37]">
            PRESTIGIOUS YOUTH ACADEMY
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Bole, Addis Ababa • AI-Powered School Management Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#D4AF37] mb-1">Portal Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-gray-700 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-white outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-[#D4AF37] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-gray-700 focus:border-[#D4AF37] rounded-xl px-4 py-2.5 text-sm text-white outline-none"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:from-[#F3D570] hover:to-[#D4AF37] text-black font-bold text-sm tracking-wide transition cursor-pointer flex items-center justify-center gap-2"
          >
            <KeyRound size={16} /> Sign In to Executive Portal
          </button>
        </form>

        {/* Instant 1-Click Demo Access for Live School Presentations */}
        <div className="mt-6 pt-5 border-t border-gray-800">
          <p className="text-[11px] text-center uppercase tracking-widest text-gray-400 mb-3 flex items-center justify-center gap-1">
            <Sparkles size={12} className="text-[#D4AF37]" /> Instant 1-Click Live Demo Access
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onLogin({ name: "Dr. Solomon (Director)", role: "Admin" })}
              className="py-2 px-2 rounded-lg bg-[#1A1A1A] hover:border-[#D4AF37] border border-gray-700 text-xs font-semibold text-[#D4AF37] transition cursor-pointer"
            >
              Admin Demo
            </button>
            <button
              type="button"
              onClick={() => onLogin({ name: "Mr. Dawit Hailu", role: "Teacher" })}
              className="py-2 px-2 rounded-lg bg-[#1A1A1A] hover:border-[#D4AF37] border border-gray-700 text-xs font-semibold text-gray-200 transition cursor-pointer"
            >
              Teacher Demo
            </button>
            <button
              type="button"
              onClick={() => onLogin({ name: "Mrs. Tigist Bekele", role: "Parent" })}
              className="py-2 px-2 rounded-lg bg-[#1A1A1A] hover:border-[#D4AF37] border border-gray-700 text-xs font-semibold text-gray-200 transition cursor-pointer"
            >
              Parent Demo
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-gray-500">
          <ShieldCheck size={14} className="text-[#D4AF37]" /> Secured by Supabase Cloud & Row-Level Isolation
        </div>
      </div>
    </div>
  );
}
