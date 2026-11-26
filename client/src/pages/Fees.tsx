import { useState, type FormEvent } from "react";
import { api, type ClassRow, type Invoice, type Payment, type Student } from "../api";
import { useAuth } from "../auth";
import { todayIso } from "../ethcal";
import { useI18n } from "../i18n";
import { Card, Empty, ErrorNote, Field, Modal, PageHeader, money, useLoad, useToast } from "../ui";

export default function Fees() {
  const { user } = useAuth();
  const { t, date } = useI18n();
  const isAdmin = user?.role === "admin";
  const toast = useToast();
  const invoices = useLoad(() => api<Invoice[]>("/invoices"), []);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [q, setQ] = useState("");

  const list = (invoices.data ?? []).filter((i) => (i.full_name + i.student_code + i.title).toLowerCase().includes(q.toLowerCase()));
  const statusOf = (i: Invoice) => (i.paid >= i.amount ? "paidFull" : i.paid > 0 ? "partial" : "unpaid");

  return (
    <>
      <PageHeader title={t("fees")}>
        {isAdmin && <button className="btn primary" onClick={() => setCreating(true)}>+ {t("newInvoice")}</button>}
      </PageHeader>
      <div className="row gap filters"><input className="grow" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <ErrorNote msg={invoices.error} />
      <Card className="table-card">
        {list.length === 0 ? <Empty /> : (
          <table>
            <thead>
              <tr><th>{t("name")}</th><th>{t("invoice")}</th><th className="num">{t("amount")}</th><th className="num">{t("paid")}</th><th className="num">{t("balance")}</th><th>{t("dueDate")}</th><th>{t("status")}</th><th /></tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.full_name}</strong><div className="muted small">{i.class_name}</div></td>
                  <td>{i.title}</td>
                  <td className="num">{money(i.amount)}</td>
                  <td className="num">{money(i.paid)}</td>
                  <td className="num">{money(i.amount - i.paid)}</td>
                  <td>{date(i.due_date)}</td>
                  <td><span className={`pill ${statusOf(i)}`}>{t(statusOf(i))}</span></td>
                  <td className="actions">
                    <button className="link-btn" onClick={() => setViewing(i)}>{t("history")}</button>
                    {isAdmin && i.paid < i.amount && <button className="link-btn" onClick={() => setPaying(i)}>{t("recordPayment")}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {creating && <NewInvoice onClose={() => setCreating(false)} onSaved={(n) => { setCreating(false); invoices.reload(); toast.show(`${t("saved")} (${n})`); }} />}
      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} onSaved={() => { setPaying(null); invoices.reload(); toast.show(t("saved")); }} />}
      {viewing && <History invoice={viewing} onClose={() => setViewing(null)} />}
      {toast.node}
    </>
  );
}

function NewInvoice({ onClose, onSaved }: { onClose: () => void; onSaved: (n: number) => void }) {
  const { t } = useI18n();
  const classes = useLoad(() => api<ClassRow[]>("/classes"), []);
  const students = useLoad(() => api<Student[]>("/students"), []);
  const [scope, setScope] = useState<"all" | "class" | "student">("class");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("Tuition - Semester 2");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (scope !== "all" && !target) { setError(t("select")); return; }
    try {
      const r = await api<{ created: number }>("/invoices", {
        body: { title, amount: Number(amount), due_date: due || null, class_id: scope === "class" ? Number(target) : undefined, student_id: scope === "student" ? Number(target) : undefined },
      });
      onSaved(r.created);
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={t("newInvoice")} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label={t("billTo")}>
          <select value={scope} onChange={(e) => { setScope(e.target.value as typeof scope); setTarget(""); }}>
            <option value="class">{t("wholeClass")}</option>
            <option value="student">{t("oneStudent")}</option>
            <option value="all">{t("allStudents")}</option>
          </select>
        </Field>
        {scope === "class" && (
          <Field label={t("class")}>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t("select")}</option>
              {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
            </select>
          </Field>
        )}
        {scope === "student" && (
          <Field label={t("name")}>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t("select")}</option>
              {students.data?.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
          </Field>
        )}
        <Field label={t("title")}><input value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <div className="grid2">
          <Field label={t("amount")}><input type="number" min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label={t("dueDate")}><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </div>
        <ErrorNote msg={error} />
        <div className="row gap end">
          <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
          <button className="btn primary">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

function PayModal({ invoice, onClose, onSaved }: { invoice: Invoice; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const balance = invoice.amount - invoice.paid;
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState("Cash");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayIso());
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api("/payments", { body: { invoice_id: invoice.id, amount: Number(amount), method, reference: reference || null, paid_on: paidOn } });
      onSaved();
    } catch (err) { setError((err as Error).message); }
  };

  return (
    <Modal title={`${t("recordPayment")} — ${invoice.full_name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <p className="muted">{invoice.title} · {t("balance")}: <strong>{money(balance)}</strong></p>
        <div className="grid2">
          <Field label={t("amount")}><input type="number" min="1" max={balance} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label={t("date")}><input type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} required /></Field>
        </div>
        <div className="grid2">
          <Field label={t("method")}>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="Cash">{t("cash")}</option>
              <option value="Bank">{t("bank")}</option>
              <option value="Telebirr">{t("mobile")}</option>
            </select>
          </Field>
          <Field label={t("reference")}><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        </div>
        <ErrorNote msg={error} />
        <div className="row gap end">
          <button type="button" className="btn" onClick={onClose}>{t("cancel")}</button>
          <button className="btn primary">{t("save")}</button>
        </div>
      </form>
    </Modal>
  );
}

function History({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { t, date } = useI18n();
  const { data } = useLoad(() => api<Payment[]>(`/payments/${invoice.id}`), [invoice.id]);
  return (
    <Modal title={`${t("history")} — ${invoice.full_name}`} onClose={onClose}>
      {!data || data.length === 0 ? <Empty /> : (
        <table>
          <thead><tr><th>{t("date")}</th><th className="num">{t("amount")}</th><th>{t("method")}</th><th>{t("reference")}</th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}><td>{date(p.paid_on)}</td><td className="num">{money(p.amount)}</td><td>{p.method}</td><td className="mono">{p.reference ?? "—"}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
