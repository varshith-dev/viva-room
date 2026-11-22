import { test } from "node:test";
import assert from "node:assert/strict";
import { splitIntoPieces, rank, verifyQuote } from "./text";
import { nextReview, priority } from "./schedule";

const notes =
  "Round Robin gives each process a fixed time quantum. If the quantum is very small, the CPU spends too much time on context switches.\n\nDeadlock needs four conditions: mutual exclusion, hold and wait, no preemption and circular wait.";

test("splits notes into passages and keeps page numbers", () => {
  const p = splitIntoPieces([{ page: 3, text: notes.repeat(4) }], 300, 80);
  assert.ok(p.length >= 2);
  assert.ok(p.every((x) => x.page === 3 && x.text.length > 0));
});

test("BM25 finds the right passage", () => {
  const docs = [{ text: "Round robin time quantum context switch" }, { text: "Deadlock circular wait hold and wait" }];
  assert.equal(rank("what is circular wait", docs, 1)[0], docs[1]);
});

test("quote check accepts real quotes and rejects made up ones", () => {
  assert.equal(verifyQuote("If the quantum is very small, the CPU spends too much time on context switches.", notes).ok, true);
  assert.equal(verifyQuote("the cpu spends too much time on context switches", notes).ok, true);
  assert.equal(verifyQuote("Round robin was invented by Dijkstra in 1965 for batch systems.", notes).ok, false);
});

test("weak answers come back soon, strong ones later", () => {
  const start = { reviews: 0, intervalDays: 0, lastScore: null, dueAt: null };
  const now = new Date("2026-11-22T10:00:00Z");
  assert.ok(nextReview(start, 2, now).dueAt!.getTime() - now.getTime() < 3600000);
  assert.equal(nextReview(start, 9, now).intervalDays, 2);
});

test("due weak passages are asked before new ones", () => {
  const now = new Date();
  const long = "x".repeat(200);
  const chunks = [
    { id: "new", text: long, reviews: 0, lastScore: null, dueAt: null },
    { id: "weak", text: long, reviews: 1, lastScore: 2, dueAt: new Date(now.getTime() - 1000) },
  ];
  assert.equal(priority(chunks, new Set(), now)[0].id, "weak");
});
