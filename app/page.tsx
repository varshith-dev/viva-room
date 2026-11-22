import Link from "next/link";
import { redirect } from "next/navigation";
import { Mic, FileText, Repeat2, Quote, MessageSquareMore, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { GuestButton } from "@/components/GuestButton";
import { currentUser } from "@/lib/auth";

export default async function Landing() {
  if (await currentUser()) redirect("/app");
  return (
    <div className="grain min-h-screen">
      <header className="mx-auto flex h-20 max-w-6xl items-center justify-between px-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-line">Create account</Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-8 md:grid-cols-[1.05fr_1fr] md:pt-14">
          <div className="rise">
            <p className="label mb-5">For lab vivas, oral exams and interviews</p>
            <h1 className="font-serif text-[44px] leading-[1.02] font-medium tracking-tight text-ink sm:text-[60px]">
              Your viva is on Friday.
              <br />
              <span className="italic text-navy">Rehearse it tonight.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-ink-2">
              Upload your class notes. An examiner asks you questions out loud, listens to your spoken answer, marks it like an
              answer script, and points to the exact line in your notes you missed. The points you get wrong come back until you
              get them right.
            </p>
            <div className="mt-9 flex flex-wrap items-start gap-3">
              <GuestButton />
              <Link href="/signup" className="btn btn-line">Use my own notes</Link>
            </div>
            <p className="mt-4 text-sm text-muted">No sign up needed for the sample. Works best in Chrome or Edge for voice.</p>
          </div>

          <MockScript />
        </section>

        <section className="border-y border-rule bg-sheet/70">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-3">
            {[
              {
                n: "Q1",
                icon: FileText,
                t: "Drop in your notes",
                d: "PDF, text or pasted notes. Viva Room splits them into passages and labels each one by topic, the way your syllabus would.",
              },
              {
                n: "Q2",
                icon: Mic,
                t: "Answer out loud",
                d: "The examiner reads each question to you. Speak your answer like you would across the table, or type it if you are in a library.",
              },
              {
                n: "Q3",
                icon: Repeat2,
                t: "Get marked, then drilled",
                d: "A mark out of 10, what you got, what you missed, and the line from your notes. Weak passages come back in the next viva.",
              },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="flex items-baseline gap-3">
                  <span className="font-hand text-3xl text-pen">{s.n}.</span>
                  <h3 className="font-serif text-2xl font-medium">{s.t}</h3>
                </div>
                <p className="mt-3 leading-relaxed text-ink-2">{s.d}</p>
                <s.icon className="absolute right-0 top-1 h-5 w-5 text-muted" />
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="max-w-2xl font-serif text-4xl font-medium leading-tight">
            Flashcards test whether you remember. A viva tests whether you can <span className="italic">explain</span>.
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <Feature icon={Quote} title="Marked against your notes, not the internet">
              Every mark comes with a quote from your own notes. Viva Room checks that the quote really exists in your file before
              it shows it, and tells you when it couldn&apos;t find one.
            </Feature>
            <Feature icon={MessageSquareMore} title="Follow-up questions, like a real examiner">
              Half right? The examiner probes the gap with one follow-up, the same way a professor does when you start strong and
              then go vague.
            </Feature>
            <Feature icon={ShieldCheck} title="Three modes, three examiners">
              Lab viva for &ldquo;what happens if&rdquo;, theory viva for explain and compare, rapid fire for the night before. Pick
              a kind, fair or strict examiner.
            </Feature>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between">
          <span>Viva Room, built by Paladugu Varshith Chowdary for Build Your First AI App 2026.</span>
          <a className="underline-offset-4 hover:underline" href="https://github.com/varshith-dev/viva-room">Source on GitHub</a>
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <Icon className="h-5 w-5 text-pen" />
      <h3 className="mt-4 font-serif text-xl font-medium leading-snug">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

function MockScript() {
  return (
    <div className="relative rise" style={{ animationDelay: "120ms" }}>
      <div className="absolute -left-4 -top-4 h-full w-full rotate-[-2.5deg] rounded-[14px] border border-rule bg-fold" />
      <div className="ruled relative overflow-hidden rounded-[14px] border border-rule shadow-[0_30px_60px_-35px_rgb(28_34_48/0.55)]">
        <div className="flex items-center justify-between border-b border-rule bg-sheet px-6 py-3">
          <span className="label">Answer script · OS Unit 3</span>
          <span className="stamp text-navy">Theory viva</span>
        </div>
        <div className="space-y-0 py-4 pl-[72px] pr-6 text-[15px] leading-8">
          <p className="font-serif text-[17px] font-medium text-ink">Q2. What happens to round robin if the time quantum is very small?</p>
          <p className="font-hand text-[23px] leading-8 text-navy">it becomes faster since processes switch quickly and nobody waits long</p>
          <div className="relative flex items-start justify-between gap-4 pt-3">
            <div className="space-y-1">
              <p className="font-hand text-[21px] leading-7 text-tick">✓ processes switch more often</p>
              <p className="font-hand text-[21px] leading-7 text-pen">✗ context switch overhead takes over</p>
              <p className="font-hand text-[21px] leading-7 text-pen">✗ too large a quantum = FCFS</p>
            </div>
            <span className="pen-circle mr-3 mt-1 shrink-0 text-[34px] font-bold leading-none">3/10</span>
          </div>
          <div className="mt-4 rounded-lg border border-rule bg-sheet/90 p-3 text-[14px] leading-6">
            <span className="label">From your notes, page 3</span>
            <p className="mt-1 text-ink-2">
              &ldquo;<span className="hl">If the quantum is very small, the CPU spends too much time on context switches.</span>&rdquo;
            </p>
          </div>
          <p className="pt-3 font-serif italic text-ink-2">Examiner: &ldquo;Smaller isn&apos;t faster here. What does the CPU do at every switch?&rdquo;</p>
        </div>
      </div>
    </div>
  );
}
