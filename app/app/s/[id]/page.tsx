import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, FileText, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { mastery } from "@/lib/schedule";
import { daysUntil, fmtScore, scoreTone } from "@/lib/client";
import { MODES, type Mode } from "@/lib/examiner";
import { provider } from "@/lib/ai";
import { StartViva } from "@/components/StartViva";
import { NotesPanel } from "@/components/NotesPanel";

export const dynamic = "force-dynamic";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser(`/app/s/${id}`);
  const s = await db.subject.findFirst({
    where: { id, userId: u.id },
    include: {
      sources: { orderBy: { createdAt: "asc" }, include: { _count: { select: { chunks: true } } } },
      chunks: { select: { id: true, topic: true, reviews: true, lastScore: true, dueAt: true, page: true } },
      sessions: { where: { status: "done" }, orderBy: { startedAt: "desc" }, take: 8, include: { _count: { select: { turns: true } } } },
    },
  });
  if (!s) notFound();
  const topics = mastery(s.chunks).sort((a, b) => (a.avg ?? 11) - (b.avg ?? 11));
  const now = new Date();
  const due = s.chunks.filter((c) => c.reviews > 0 && c.dueAt && c.dueAt <= now).length;
  const d = daysUntil(s.examDate);
  const ai = provider();

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Desk
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h1 className="max-w-3xl font-serif text-[38px] font-medium leading-tight">{s.title}</h1>
        {d != null ? (
          <span className={`stamp ${d <= 3 ? "text-pen" : "text-navy"}`}>
            <CalendarClock className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
            {d > 1 ? `Viva in ${d} days` : d === 1 ? "Viva tomorrow" : d === 0 ? "Viva today" : "Viva date passed"}
          </span>
        ) : null}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <StartViva subjectId={s.id} ready={s.chunks.length > 0} due={due} aiName={ai.name} />
        <NotesPanel
          subjectId={s.id}
          sources={s.sources.map((x) => ({ id: x.id, title: x.title, kind: x.kind, pages: x.pages, chunks: x._count.chunks }))}
        />
      </div>

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-medium">Topic map</h2>
          <p className="text-sm text-muted">Weakest first. Colours show your latest marks.</p>
        </div>
        {topics.length === 0 ? (
          <p className="mt-3 text-ink-2">Topics appear after you add notes.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topics.map((t) => (
              <div key={t.topic} className="card flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{t.topic}</p>
                  <p className="text-xs text-muted">
                    {t.seen}/{t.total} passage{t.total === 1 ? "" : "s"} asked
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-sm ${scoreTone(t.avg)}`}>
                  {t.avg == null ? "new" : `${fmtScore(t.avg)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 mb-10">
        <h2 className="font-serif text-2xl font-medium">Past vivas</h2>
        {s.sessions.length === 0 ? (
          <p className="mt-3 text-ink-2">None yet. Your first one takes about five minutes.</p>
        ) : (
          <div className="card mt-4 divide-y divide-rule">
            {s.sessions.map((x) => (
              <Link key={x.id} href={`/app/viva/${x.id}/report`} className="flex items-center justify-between px-5 py-3.5 hover:bg-fold/50">
                <span className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted" />
                  <span>
                    {MODES[x.mode as Mode]?.label} · {x._count.turns} questions ·{" "}
                    <span className="text-muted">{x.startedAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  </span>
                </span>
                <span className={`rounded-full px-3 py-0.5 font-mono text-sm ${scoreTone(x.score)}`}>{fmtScore(x.score == null ? null : Number(x.score.toFixed(1)))}/10</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
