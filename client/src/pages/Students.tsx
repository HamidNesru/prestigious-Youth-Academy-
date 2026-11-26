import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, type ClassRow, type Person, type Student } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Card, Empty, ErrorNote, Field, Modal, PageHeader, useLoad, useToast } from "../ui";

export default function Students() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === "admin";
  const [q, setQ] = useState("");
  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const classes = useLoad(() => api<ClassRow[]>("/classes"), []);
  const students = useLoad(() => api<Student[]>("/students" + (classId ? `?classId=${classId}` : "")), [classId]);

  const list = (students.data ?? []).filter((s) => (s.full_name + s.student_code).toLowerCase().includes(q.toLowerCase()));

  const remove = async (s: Student) => {
    if (!confirm(t("confirmDelete"))) return;
    await api(`/students/${s.id}`, { method: "DELETE" });
    students.reload();
  };

  return (
    <>
      <PageHeader title={t("students")}>
        {isAdmin && <button className="btn primary" onClick={() => setOpen(true)}>+ {t("addStudent")}</button>}
      </PageHeader>
      <div className="row gap wrap filters">
        <input className="grow" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} />
        {user?.role !== "parent" && (
          <select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">{t("allClasses")}</option>
            {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
        )}
      </div>
      <ErrorNote msg={students.error} />
      <Card className="table-card">
        {list.length === 0 ? <Empty /> : (
          <table>
            <thead>
              <tr>
                <th>{t("code")}</th><th>{t("name")}</th><th>{t("class")}</th><th>{t("parentName")}</th><th>{t("phone")}</th><th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.student_code}</td>
                  <td><strong>{s.full_name}</strong></td>
                  <td>{s.class_name ? `${s.class_name} ${s.section}` : "—"}</td>
                  <td>{s.parent_name ?? "—"}</td>
                  <td>{s.parent_phone ?? "—"}</td>
                  <td className="actions">
                    <Link className="link-btn" to={`/report/${s.id}`}>{t("reportCard")}</Link>
                    {isAdmin && <button className="link-btn danger" onClick={() => remove(s)}>{t("delete")}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {open && (
        <AddStudent
          classes={classes.data ?? []}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); students.reload(); toast.show(t("saved")); }}
        />
      )}
      {toast.node}
    </>
  );
}

function AddStudent({ classes, onClose, onSaved }: { classes: ClassRow[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const parents = useLoad(() => api<Person[]>("/users?role=parent"), []);
  const [form, setForm] = useState({ full_name: "", gender: "", birth_date: "", class_id: "", parent_id: "" });
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/students", {
        body: {
          full_name: form.full_name.trim(), gender: form.gender || null, birth_date: form.birth_date || null,
          class_id: form.class_id ? Number(form.class_id) : null, parent_id: form.parent_id ? Number(form.parent_id) : null,
        },
      });
      onSaved();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={t("addStudent")} onClose={onClose}>
      <form onSubmit={submit} className="form">
        <Field label={t("name")}><input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} required autoFocus /></Field>
        <div className="grid2">
          <Field label={t("gender")}>
            <select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">—</option><option value="M">{t("male")}</option><option value="F">{t("female")}</option>
            </select>
          </Field>
          <Field label={t("birthDate")}><input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Field>
        </div>
        <Field label={t("class")}>
          <select value={form.class_id} onChange={(e) => set("class_id", e.target.value)}>
            <option value="">{t("none")}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
          </select>
        </Field>
        <Field label={t("parentName")}>
          <select value={form.parent_id} onChange={(e) => set("parent_id", e.target.value)}>
            <option value="">{t("none")}</option>
            {parents.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <ErrorNote msg={error} />
        <div className="row gap end">
          <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
          <button className="btn primary">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}
