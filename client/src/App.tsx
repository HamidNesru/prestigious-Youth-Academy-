import { useState } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import type { Role } from "./api";
import { useAuth } from "./auth";
import { useI18n, type Key } from "./i18n";
import Attendance from "./pages/Attendance";
import Dashboard from "./pages/Dashboard";
import Fees from "./pages/Fees";
import Grades from "./pages/Grades";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import ReportCard from "./pages/ReportCard";
import Setup from "./pages/Setup";
import Students from "./pages/Students";

const NAV: { to: string; key: Key; icon: string; roles: Role[] }[] = [
  { to: "/", key: "dashboard", icon: "▦", roles: ["admin", "teacher", "parent"] },
  { to: "/students", key: "students", icon: "☺", roles: ["admin", "teacher", "parent"] },
  { to: "/attendance", key: "attendance", icon: "✓", roles: ["admin", "teacher"] },
  { to: "/grades", key: "grades", icon: "★", roles: ["admin", "teacher"] },
  { to: "/fees", key: "fees", icon: "₿", roles: ["admin", "parent"] },
  { to: "/messages", key: "messages", icon: "✉", roles: ["admin", "teacher", "parent"] },
  { to: "/setup", key: "people", icon: "⚙", roles: ["admin"] },
];

function Shell() {
  const { user, school, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [menu, setMenu] = useState(false);
  if (!user) return <Login />;

  return (
    <div className="shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">{school?.name}</div>
            <div className="muted small">{t("appName")}</div>
          </div>
        </div>
        <nav onClick={() => setMenu(false)}>
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
              <span className="nav-icon" aria-hidden>{n.icon}</span>{t(n.key)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="small"><strong>{user.name}</strong><div className="muted">{t(user.role)}</div></div>
          <div className="row gap">
            <button className="btn small-btn" onClick={() => setLang(lang === "en" ? "am" : "en")}>{t("language")}</button>
            <button className="btn small-btn" onClick={logout}>{t("signOut")}</button>
          </div>
        </div>
      </aside>
      <div className="main">
        <button className="menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu">☰</button>
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Students />} />
            <Route path="/attendance" element={user.role === "parent" ? <Navigate to="/" /> : <Attendance />} />
            <Route path="/grades" element={user.role === "parent" ? <Navigate to="/" /> : <Grades />} />
            <Route path="/fees" element={user.role === "teacher" ? <Navigate to="/" /> : <Fees />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/report/:id" element={<ReportCard />} />
            <Route path="/setup" element={user.role === "admin" ? <Setup /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const { ready } = useAuth();
  const { t } = useI18n();
  if (!ready) return <div className="boot">{t("loading")}</div>;
  return <BrowserRouter><Shell /></BrowserRouter>;
}
