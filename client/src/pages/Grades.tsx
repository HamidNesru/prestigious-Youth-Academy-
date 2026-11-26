import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ClassRow, type Subject } from "../api";
import { useI18n } from "../i18n";
import { Card, Empty, ErrorNote, PageHeader, useLoad, useToast } from "../ui";

interface Row { student_id: number; full_name: string; student_code: string; score: number | null }

export default function Grades() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const classes = useLoad(() => api<ClassRow[]>("/classes"), []);
  const subjects = useLoad(() => api<Subject[]>("/subjects"), []);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState("1");
  const [rows, setRows] = useState<{ id: number; name: string; code: string; score: string }[]>([]);
  const [error, setError] = useState("");

  useEffect(() => { if (!classId && classes.data?.length) setClassId(String(classes.data[0].id)); }, [classes.data, classId]);
  useEffect(() => { if (!subjectId && subjects.data?.length) setSubjectId(String(subjects.data[0].id)); }, [subjects.data, subjectId]);

  useEffect(() => {
    if (!classId || !subjectId) return;
    api<Row[]>(`/grades?classId=${classId}&subjectId=${subjectId}&term=${term}`)
      .then((r) => { setRows(r.map((x) => ({ id: x.student_id, name: x.full_name, code: x.student_code, score: x.score === null ? "" : String(x.score) }))); setError(""); })
      .catch((e: Error) => setError(e.message));
  }, [classId, subjectId, term]);

  const invalid = (s: string) => s !== "" && (!Number.isFinite(Number(s)) || Number(s) < 0 || Number(s) > 100);
  const hasInvalid = rows.some((r) => invalid(r.score));

  const save = async () => {
    try {
      await api("/grades", {
        body: { classId: Number(classId), subjectId: Number(subjectId), term: Number(term), records: rows.map((r) => ({ student_id: r.id, score: r.score === "" ? null : Number(r.score) })) },
      });
      toast.show(t("saved"));
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <>
      <PageHeader title={t("grades")}>
        <button className="btn primary" onClick={save} disabled={hasInvalid || rows.length === 0}>{t("save")}</button>
      </PageHeader>
      <div className="row gap wrap filters">
        <select value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.data?.map((c) => <option key={c.id} value={c.id}>{c.name} {c.section}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          {subjects.data?.map((s) => <option key={s.id} value={s.id}>{lang === "am" && s.name_am ? s.name_am : s.name}</option>)}
        </select>
        <select value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="1">{t("semester1")}</option>
          <option value="2">{t("semester2")}</option>
        </select>
      </div>
      <ErrorNote msg={error} />
      <Card className="table-card">
        {rows.length === 0 ? <Empty /> : (
          <table>
            <thead><tr><th>{t("code")}</th><th>{t("name")}</th><th>{t("score")}</th><th /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="mono">{r.code}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>
                    <input className={`score ${invalid(r.score) ? "bad" : ""}`} inputMode="decimal" value={r.score} aria-label={r.name}
                      onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, score: e.target.value } : x)))} />
                  </td>
                  <td className="actions"><Link className="link-btn" to={`/report/${r.id}?term=${term}`}>{t("reportCard")}</Link></td>
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
