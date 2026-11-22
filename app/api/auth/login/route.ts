import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { signIn, fail, HttpError } from "@/lib/auth";

const Body = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  try {
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new HttpError(400, "Enter your email and password.");
    const u = await db.user.findUnique({ where: { email: b.data.email.toLowerCase().trim() } });
    if (!u || !(await bcrypt.compare(b.data.password, u.passwordHash))) throw new HttpError(401, "Wrong email or password.");
    await signIn(u);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
