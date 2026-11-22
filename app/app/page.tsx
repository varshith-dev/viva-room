import Link from "next/link";
import { CalendarClock, ChevronRight, FileStack } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { mastery } from "@/lib/schedule";
import { daysUntil, fmtScore, scoreTone } from "@/lib/client";
import { NewSubject } from "@/components/NewSubject";
import { MODES, type Mode } from "@/lib/examiner";

export const dynamic = "force-dynamic";

export default async function Desk() {
  const u = await requireUser();
  const subjects = await db.subject.findMany({
    where: { userId: u.id },
    orderBy: { createdAt: "desc" },
    include: {
      chunks: { select: { topic: true, reviews: true, lastScore: true, dueAt: true } },
      _count: { select: { sources: true, sessions: true } },
    },
  });
  const sessions = await db.session.findMany({
    where: { userId: u.id, status: "done" },
    orderBy: { startedAt: "desc" },
    take: 6,
    include: { subject: { select: { title: true } }, _count: { select: { turns: true } } },
  });
  const now = new Date();

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label">Your exam desk</p>
          <h1 className="mt-2 font-serif text-4xl font-medium">Hi {u.name.split(" ")[0]}, what are we rehearsing?</h1>
        </div>
        <NewSubject />
      </div>

      {subjects.length === 0 ? (
        <div className="card mt-10 p-10 text-center">
          <FileStack className="mx-auto h-8 w-8 text-muted" />
          <h2 className="mt-4 font-serif text-2xl">No subjects yet</h2>
          <p className="mt-2 text-ink-2">Add a subject, then upload the notes you want to be examined on.</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {subjects.map((s) => {
            const m = mastery(s.chunks);
            const seen = s.chunks.filter((c) => c.reviews > 0);
            const avg = seen.length ? seen.reduce((a, c) => a + (c.lastScore ?? 0), 0) / seen.length : null;
            const due = s.chunks.filter((c) => c.reviews > 0 && c.dueAt && c.dueAt <= now).length;
            const d = daysUntil(s.examDate);
            const cover = s.chunks.length ? Math.round((seen.length / s.chunks.length) * 100) : 0;
            return (
              <Link key={s.id} href={`/app/s/${s.id}`} className="card group relative block overflow-hidden p-6 transition hover:-translate-y-0.5">
                <div className="absolute right-0 top-0 h-full w-1.5 bg-pen/70" />
                <div className="flex items-start justify-between gap-4">
                  <h2 className="font-serif text-[22px] font-medium leading-snug">{s.title}</h2>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
                  <span>{s._count.sources} file{s._count.sources === 1 ? "" : "s"} · {s.chunks.length} passages · {m.length} topics</span>
                  {d != null ? (
                    <span className={`inline-flex items-center gap-1.5 ${d <= 3 ? "text-pen" : ""}`}>
                      <CalendarClock className="h-4 w-4" />
                      {d > 1 ? `Exam in ${d} days` : d === 1 ? "Exam tomorrow" : d === 0 ? "Exam today" : "Exam passed"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 border-t border-rule pt-4">
                  <Stat label="Average mark" value={avg == null ? "–" : `${fmtScore(Number(avg.toFixed(1)))}/10`} />
                  <Stat label="Covered" value={`${cover}%`} />
                  <Stat label="Due to revise" value={String(due)} accent={due > 0} />
                </div>
                <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-fold">
                  {m.map((t) => (
                    <span
                      key={t.topic}
                      title={`${t.topic}: ${t.avg ?? "not asked yet"}`}
                      style={{ flex: t.total }}
                      className={`border-r border-sheet last:border-0 ${t.avg == null ? "bg-fold" : t.avg >= 7.5 ? "bg-tick" : t.avg >= 4.5 ? "bg-hl" : "bg-pen"}`}
                    />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <section className="mt-14">
        <h2 className="font-serif text-2xl font-medium">Recent vivas</h2>
        {sessions.length === 0 ? (
          <p className="mt-3 text-ink-2">Your finished vivas will show up here.</p>
        ) : (
          <div className="card mt-4 divide-y divide-rule">
            {sessions.map((s) => (
              <Link key={s.id} href={`/app/viva/${s.id}/report`} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-fold/50">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.subject.title}</p>
                  <p className="text-sm text-muted">
                    {MODES[s.mode as Mode]?.label ?? s.mode} · {s._count.turns} questions ·{" "}
                    {s.startedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 font-mono text-sm ${scoreTone(s.score)}`}>{fmtScore(s.score == null ? null : Number(s.score.toFixed(1)))}/10</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`mt-1 font-serif text-2xl ${accent ? "text-pen" : ""}`}>{value}</p>
    </div>
  );
}
