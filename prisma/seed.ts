import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const ifEmpty = process.argv.includes("--if-empty");

async function main() {
  if (ifEmpty && (await db.user.count()) > 0) {
    console.log("[seed] database already has users, skipping");
    return;
  }
  const { loadSample } = await import("../lib/sample");
  const email = "demo@vivaroom.app";
  await db.user.deleteMany({ where: { email } });
  const u = await db.user.create({
    data: { email, name: "Demo Student", passwordHash: await bcrypt.hash("viva-demo", 10) },
  });
  await loadSample(u.id);
  console.log(`[seed] created ${email} / viva-demo with the sample subject`);
}

main().finally(() => db.$disconnect());
