import { z } from "zod";
import { db } from "@/lib/db";
import { apiUser, fail, HttpError } from "@/lib/auth";

const Body = z.object({ title: z.string().trim().min(2).max(120), examDate: z.string().optional().nullable() });

export async function POST(req: Request) {
  try {
    const u = await apiUser();
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "Give the subject a name.");
    const examDate = b.data.examDate ? new Date(b.data.examDate) : null;
    const s = await db.subject.create({
      data: { userId: u.id, title: b.data.title, examDate: examDate && !isNaN(+examDate) ? examDate : null },
    });
    return Response.json({ id: s.id });
  } catch (e) {
    return fail(e);
  }
}
