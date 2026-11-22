import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mic, Keyboard } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MODES, type Mode, type Summary } from "@/lib/examiner";
import { fmtScore } from "@/lib/client";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function Report({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser(`/app/viva/${id}/report`);
  const s = await db.session.findFirst({
    where: { id, userId: u.id },
    include: {
      subject: { select: { id: true, title: true } },
      turns: {
        where: { status: "graded" },
        orderBy: [{ idx: "asc" }, { createdAt: "asc" }],
        include: { chunk: { select: { topic: true, page: true, source: { select: { title: true } } } } },
      },
    },
  });
  if (!s) notFound();
  const summary: Summary | null = s.summary ? JSON.parse(s.summary) : null;
  const total = s.score ?? (s.turns.length ? s.turns.reduce((a, t) => a + (t.score ?? 0), 0) / s.turns.length : 0);
  let qn = 0;

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/app/s/${s.subject.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {s.subject.title}
        </Link>
        <PrintButton />
      </div>

      <article className="mt-5 overflow-hidden rounded-[16px] border border-rule bg-sheet shadow-[0_30px_60px_-40px_rgb(28_34_48/0.6)]">
        <header className="grid gap-6 border-b-2 border-double border-rule px-8 py-7 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="label">Answer script</p>
            <h1 className="mt-2 font-serif text-3xl font-medium leading-tight">{s.subject.title}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <Meta k="Candidate" v={u.name} />
              <Meta k="Mode" v={MODES[s.mode as Mode]?.label ?? s.mode} />
              <Meta k="Examiner" v={s.strictness} />
              <Meta k="Date" v={s.startedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
            </dl>
          </div>
          <div className="flex flex-col items-center justify-center px-4">
            <span className="pen-circle text-[56px] font-bold leading-none">{fmtScore(Number(total.toFixed(1)))}</span>
            <span className="mt-3 font-hand text-xl text-pen">out of 10</span>
          </div>
        </header>

        {summary ? (
          <section className="border-b border-rule bg-[#fffdf8] px-8 py-6">
            <p className="font-serif text-[21px] italic leading-snug">&ldquo;{summary.headline}&rdquo;</p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              {summary.strengths?.length ? (
                <div>
                  <p className="label">Keep doing</p>
                  <ul className="mt-2 space-y-1 font-hand text-[21px] leading-7 text-tick">
                    {summary.strengths.map((x, i) => <li key={i}>✓ {x}</li>)}
                  </ul>
                </div>
              ) : null}
              {summary.fixes?.length ? (
                <div>
                  <p className="label">Revise tonight</p>
                  <ul className="mt-2 space-y-1 font-hand text-[21px] leading-7 text-pen">
                    {summary.fixes.map((x, i) => <li key={i}>→ {x}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
            {summary.nextStep ? <p className="mt-4 text-sm text-ink-2"><span className="font-semibold">Next step:</span> {summary.nextStep}</p> : null}
          </section>
        ) : null}

        <ol>
          {s.turns.map((t) => {
            if (t.kind === "main") qn++;
            const got: string[] = JSON.parse(t.got ?? "[]");
            const missed: string[] = JSON.parse(t.missed ?? "[]");
            return (
              <li key={t.id} className="ruled grid border-b border-rule sm:grid-cols-[1fr_200px]">
                <div className="py-5 pl-[72px] pr-6">
                  <p className="label">
                    {t.kind === "followup" ? `Q${qn} follow-up` : `Q${qn}`} · {t.chunk.topic}
                  </p>
                  <p className="mt-1 font-serif text-[18px] font-medium leading-8">{t.question}</p>
                  <p className="font-serif text-[18px] leading-8 text-navy">
                    {t.answer && !/^i don'?t know$/i.test(t.answer.trim()) ? t.answer : <span className="italic text-muted">Passed</span>}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                    {t.spoken ? <Mic className="h-3 w-3" /> : <Keyboard className="h-3 w-3" />}
                    {t.spoken ? "Spoken" : "Typed"} in {t.seconds ?? 0}s
                  </p>
                  {t.evidence ? (
                    <p className="mt-3 rounded-lg border border-rule bg-sheet/95 px-3 py-2 text-[14px] leading-6 text-ink-2">
                      <span className="label mr-2">{t.chunk.source.title}, p.{t.chunk.page}</span>
                      &ldquo;<span className="hl">{t.evidence}</span>&rdquo;
                    </p>
                  ) : null}
                </div>
                <aside className="border-l border-dashed border-pen/40 px-5 py-5">
                  <span className="pen-circle ml-3 inline-block text-[30px] font-bold leading-none">{fmtScore(t.score)}</span>
                  <ul className="mt-5 space-y-1 font-hand text-[18px] leading-6">
                    {got.map((g, i) => (
                      <li key={`g${i}`} className="text-tick">✓ {g}</li>
                    ))}
                    {missed.map((g, i) => (
                      <li key={`m${i}`} className="text-pen">✗ {g}</li>
                    ))}
                  </ul>
                </aside>
              </li>
            );
          })}
        </ol>
        {s.turns.length === 0 ? <p className="px-8 py-10 text-center text-ink-2">No answers were marked in this viva.</p> : null}
      </article>

      <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
        <Link href={`/app/s/${s.subject.id}`} className="btn btn-ink">Run another viva</Link>
        <Link href="/app" className="btn btn-line">Back to desk</Link>
      </div>
    </main>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="label">{k}</dt>
      <dd className="mt-0.5 capitalize">{v}</dd>
    </div>
  );
}
