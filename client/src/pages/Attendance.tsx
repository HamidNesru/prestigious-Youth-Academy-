import { useEffect, useState } from "react";
import { api, type ClassRow } from "../api";
import { todayIso } from "../ethcal";
import { useI18n } from "../i18n";
import { Card, Empty, ErrorNote, PageHeader, useLoad, useToast } from "../ui";

type Status = "present" | "absent" | "late" | "excused";
const STATUSES: Status[] = ["present", "absent", "late", "excused"];
interface Row { student_id: number; full_name: string; student_code: string; status: Status | null }

export default function Attendance() {
  const { t, date: fmt } = useI18n();
  const toast = useToast();
  const classes = useLoad(() => api<ClassRow[]>("/classes"), []);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!classId && classes.data?.length) setClassId(String(classes.data[0].id));
  }, [classes.data, classId]);

  useEffect(() => {
    if (!classId) return;
    api<Row[]>(`/attendance?classId=${classId}&date=${date}`).then((r) => { setRows(r); setError(""); }).catch((e: Error) => setError(e.message));
  }, [classId, date]);

  const setStatus = (id: number, s: Status) => setRows((rs) => rs.map((r) => (r.student_id === id ? { ...r, status: s } : r)));
  const markAll = () => setRows((rs) => rs.map((r) => ({ ...r, status: "present" })));

  const save = async () => {
    setSaving(true);
    try {
      await api("/attendance", { body: { classId: Number(classId), date, records: rows.filter((r) => r.status).map((r) => ({ student_id: r.student_id, status: r.status })) } });
      toast.show(t("saved"));
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const counts = STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));

  return (
    <>
      <PageHeader title={t("attendance")}>
        <button className="btn" onClick={markAll}>{t("markAllPresent")}</button>
        <button className="btn primary" onClick={save} disabled={saving || rows.length === 0}>{t("save")}</button>
      </PageHeader>
      <div className="row gap wrap filters">
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </select>
        <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        <span className="muted">{fmt(date)}</span>
        <div className="row gap push-right">
          {counts.map(({ s, n }) => <span key={s} className={`pill ${s}`}>{t(s)}: {n}</span>)}
        </div>
      </div>
      <ErrorNote msg={error} />
      <Card className="table-card">
        {rows.length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>{t("code")}</th><th>{t("name")}</th><th>{t("status")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student_id}>
                  <td className="mono">{r.student_code}</td>
                  <td><strong>{r.full_name}</strong></td>
                  <td>
                    <div className="seg" role="radiogroup" aria-label={r.full_name}>
                      {STATUSES.map((s) => (
                        <button key={s} type="button" role="radio" aria-checked={r.status === s}
                          className={`seg-btn ${s} ${r.status === s ? "on" : ""}`} onClick={() => setStatus(r.student_id, s)}>
                          {t(s)}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {toast.node}
    </>
  );
}
