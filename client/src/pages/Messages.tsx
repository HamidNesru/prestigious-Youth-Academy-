import { useState, type FormEvent } from "react";
import { api, type Contact, type Message, type Student } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Card, Empty, ErrorNote, Field, Modal, PageHeader, useLoad, useToast } from "../ui";

export default function Messages() {
  const { user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const msgs = useLoad(() => api<Message[]>("/messages"), []);
  const [composing, setComposing] = useState<{ to?: number } | null>(null);
  const [tab, setTab] = useState<"in" | "out">("in");

  const list = (msgs.data ?? []).filter((m) => (tab === "in" ? m.to_user === user?.id : m.from_user === user?.id));

  const markRead = async (m: Message) => {
    if (m.to_user !== user?.id || m.read) return;
    await api(`/messages/${m.id}/read`, { method: "POST", body: {} });
    msgs.reload();
  };

  return (
    <>
      <PageHeader title={t("messages")}>
        <button className="btn primary" onClick={() => setComposing({})}>+ {t("newMessage")}</button>
      </PageHeader>
      <div className="tabs">
        <button className={tab === "in" ? "on" : ""} onClick={() => setTab("in")}>{t("received")}</button>
        <button className={tab === "out" ? "on" : ""} onClick={() => setTab("out")}>{t("sent")}</button>
      </div>
      <ErrorNote msg={msgs.error} />
      {list.length === 0 ? <Card><Empty /></Card> : (
        <div className="stack">
          {list.map((m) => (
            <Card key={m.id} className={`msg ${tab === "in" && !m.read ? "unread" : ""}`}>
              <div className="row gap between" onClick={() => markRead(m)}>
                <div>
                  <strong>{tab === "in" ? m.from_name : m.to_name}</strong>
                  {m.student_name && <span className="chip small-chip">{m.student_name}</span>}
                </div>
                <span className="muted small">{m.created_at.slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="msg-body">{m.body}</p>
              {tab === "in" && <button className="link-btn" onClick={() => setComposing({ to: m.from_user })}>↩ {t("send")}</button>}
            </Card>
          ))}
        </div>
      )}
      {composing && (
        <Compose initialTo={composing.to} onClose={() => setComposing(null)}
          onSent={() => { setComposing(null); msgs.reload(); toast.show(t("saved")); }} />
      )}
      {toast.node}
    </>
  );
}

function Compose({ initialTo, onClose, onSent }: { initialTo?: number; onClose: () => void; onSent: () => void }) {
  const { t } = useI18n();
  const contacts = useLoad(() => api<Contact[]>("/contacts"), []);
  const students = useLoad(() => api<Student[]>("/students"), []);
  const [to, setTo] = useState(initialTo ? String(initialTo) : "");
  const [student, setStudent] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/messages", { body: { to_user: Number(to), body, student_id: student ? Number(student) : null } });
      onSent();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={t("newMessage")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t("to")}>
          <select value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">{t("select")}</option>
            {contacts.data?.map((c) => <option key={c.id} value={c.id}>{c.name} ({t(c.role)})</option>)}
          </select>
        </Field>
        <Field label={t("about")}>
          <select value={student} onChange={(e) => setStudent(e.target.value)}>
            <option value="">{t("none")}</option>
            {students.data?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
        <Field label={t("message")}><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={2000} /></Field>
        <ErrorNote msg={error} />
        <div className="row gap end">
          <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
          <button className="btn primary">{t("send")}</button>
        </div>
      </form>
    </Modal>
  );
}
