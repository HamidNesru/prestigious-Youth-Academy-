import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { ErrorNote, Field } from "../ui";

const DEMOS = [
  { label: "Admin", email: "admin@demo.school", password: "admin123" },
  { label: "Teacher", email: "teacher@demo.school", password: "teacher123" },
  { label: "Parent", email: "parent@demo.school", password: "parent123" },
];

export default function Login() {
  const { login } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try { await login(email, password); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-side">
        <div className="brand-mark">S</div>
        <h1>{t("appName")}</h1>
        <p>{t("loginTagline")}</p>
      </div>
      <div className="login-form-wrap">
        <button className="link-btn lang-top" onClick={() => setLang(lang === "en" ? "am" : "en")}>{t("language")}</button>
        <form className="login-form" onSubmit={submit}>
          <h2>{t("signIn")}</h2>
          <Field label={t("email")}>
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label={t("password")}>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <ErrorNote msg={error} />
          <button className="btn primary block" disabled={busy}>{t("signIn")}</button>
          <div className="demo-box">
            <div className="muted small">{t("demoAccounts")}</div>
            <div className="row gap wrap">
              {DEMOS.map((d) => (
                <button type="button" key={d.label} className="chip" onClick={() => { setEmail(d.email); setPassword(d.password); }}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
