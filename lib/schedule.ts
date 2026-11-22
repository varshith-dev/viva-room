// Spaced review for passages, a light version of SM-2 that works on a 0 to 10 viva mark.
export type ReviewState = { reviews: number; intervalDays: number; lastScore: number | null; dueAt: Date | null };

export function nextReview(prev: ReviewState, score: number, now = new Date()): ReviewState {
  let interval: number;
  if (score >= 7.5) interval = prev.intervalDays >= 1 ? Math.min(prev.intervalDays * 2.3, 30) : 2;
  else if (score >= 4.5) interval = 1;
  else interval = 0.007; // about 10 minutes: ask again in the same evening
  const blended = prev.lastScore == null ? score : prev.lastScore * 0.35 + score * 0.65;
  return {
    reviews: prev.reviews + 1,
    intervalDays: Number(interval.toFixed(3)),
    lastScore: Number(blended.toFixed(2)),
    dueAt: new Date(now.getTime() + interval * 86400000),
  };
}

type Candidate = { id: string; text: string; reviews: number; lastScore: number | null; dueAt: Date | null };

/** Order passages for questioning: weak and due first, then never asked, then the rest by due date. */
export function priority<T extends Candidate>(chunks: T[], exclude: Set<string>, now = new Date()): T[] {
  const usable = chunks.filter((c) => !exclude.has(c.id) && c.text.length >= 140);
  const due = usable.filter((c) => c.reviews > 0 && c.dueAt && c.dueAt <= now).sort((a, b) => (a.lastScore ?? 0) - (b.lastScore ?? 0));
  const fresh = usable.filter((c) => c.reviews === 0);
  // shuffle fresh so two sessions in a row don't start on page 1 every time
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j], fresh[i]];
  }
  const later = usable
    .filter((c) => c.reviews > 0 && !(c.dueAt && c.dueAt <= now))
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));
  return [...due, ...fresh, ...later];
}

export function mastery(chunks: { topic: string; reviews: number; lastScore: number | null }[]) {
  const by = new Map<string, { topic: string; total: number; seen: number; sum: number }>();
  for (const c of chunks) {
    const t = by.get(c.topic) ?? { topic: c.topic, total: 0, seen: 0, sum: 0 };
    t.total++;
    if (c.reviews > 0 && c.lastScore != null) {
      t.seen++;
      t.sum += c.lastScore;
    }
    by.set(c.topic, t);
  }
  return [...by.values()].map((t) => ({
    topic: t.topic,
    total: t.total,
    seen: t.seen,
    avg: t.seen ? Number((t.sum / t.seen).toFixed(1)) : null,
  }));
}
