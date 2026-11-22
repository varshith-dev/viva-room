// Runs at build time (`npm run vercel-build`): create or update the tables, then seed the demo
// data only if the database has none. Idempotent: never wipes a database that is already seeded.
//
// With the Vercel Marketplace Neon integration, DATABASE_URL is the pooled string and
// DATABASE_URL_UNPOOLED is the direct one. Schema changes and the seed use the direct one.
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.warn("\n[db-prepare] No DATABASE_URL found. Skipping database setup.");
  console.warn("[db-prepare] Add the Neon integration (Vercel > Storage) and redeploy.\n");
  process.exit(0);
}
const env = { ...process.env, DATABASE_URL: url };
const run = (args) => {
  const r = spawnSync("npx", args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
console.log("[db-prepare] syncing schema");
run(["prisma", "db", "push", "--skip-generate"]);
console.log("[db-prepare] seeding if empty");
run(["tsx", "prisma/seed.ts", "--if-empty"]);
