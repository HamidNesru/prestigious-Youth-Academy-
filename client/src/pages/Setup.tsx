import { useState, type FormEvent } from "react";
import { api, type ClassRow, type Person, type Subject } from "../api";
import { useI18n } from "../i18n";
import { Card, Empty, ErrorNote, Field, Modal, PageHeader, useLoad, useToast } from "../ui";

type Tab = "classes" | "people" | "subjects";

export default function Setup() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("classes");
  const [modal, setModal] = useState<Tab | null>(null);
  const toast = useToast();
  const classes = useLoad(() => api<ClassRow[]>("/classes"), []);
  const people = useLoad(() => api<Person[]>("/users"), []);
  const subjects = useLoad(() => api<Subject[]>("/subjects"), []);
  const teachers = (people.data ?? []).filter((p) => p.role === "teacher");

  const done = () => { setModal(null); classes.reload(); people.reload(); subjects.reload(); toast.show(t("saved")); };

  return (
    <>
      <PageHeader title={t("people")}>
        <button className="btn primary" onClick={() => setModal(tab)}>
          + {tab === "classes" ? t("addClass") : tab === "people" ? t("addUser") : t("addSubject")}
        </button>
      </PageHeader>
      <div className="tabs">
        <button className={tab === "classes" ? "on" : ""} onClick={() => setTab("classes")}>{t("classes")}</button>
        <button className={tab === "people" ? "on" : ""} onClick={() => setTab("people")}>{t("people")}</button>
        <button className={tab === "subjects" ? "on" : ""} onClick={() => setTab("subjects")}>{t("subjects")}</button>
      </div>
      <ErrorNote msg={classes.error || people.error || subjects.error} />
      <Card className="table-card">
        {tab === "classes" && ((classes.data ?? []).length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>{t("class")}</th><th>{t("section")}</th><th>{t("homeroomTeacher")}</th><th className="num">{t("students")}</th></tr></thead>
            <tbody>{classes.data!.map((c) => (
              <tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.section}</td><td>{c.teacher_name ?? t("noTeacher")}</td><td className="num">{c.student_count}</td></tr>
            ))}</tbody>
          </table>
        ))}
        {tab === "people" && ((people.data ?? []).length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>{t("name")}</th><th>{t("role")}</th><th>{t("email")}</th><th>{t("phone")}</th></tr></thead>
            <tbody>{people.data!.map((p) => (
              <tr key={p.id}><td><strong>{p.name}</strong></td><td><span className="pill">{t(p.role)}</span></td><td>{p.email}</td><td>{p.phone ?? "—"}</td></tr>
            ))}</tbody>
          </table>
        ))}
        {tab === "subjects" && ((subjects.data ?? []).length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>{t("subject")}</th><th>አማርኛ</th></tr></thead>
            <tbody>{subjects.data!.map((s) => <tr key={s.id}><td><strong>{s.name}</strong></td><td>{s.name_am ?? "—"}</td></tr>)}</tbody>
          </table>
        ))}
      </Card>
      {modal === "classes" && <ClassForm teachers={teachers} onClose={() => setModal(null)} onSaved={done} />}
      {modal === "people" && <UserForm onClose={() => setModal(null)} onSaved={done} />}
      {modal === "subjects" && <SubjectForm onClose={() => setModal(null)} onSaved={done} />}
      {toast.node}
    </>
  );
}

function useSubmit(path: string, build: () => unknown, onSaved: () => void) {
  const [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await api(path, { body: build() }); onSaved(); } catch (err) { setError((err as Error).message); }
  };
  return { error, submit };
}

function Buttons({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="row gap end">
      <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
      <button className="btn primary">{t("save")}</button>
    </div>
  );
}

function ClassForm({ teachers, onClose, onSaved }: { teachers: Person[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [section, setSection] = useState("A");
  const [teacher, setTeacher] = useState("");
  const { error, submit } = useSubmit("/classes", () => ({ name, section, teacher_id: teacher ? Number(teacher) : null }), onSaved);
  return (
    <Modal title={t("addClass")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="grid2">
          <Field label={t("class")}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Grade 7" required autoFocus /></Field>
          <Field label={t("section")}><input value={section} onChange={(e) => setSection(e.target.value)} required /></Field>
        </div>
        <Field label={t("homeroomTeacher")}>
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)}>
            <option value="">{t("none")}</option>
            {teachers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <ErrorNote msg={error} /><Buttons onClose={onClose} />
      </form>
    </Modal>
  );
}

function UserForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", role: "parent" });
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const { error, submit } = useSubmit("/users", () => f, onSaved);
  return (
    <Modal title={t("addUser")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t("role")}>
          <select value={f.role} onChange={(e) => set("role", e.target.value)}>
            <option value="parent">{t("parent")}</option><option value="teacher">{t("teacher")}</option><option value="admin">{t("admin")}</option>
          </select>
        </Field>
        <Field label={t("name")}><input value={f.name} onChange={(e) => set("name", e.target.value)} required autoFocus /></Field>
        <div className="grid2">
          <Field label={t("email")}><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required /></Field>
          <Field label={t("phone")}><input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <Field label={t("password6")}><input type="password" minLength={6} value={f.password} onChange={(e) => set("password", e.target.value)} required autoComplete="new-password" /></Field>
        <ErrorNote msg={error} /><Buttons onClose={onClose} />
      </form>
    </Modal>
  );
}

function SubjectForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [nameAm, setNameAm] = useState("");
  const { error, submit } = useSubmit("/subjects", () => ({ name, name_am: nameAm || null }), onSaved);
  return (
    <Modal title={t("addSubject")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="English"><input value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Field>
        <Field label="አማርኛ"><input value={nameAm} onChange={(e) => setNameAm(e.target.value)} /></Field>
        <ErrorNote msg={error} /><Buttons onClose={onClose} />
      </form>
    </Modal>
  );
}
