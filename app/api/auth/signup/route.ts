import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { signIn, fail, HttpError } from "@/lib/auth";
import { loadSample } from "@/lib/sample";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().email(),
  password: z.string().min(8, "Use at least 8 characters."),
  sample: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, b.error.issues[0]?.message ?? "Check the form.");
    const email = b.data.email.toLowerCase().trim();
    if (await db.user.findUnique({ where: { email } })) throw new HttpError(409, "That email already has an account. Sign in instead.");
    const u = await db.user.create({
      data: { email, name: b.data.name, passwordHash: await bcrypt.hash(b.data.password, 10) },
    });
    if (b.data.sample) await loadSample(u.id);
    await signIn(u);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
