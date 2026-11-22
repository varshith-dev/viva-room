import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, fail, HttpError } from "@/lib/auth";
import { draftNextQuestion } from "@/lib/examiner";

export const maxDuration = 60;

const Body = z.object({
  subjectId: z.string(),
  mode: z.enum(["lab", "theory", "rapid"]),
  strictness: z.enum(["kind", "fair", "strict"]).default("fair"),
  length: z.number().int().min(3).max(12).default(5),
});

export async function POST(req: Request) {
  try {
    const u = await apiUser();
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "Pick a mode and length.");
    const subject = await db.subject.findFirst({
      where: { id: b.data.subjectId, userId: u.id },
      include: { _count: { select: { chunks: true } } },
    });
    if (!subject) throw new HttpError(404, "Subject not found.");
    if (!subject._count.chunks) throw new HttpError(400, "Add some notes to this subject first.");
    const s = await db.session.create({
      data: { userId: u.id, subjectId: subject.id, mode: b.data.mode, strictness: b.data.strictness, length: b.data.length },
    });
    try {
      await draftNextQuestion(s.id);
    } catch (e) {
      await db.session.delete({ where: { id: s.id } });
      throw new HttpError(503, `The examiner couldn't write a question just now (${e instanceof Error ? e.message : "AI error"}). Try again in a moment.`);
    }
    return Response.json({ id: s.id });
  } catch (e) {
    return fail(e);
  }
}
