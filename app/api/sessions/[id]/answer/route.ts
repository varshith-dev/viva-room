import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, fail, HttpError } from "@/lib/auth";
import { isKeyless } from "@/lib/ai";
import { gradeTurn, draftNextQuestion, closeSession } from "@/lib/examiner";

export const maxDuration = 60;

const Body = z.object({
  turnId: z.string(),
  answer: z.string().max(6000),
  seconds: z.number().int().min(0).max(3600).default(0),
  spoken: z.boolean().default(false),
});

const view = (t: { id: string; idx: number; kind: string; question: string }) => ({ id: t.id, idx: t.idx, kind: t.kind, question: t.question });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await apiUser();
    const { id } = await params;
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "Bad answer payload.");
    const s = await db.session.findFirst({ where: { id, userId: u.id }, include: { turns: true } });
    if (!s) throw new HttpError(404, "Viva not found.");
    if (s.status !== "live") throw new HttpError(409, "This viva is already finished.");
    const turn = s.turns.find((t) => t.id === b.data.turnId);
    if (!turn || turn.status !== "asked") throw new HttpError(409, "That question was already answered.");

    const mainsAfter = s.turns.filter((t) => t.kind === "main" && t.status === "graded").length + (turn.kind === "main" ? 1 : 0);
    const needMore = mainsAfter < s.length;
    const hasQueued = s.turns.some((t) => t.status === "queued");

    // Grade this answer and, at the same time, prepare the next question so the examiner replies fast.
    const [graded, prefetched] = await Promise.all([
      gradeTurn(turn.id, b.data.answer, b.data.seconds, b.data.spoken),
      needMore && !hasQueued && !isKeyless() ? draftNextQuestion(s.id, "queued").catch(() => null) : Promise.resolve(null),
    ]);
    const g = graded.turn;

    const result = {
      id: g.id,
      score: g.score,
      verdict: g.verdict,
      got: JSON.parse(g.got ?? "[]"),
      missed: JSON.parse(g.missed ?? "[]"),
      modelAnswer: g.modelAnswer,
      evidence: g.evidence,
      evidenceVerified: g.evidenceVerified,
    };

    if (turn.kind === "main" && graded.followup && g.score != null && g.score >= 3 && g.score < 7.5) {
      const f = await db.turn.create({
        data: { sessionId: s.id, chunkId: turn.chunkId, idx: turn.idx, kind: "followup", question: graded.followup },
      });
      // keep ordering stable: shift the queued question behind the follow-up
      await db.turn.updateMany({ where: { sessionId: s.id, status: "queued" }, data: { idx: turn.idx + 1 } });
      return Response.json({ result, next: view(f), done: false });
    }

    if (!needMore) {
      await closeSession(s.id);
      return Response.json({ result, next: null, done: true });
    }

    let next = prefetched ?? (await db.turn.findFirst({ where: { sessionId: s.id, status: "queued" } }));
    if (next) next = await db.turn.update({ where: { id: next.id }, data: { status: "asked", idx: Math.max(next.idx, turn.idx + 1) } });
    else next = await draftNextQuestion(s.id);
    if (!next) {
      await closeSession(s.id);
      return Response.json({ result, next: null, done: true });
    }
    return Response.json({ result, next: view(next), done: false });
  } catch (e) {
    return fail(e);
  }
}
