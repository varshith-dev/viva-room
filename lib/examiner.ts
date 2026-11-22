import { db } from "./db";
import { askJson } from "./ai";
import { rank, verifyQuote, clip } from "./text";
import { nextReview, priority } from "./schedule";

export const MODES = {
  lab: {
    label: "Lab viva",
    hint: "Practical questions: what happens if, why this step, how you would test or debug it.",
    style:
      "This is a lab viva. Ask a practical question: what happens if something changes, why a step is done, how the student would test, trace or debug it, or what output to expect.",
  },
  theory: {
    label: "Theory viva",
    hint: "Explain, compare and justify. The kind of question asked across the table.",
    style:
      "This is a theory viva. Ask the student to explain, compare, or justify a concept in their own words. Prefer 'why' and 'how' over pure definitions.",
  },
  rapid: {
    label: "Rapid fire",
    hint: "Short recall questions you can answer in one sentence. Good the night before.",
    style: "This is a rapid fire round. Ask one short recall question that can be answered in a single sentence.",
  },
} as const;
export type Mode = keyof typeof MODES;

export const STRICTNESS = {
  kind: "You are a kind examiner. Give partial credit generously for the right idea even if terms are missing.",
  fair: "You are a fair examiner. Give credit for correct ideas; deduct for missing key terms, wrong facts or vague answers.",
  strict: "You are a strict external examiner. Full marks only for complete, precise answers with the right terms. Vague answers get low marks.",
} as const;
export type Strictness = keyof typeof STRICTNESS;

const BASE =
  "You conduct oral exams (vivas) for university students in India. You speak plainly and briefly, like a real professor across a table. Never use markdown. Never invent facts that are not in the notes you are given.";

// ---------- topics ----------

export async function labelTopics(passages: string[]): Promise<string[]> {
  const out: string[] = passages.map(() => "General");
  for (let start = 0; start < passages.length; start += 40) {
    const batch = passages.slice(start, start + 40);
    try {
      const r = await askJson<{ topics: { i: number; topic: string }[] }>(
        {
          system: BASE,
          user:
            "Give each passage of these study notes a short topic label of 2 to 5 words, the way a syllabus would name it. Passages that cover the same idea should share the exact same label. Return JSON: {\"topics\":[{\"i\":0,\"topic\":\"...\"}]}\n\n" +
            batch.map((p, i) => `[${i}] ${clip(p.replace(/\s+/g, " "), 260)}`).join("\n"),
        },
        (v) => Array.isArray(v?.topics),
        0.2,
      );
      for (const t of r.topics) {
        if (typeof t.i === "number" && t.i >= 0 && t.i < batch.length && t.topic) out[start + t.i] = clip(String(t.topic).trim(), 48);
      }
    } catch {
      // keep "General" labels; the app still works without topics
    }
  }
  return out;
}

// ---------- questions ----------

async function writeQuestion(opts: {
  mode: Mode;
  passage: string;
  topic: string;
  asked: string[];
  lastMissed: string[];
}): Promise<string> {
  const r = await askJson<{ question: string }>(
    {
      system: `${BASE} ${MODES[opts.mode].style}`,
      user: [
        `Topic: ${opts.topic}`,
        `Notes passage:\n"""${opts.passage}"""`,
        opts.lastMissed.length
          ? `Last time on this passage the student missed: ${opts.lastMissed.join("; ")}. Ask about that gap again from a new angle.`
          : "",
        opts.asked.length ? `Already asked in this viva (do not repeat): ${opts.asked.map((q) => `"${q}"`).join(" ")}` : "",
        'Write ONE question that can be fully answered from the passage. One part only, under 28 words, natural to say out loud. Do not mention "the passage" or "the notes". Return JSON: {"question":"..."}',
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    (v) => typeof v?.question === "string" && v.question.length > 8,
    0.7,
  );
  return r.question.trim();
}

/** Pick the next passage and write a question for it. Returns null when the subject has no usable notes. */
export async function draftNextQuestion(sessionId: string, status: "asked" | "queued" = "asked") {
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { turns: true } });
  const chunks = await db.chunk.findMany({ where: { subjectId: s.subjectId } });
  const used = new Set(s.turns.map((t) => t.chunkId));
  const order = priority(chunks, used);
  const pick = order[0] ?? priority(chunks, new Set())[0];
  if (!pick) return null;
  const lastTurn = await db.turn.findFirst({
    where: { chunkId: pick.id, status: "graded" },
    orderBy: { createdAt: "desc" },
  });
  const lastMissed: string[] = lastTurn?.missed ? JSON.parse(lastTurn.missed) : [];
  const question = await writeQuestion({
    mode: s.mode as Mode,
    passage: pick.text,
    topic: pick.topic,
    asked: s.turns.map((t) => t.question),
    lastMissed: (lastTurn?.score ?? 10) < 7.5 ? lastMissed : [],
  });
  const idx = s.turns.length ? Math.max(...s.turns.map((t) => t.idx)) + 1 : 0;
  return db.turn.create({ data: { sessionId, chunkId: pick.id, idx, kind: "main", status, question } });
}

// ---------- grading ----------

type Grade = {
  score: number;
  verdict: string;
  got: string[];
  missed: string[];
  modelAnswer: string;
  evidence: string;
  followup: string;
};

export async function gradeTurn(turnId: string, answer: string, seconds: number, spoken: boolean) {
  const turn = await db.turn.findUniqueOrThrow({ where: { id: turnId }, include: { chunk: true, session: true } });
  const all = await db.chunk.findMany({ where: { subjectId: turn.chunk.subjectId }, select: { id: true, text: true } });
  const related = rank(`${turn.question} ${answer}`, all.filter((c) => c.id !== turn.chunkId), 2);
  const notes = [turn.chunk.text, ...related.map((r) => r.text)];
  const blank = answer.trim().length < 3 || /^(i )?(don'?t|do not) know\.?$|^pass\.?$|^skip\.?$/i.test(answer.trim());

  let g: Grade;
  if (blank) {
    g = {
      score: 0,
      verdict: "No answer this time. Here is what I was looking for.",
      got: [],
      missed: ["No answer given"],
      modelAnswer: "",
      evidence: "",
      followup: "",
    };
    const m = await askJson<{ modelAnswer: string; evidence: string }>(
      {
        system: BASE,
        user: `Question: ${turn.question}\nNotes:\n"""${turn.chunk.text}"""\nGive a 2 sentence model answer and copy, word for word, the one sentence from the notes that answers it. JSON: {"modelAnswer":"...","evidence":"..."}`,
      },
      (v) => typeof v?.modelAnswer === "string",
      0.2,
    ).catch(() => ({ modelAnswer: "", evidence: "" }));
    g.modelAnswer = m.modelAnswer;
    g.evidence = m.evidence;
  } else {
    g = await askJson<Grade>(
      {
        system: `${BASE} ${STRICTNESS[(turn.session.strictness as Strictness) ?? "fair"]} The answer may be a speech transcript, so ignore spelling, filler words and small transcription errors. Judge the ideas.`,
        user: [
          `Question: ${turn.question}`,
          `Student's answer (${spoken ? "spoken, transcribed" : "typed"}, ${seconds}s): """${clip(answer, 2500)}"""`,
          `Notes (the only source of truth):\n${notes.map((n, i) => `[${i + 1}] """${n}"""`).join("\n")}`,
          'Mark the answer out of 10. 9-10 complete and precise, 7-8 correct with small gaps, 4-6 partly right, 1-3 mostly wrong or vague, 0 nothing relevant. Return JSON only:\n{"score": number,\n"verdict": "one or two sentences you would say to the student out loud",\n"got": ["short points they got right"],\n"missed": ["short points they missed or got wrong"],\n"modelAnswer": "a 2 to 3 sentence answer a topper would give",\n"evidence": "copy word for word the single most useful sentence from the notes for this question",\n"followup": "if the score is between 3 and 7, one short follow-up question that probes the main gap, else empty string"}',
        ].join("\n\n"),
      },
      (v) => typeof v?.score === "number" && typeof v?.verdict === "string",
      0.2,
    );
  }

  const score = Math.max(0, Math.min(10, Math.round(Number(g.score) * 2) / 2));
  const check = g.evidence ? verifyQuote(g.evidence, notes.join("\n")) : { ok: false, span: null };
  const updated = await db.turn.update({
    where: { id: turnId },
    data: {
      answer,
      seconds,
      spoken,
      score,
      status: "graded",
      verdict: g.verdict?.trim() || "",
      got: JSON.stringify((g.got ?? []).filter(Boolean).slice(0, 4).map(String)),
      missed: JSON.stringify((g.missed ?? []).filter(Boolean).slice(0, 4).map(String)),
      modelAnswer: g.modelAnswer?.trim() || null,
      evidence: check.ok ? check.span : null,
      evidenceVerified: check.ok,
    },
  });

  const c = turn.chunk;
  const nr = nextReview({ reviews: c.reviews, intervalDays: c.intervalDays, lastScore: c.lastScore, dueAt: c.dueAt }, score);
  await db.chunk.update({ where: { id: c.id }, data: nr });

  return { turn: updated, followup: typeof g.followup === "string" ? g.followup.trim() : "" };
}

// ---------- closing remarks ----------

export type Summary = { headline: string; strengths: string[]; fixes: string[]; nextStep: string };

export async function closeSession(sessionId: string) {
  const s = await db.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { turns: { where: { status: "graded" }, orderBy: { idx: "asc" }, include: { chunk: { select: { topic: true } } } } },
  });
  const graded = s.turns;
  const score = graded.length ? graded.reduce((a, t) => a + (t.score ?? 0), 0) / graded.length : 0;
  let summary: Summary = {
    headline: graded.length ? `You averaged ${score.toFixed(1)} out of 10.` : "No questions were answered.",
    strengths: [],
    fixes: [],
    nextStep: "Run another viva when you're ready.",
  };
  if (graded.length) {
    summary = await askJson<Summary>(
      {
        system: BASE,
        user:
          "Here is how a student did in a viva. Write closing remarks like a professor would say them, honest and specific. JSON: {\"headline\":\"one sentence\",\"strengths\":[\"up to 2\"],\"fixes\":[\"up to 3 concrete things to revise\"],\"nextStep\":\"one sentence on what to do tonight\"}\n\n" +
          graded
            .map(
              (t) =>
                `Q (${t.chunk.topic}): ${t.question}\nMark: ${t.score}/10\nGot: ${t.got}\nMissed: ${t.missed}`,
            )
            .join("\n\n"),
      },
      (v) => typeof v?.headline === "string" && Array.isArray(v?.fixes),
      0.4,
    ).catch(() => summary);
  }
  await db.turn.deleteMany({ where: { sessionId, status: { in: ["queued", "asked"] } } });
  return db.session.update({
    where: { id: sessionId },
    data: { status: "done", endedAt: new Date(), score: Number(score.toFixed(2)), summary: JSON.stringify(summary) },
  });
}
