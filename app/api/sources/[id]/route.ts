import { db } from "@/lib/db";
import { apiUser, fail, HttpError } from "@/lib/auth";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await apiUser();
    const { id } = await params;
    const src = await db.source.findFirst({ where: { id, subject: { userId: u.id } } });
    if (!src) throw new HttpError(404, "Not found.");
    await db.source.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
