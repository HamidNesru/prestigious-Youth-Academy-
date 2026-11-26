import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useI18n, type Key } from "../i18n";
import { ErrorNote, PageHeader, useLoad } from "../ui";

interface Report {
  student: { id: number; full_name: string; student_code: string; class_name: string | null; section: string | null; school_name: string; city: string };
  term: number;
  subjects: { id: number; name: string; name_am: string | null; score: number | null }[];
  total: number; average: number | null; rank: number | null; classSize: number;
  attendance: { status: string; c: number }[];
}

export const remarkKey = (avg: number): Key =>
  avg >= 90 ? "excellent" : avg >= 75 ? "veryGood" : avg >= 60 ? "good" : avg >= 50 ? "satisfactory" : "needsHelp";

export default function ReportCard() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const [term, setTerm] = useState(sp.get("term") === "2" ? "2" : "1");
  const { t, lang, date } = useI18n();
  const { data, error } = useLoad(() => api<Report>(`/report-card/${id}?term=${term}`), [id, term]);

  const att = (s: string) => data?.attendance.find((a) => a.status === s)?.c ?? 0;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={t("reportCard")}>
        <select value={term} onChange={(e) => setTerm(e.target.value)}>
          <option value="1">{t("semester1")}</option>
          <option value="2">{t("semester2")}</option>
        </select>
        <button className="btn primary" onClick={() => window.print()}>{t("print")}</button>
      </PageHeader>
      <ErrorNote msg={error} />
      {data && (
        <div className="paper">
          <div className="paper-head">
            <h2>{data.student.school_name}</h2>
            <div className="muted">{data.student.city}</div>
            <h3>{t("reportCard")} — {t(term === "1" ? "semester1" : "semester2")}</h3>
          </div>
          <div className="paper-meta">
            <div><span className="muted">{t("name")}:</span> <strong>{data.student.full_name}</strong></div>
            <div><span className="muted">{t("code")}:</span> {data.student.student_code}</div>
            <div><span className="muted">{t("class")}:</span> {data.student.class_name} {data.student.section}</div>
            <div><span className="muted">{t("date")}:</span> {date(today)}</div>
          </div>
          <table>
            <thead><tr><th>{t("subject")}</th><th className="num">{t("score")}</th><th>{t("remark")}</th></tr></thead>
            <tbody>
              {data.subjects.map((s) => (
                <tr key={s.id}>
                  <td>{lang === "am" && s.name_am ? s.name_am : s.name}</td>
                  <td className="num">{s.score ?? "—"}</td>
                  <td>{s.score === null ? "" : t(remarkKey(s.score))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>{t("total")}</td><td className="num">{data.total}</td><td /></tr>
              <tr><td>{t("average")}</td><td className="num">{data.average === null ? "—" : data.average.toFixed(1)}</td><td>{data.average === null ? "" : t(remarkKey(data.average))}</td></tr>
              <tr><td>{t("rank")}</td><td className="num">{data.rank ? `${data.rank} / ${data.classSize}` : "—"}</td><td /></tr>
            </tfoot>
          </table>
          <div className="paper-meta">
            <div><span className="muted">{t("attendanceSummary")}:</span> {t("present")} {att("present")} · {t("absent")} {att("absent")} · {t("late")} {att("late")} · {t("excused")} {att("excused")}</div>
          </div>
          <div className="signs">
            <div>{t("teacherSign")}</div><div>{t("parentSign")}</div><div>{t("principal")}</div>
          </div>
        </div>
      )}
    </>
  );
}
