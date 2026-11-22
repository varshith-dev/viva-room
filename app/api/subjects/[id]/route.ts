import { db } from "@/lib/db";
import { apiUser, fail, HttpError } from "@/lib/auth";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await apiUser();
    const { id } = await params;
    const r = await db.subject.deleteMany({ where: { id, userId: u.id } });
    if (!r.count) throw new HttpError(404, "Subject not found.");
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
