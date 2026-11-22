import { provider } from "@/lib/ai";
import { db } from "@/lib/db";

export async function GET() {
  let database = "ok";
  try {
    await db.user.count();
  } catch {
    database = "unreachable";
  }
  return Response.json({ ok: database === "ok", database, ai: provider() });
}
