import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { signIn, fail } from "@/lib/auth";
import { loadSample } from "@/lib/sample";

// "Try it now": a private throwaway account with the sample notes, so visitors don't share data.
export async function POST() {
  try {
    const tag = randomBytes(4).toString("hex");
    const u = await db.user.create({
      data: { email: `guest-${tag}@vivaroom.app`, name: "Guest", passwordHash: await bcrypt.hash(randomBytes(16).toString("hex"), 8) },
    });
    await loadSample(u.id);
    await signIn(u);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
