"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CornerDownLeft, Loader2, Mic, MicOff, Square, Volume2, VolumeX, X } from "lucide-react";
import { post, fmtScore } from "@/lib/client";

type Q = { id: string; idx: number; kind: string; question: string };
type Result = {
  id: string;
  score: number | null;
  verdict: string | null;
  got: string[];
  missed: string[];
  modelAnswer: string | null;
  evidence: string | null;
  evidenceVerified: boolean;
};
type Reply = { result: Result; next: Q | null; done: boolean };

// Minimal typing for the Web Speech API, which is not in the DOM lib yet.
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function VivaRoom(props: {
  sessionId: string;
  subject: { id: string; title: string };
  modeLabel: string;
  strictness: string;
  length: number;
  mainsDone: number;
  initial: Q | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState<Q | null>(props.initial);
  const [mains, setMains] = useState(props.mainsDone);
  const [answer, setAnswer] = useState("");
  const [interim, setInterim] = useState("");
  const [phase, setPhase] = useState<"answer" | "marking" | "marked">("answer");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState<Reply | null>(null);
  const [err, setErr] = useState("");
  const [voice, setVoice] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(true);
  const [spoken, setSpoken] = useState(false);
  const [secs, setSecs] = useState(0);
  const rec = useRef<Rec | null>(null);
  const base = useRef("");

  useEffect(() => {
    setVoice(localStorage.getItem("viva-voice") !== "off");
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const say = useCallback(
    (text: string) => {
      if (!voice || typeof speechSynthesis === "undefined") return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const vs = speechSynthesis.getVoices();
      u.voice = vs.find((v) => v.lang === "en-IN") ?? vs.find((v) => v.lang.startsWith("en-GB")) ?? vs.find((v) => v.lang.startsWith("en")) ?? null;
      u.rate = 0.98;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      speechSynthesis.speak(u);
    },
    [voice],
  );

  // read each new question aloud and restart the answer timer
  useEffect(() => {
    if (!q) return;
    setSecs(0);
    const t = setTimeout(() => say(q.question), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  useEffect(() => {
    if (phase !== "answer") return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase, q?.id]);

  const stopMic = useCallback(() => {
    rec.current?.stop();
    rec.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const startMic = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) return;
    speechSynthesis?.cancel();
    const r = new C();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = true;
    base.current = answer ? answer.trimEnd() + " " : "";
    r.onresult = (e) => {
      let fin = "";
      let mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else mid += res[0].transcript;
      }
      if (fin) {
        base.current = (base.current + fin).replace(/\s+/g, " ").trimStart() + " ";
        setAnswer(base.current);
      }
      setInterim(mid);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") setErr("Microphone access was blocked. Allow it in the address bar, or type your answer.");
      stopMic();
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
    };
    r.start();
    rec.current = r;
    setListening(true);
    setSpoken(true);
  }, [answer, stopMic]);

  async function submit(text: string) {
    if (!q || phase !== "answer") return;
    stopMic();
    speechSynthesis?.cancel();
    setPhase("marking");
    setErr("");
    try {
      const reply = await post<Reply>(`/api/sessions/${props.sessionId}/answer`, {
        turnId: q.id,
        answer: text,
        seconds: secs,
        spoken,
      });
      setResult(reply.result);
      setPending(reply);
      if (q.kind === "main") setMains((m) => m + 1);
      setPhase("marked");
      if (reply.result.verdict) say(reply.result.verdict);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't mark that. Try again.");
      setPhase("answer");
    }
  }

  function next() {
    speechSynthesis?.cancel();
    if (!pending) return;
    if (pending.done || !pending.next) {
      router.push(`/app/viva/${props.sessionId}/report`);
      return;
    }
    setQ(pending.next);
    setAnswer("");
    setSpoken(false);
    setResult(null);
    setPending(null);
    setPhase("answer");
  }

  async function end() {
    stopMic();
    speechSynthesis?.cancel();
    setPhase("marking");
    await post(`/api/sessions/${props.sessionId}/finish`).catch(() => null);
    router.push(`/app/viva/${props.sessionId}/report`);
  }

  const qNumber = Math.min(q?.kind === "followup" ? mains : mains + (phase === "marked" && q?.kind === "main" ? 0 : 1), props.length);
  const mm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  if (!q) {
    return (
      <main className="mx-auto max-w-xl px-5 py-24 text-center">
        <p className="font-serif text-2xl">This viva has no open question.</p>
        <button className="btn btn-ink mt-6" onClick={end}>See the report</button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-20 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/app/s/${props.subject.id}`} className="block truncate text-sm text-muted hover:text-ink">
            {props.subject.title}
          </Link>
          <p className="label mt-0.5">
            {props.modeLabel} · {props.strictness} examiner
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost px-2.5"
            title={voice ? "Mute the examiner" : "Let the examiner speak"}
            onClick={() => {
              const v = !voice;
              setVoice(v);
              localStorage.setItem("viva-voice", v ? "on" : "off");
              if (!v) speechSynthesis?.cancel();
            }}
          >
            {voice ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button className="btn btn-ghost text-sm" onClick={end} disabled={phase === "marking"}>
            <Square className="h-3.5 w-3.5" /> End viva
          </button>
        </div>
      </div>

      {/* progress ticks */}
      <div className="mt-5 flex gap-1.5">
        {Array.from({ length: props.length }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < mains ? "bg-ink" : i === mains ? "bg-pen/70" : "bg-fold"}`} />
        ))}
      </div>

      <section key={q.id} className="card rise mt-6 p-7">
        <div className="flex items-center justify-between">
          <p className="label flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${speaking ? "bg-pen animate-pulse" : "bg-ink-2/40"}`} />
            Examiner · {q.kind === "followup" ? "Follow-up" : `Question ${qNumber} of ${props.length}`}
          </p>
          {phase === "answer" ? <span className="font-mono text-sm text-muted">{mm}</span> : null}
        </div>
        <h1 className="mt-4 font-serif text-[28px] font-medium leading-[1.25] text-ink sm:text-[31px]">{q.question}</h1>
        {voice ? (
          <button className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink" onClick={() => say(q.question)}>
            <Volume2 className="h-3.5 w-3.5" /> Hear it again
          </button>
        ) : null}
      </section>

      {phase !== "marked" ? (
        <section className="mt-5">
          <div className="ruled relative overflow-hidden rounded-[14px] border border-rule">
            <textarea
              value={answer + (interim ? (answer && !answer.endsWith(" ") ? " " : "") + interim : "")}
              onChange={(e) => {
                setAnswer(e.target.value);
                base.current = e.target.value;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(answer);
              }}
              disabled={phase === "marking"}
              rows={6}
              placeholder={canListen ? "Tap the mic and answer out loud, or type here…" : "Type your answer here…"}
              className="block w-full resize-none bg-transparent py-[6px] pl-[72px] pr-5 font-serif text-[19px] leading-8 text-navy outline-none placeholder:text-muted/70"
            />
            {listening ? (
              <span className="absolute bottom-3 right-4 inline-flex items-center gap-2 rounded-full bg-sheet px-3 py-1 text-xs font-medium text-pen shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-pen" /> Listening
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {canListen ? (
                <button
                  onClick={() => (listening ? stopMic() : startMic())}
                  disabled={phase === "marking"}
                  className={`grid h-14 w-14 place-items-center rounded-full text-sheet transition ${listening ? "mic-live bg-pen" : "bg-ink hover:bg-navy"}`}
                  aria-label={listening ? "Stop listening" : "Answer out loud"}
                >
                  {listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
              ) : (
                <span className="text-sm text-muted">Voice answers need Chrome or Edge. Typing works everywhere.</span>
              )}
              {canListen ? <span className="text-sm text-ink-2">{listening ? "Speak naturally. Tap again when you're done." : "Answer out loud"}</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-ghost" disabled={phase === "marking"} onClick={() => submit("I don't know")}>
                Pass
              </button>
              <button className="btn btn-ink" disabled={phase === "marking" || answer.trim().length < 2} onClick={() => submit(answer)}>
                {phase === "marking" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
                {phase === "marking" ? "Marking" : "Submit answer"}
              </button>
            </div>
          </div>
          {phase === "marking" ? <MarkingNote /> : null}
          {err ? <p className="mt-3 rounded-lg bg-pen-soft px-3 py-2 text-sm text-pen">{err}</p> : null}
        </section>
      ) : result ? (
        <Marked result={result} answer={answer} next={pending} onNext={next} />
      ) : null}
    </main>
  );
}

function MarkingNote() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 9000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="mt-6 flex items-center gap-3 text-ink-2">
      <svg viewBox="0 0 60 24" className="pen-anim h-6 w-14 text-pen" aria-hidden>
        <path d="M2 16c6-10 10 6 16-2s8-8 12 0 10 6 14-4 8 2 14 2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
      <span className="font-serif italic">
        {slow ? "Still marking. On the free AI tier this can take up to a minute." : "The examiner is marking your answer against your notes…"}
      </span>
    </div>
  );
}

function Marked({ result, answer, next, onNext }: { result: Result; answer: string; next: Reply | null; onNext: () => void }) {
  const [open, setOpen] = useState(false);
  const label = next?.done ? "See your answer script" : next?.next?.kind === "followup" ? "Answer the follow-up" : "Next question";
  return (
    <section className="rise mt-5 space-y-4">
      <div className="ruled overflow-hidden rounded-[14px] border border-rule">
        <div className="py-3 pl-[72px] pr-6">
          <p className="font-serif text-[18px] leading-8 text-navy">{answer || <span className="italic text-muted">No answer</span>}</p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-6">
          <p className="font-serif text-[20px] italic leading-snug text-ink">&ldquo;{result.verdict}&rdquo;</p>
          <span className="pen-circle mr-2 mt-2 shrink-0 text-[40px] font-bold leading-none">
            {fmtScore(result.score)}
            <span className="text-[24px]">/10</span>
          </span>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="label">You got</p>
            <ul className="mt-2 space-y-1.5">
              {result.got.length ? (
                result.got.map((g, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-snug">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-tick" /> {g}
                  </li>
                ))
              ) : (
                <li className="text-[15px] text-muted">Nothing yet</li>
              )}
            </ul>
          </div>
          <div>
            <p className="label">You missed</p>
            <ul className="mt-2 space-y-1.5">
              {result.missed.length ? (
                result.missed.map((g, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-snug">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-pen" /> {g}
                  </li>
                ))
              ) : (
                <li className="text-[15px] text-muted">Nothing important</li>
              )}
            </ul>
          </div>
        </div>

        {result.evidence ? (
          <div className="mt-6 rounded-xl border border-rule bg-[#fffdf8] p-4">
            <p className="label flex items-center gap-2">
              From your notes
              <span className="rounded bg-tick-soft px-1.5 py-0.5 text-[10px] text-tick">Found in your file</span>
            </p>
            <p className="mt-2 font-serif text-[17px] leading-relaxed text-ink-2">
              &ldquo;<span className="hl">{result.evidence}</span>&rdquo;
            </p>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">The examiner&apos;s quote didn&apos;t match your notes word for word, so it isn&apos;t shown.</p>
        )}

        {result.modelAnswer ? (
          <div className="mt-4">
            <button className="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink" onClick={() => setOpen((o) => !o)}>
              <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} /> How a topper would answer
            </button>
            {open ? <p className="mt-2 leading-relaxed text-ink-2">{result.modelAnswer}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end">
        <button className="btn btn-ink px-5 py-3" onClick={onNext} autoFocus>
          {label}
        </button>
      </div>
    </section>
  );
}
