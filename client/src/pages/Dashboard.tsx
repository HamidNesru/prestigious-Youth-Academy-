import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Card, ErrorNote, PageHeader, Stat, money, useLoad } from "../ui";

interface Staff {
  students: number; classes: number; unread: number; teachers?: number;
  attendanceToday: { status: string; c: number }[];
  fees?: { billed: number; paid: number; outstanding: number };
}
interface ParentDash {
  unread: number;
  children: { id: number; full_name: string; cls: string | null; section: string | null; balance: number; absences: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t, date } = useI18n();
  const { data, error } = useLoad(() => api<Staff & ParentDash>("/dashboard"), []);
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader title={`${t("welcome")}, ${user?.name}`}>
        <span className="muted">{date(todayIso)}</span>
      </PageHeader>
      <ErrorNote msg={error} />
      {data && user?.role !== "parent" && (
        <>
          <div className="stats">
            <Stat label={t("totalStudents")} value={data.students} />
            <Stat label={t("totalClasses")} value={data.classes} />
            {data.teachers !== undefined && <Stat label={t("totalTeachers")} value={data.teachers} />}
            <Stat label={t("unreadMessages")} value={data.unread} tone={data.unread ? "warn" : undefined} />
          </div>
          <div className="grid2">
            <Card>
              <h3>{t("attendanceToday")}</h3>
              {data.attendanceToday.length === 0 ? (
                <p className="muted">{t("notTakenYet")}</p>
              ) : (
                <div className="stats tight">
                  {data.attendanceToday.map((a) => (
                    <Stat key={a.status} label={t(a.status as "present")} value={a.c} tone={a.status === "present" ? "good" : a.status === "absent" ? "bad" : "warn"} />
                  ))}
                </div>
              )}
              <Link className="btn" to="/attendance">{t("attendance")} →</Link>
            </Card>
            {data.fees && (
              <Card>
                <h3>{t("fees")}</h3>
                <div className="stats tight">
                  <Stat label={t("billed")} value={money(data.fees.billed)} />
                  <Stat label={t("collected")} value={money(data.fees.paid)} tone="good" />
                  <Stat label={t("outstanding")} value={money(data.fees.outstanding)} tone={data.fees.outstanding ? "warn" : "good"} />
                </div>
                <Link className="btn" to="/fees">{t("fees")} →</Link>
              </Card>
            )}
          </div>
        </>
      )}
      {data && user?.role === "parent" && (
        <>
          <h3>{t("myChildren")}</h3>
          <div className="grid2">
            {data.children.map((c) => (
              <Card key={c.id}>
                <h3>{c.full_name}</h3>
                <div className="muted">{c.cls} {c.section}</div>
                <div className="stats tight">
                  <Stat label={t("balanceDue")} value={money(c.balance)} tone={c.balance > 0 ? "warn" : "good"} />
                  <Stat label={t("absences")} value={c.absences} tone={c.absences > 2 ? "bad" : undefined} />
                </div>
                <Link className="btn" to={`/report/${c.id}`}>{t("viewReport")} →</Link>
              </Card>
            ))}
          </div>
          {data.unread > 0 && (
            <Link className="btn primary" to="/messages">{t("unreadMessages")}: {data.unread}</Link>
          )}
        </>
      )}
    </>
  );
}
