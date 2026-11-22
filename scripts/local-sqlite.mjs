// Local-only fallback: run the whole app on SQLite with no database server.
//   npm run demo:sqlite
// Writes a SQLite copy of prisma/schema.prisma, generates a client for it, creates and seeds
// prisma/.sqlite/local.db, then starts `next dev`. Deploys use PostgreSQL: run `npx prisma generate`
// (the postinstall hook does this) to go back to the PostgreSQL client.
import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "prisma", ".sqlite");
fs.mkdirSync(dir, { recursive: true });
const schema = fs.readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8").replace('provider = "postgresql"', 'provider = "sqlite"');
fs.writeFileSync(path.join(dir, "schema.prisma"), schema);

const env = { ...process.env, DATABASE_URL: "file:./local.db" };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
fs.rmSync(path.join(dir, "local.db"), { force: true });
const sp = ["--schema", "prisma/.sqlite/schema.prisma"];
run("npx", ["prisma", "generate", ...sp]);
run("npx", ["prisma", "db", "push", "--skip-generate", ...sp]);
run("npx", ["tsx", "prisma/seed.ts"]);
spawn("npx", ["next", "dev"], { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
