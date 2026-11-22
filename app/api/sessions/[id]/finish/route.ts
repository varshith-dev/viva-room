import { db } from "@/lib/db";
import { apiUser, fail, HttpError } from "@/lib/auth";
import { closeSession } from "@/lib/examiner";

export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await apiUser();
    const { id } = await params;
    const s = await db.session.findFirst({ where: { id, userId: u.id } });
    if (!s) throw new HttpError(404, "Viva not found.");
    if (s.status === "live") await closeSession(id);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
