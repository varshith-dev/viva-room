// Plain text helpers: splitting notes into passages, keyword retrieval, and checking that a
// quote the model gives back really exists in the student's notes.

export type Page = { page: number; text: string };
export type Piece = { page: number; text: string };

const clean = (s: string) =>
  s
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Split pages into passages of roughly `target` characters, keeping paragraphs whole when possible. */
export function splitIntoPieces(pages: Page[], target = 900, min = 160): Piece[] {
  const out: Piece[] = [];
  for (const p of pages) {
    const paras = clean(p.text)
      .split(/\n\s*\n|\n(?=[A-Z0-9#•\-*][^\n]{0,80}\n)/)
      .map((x) => x.replace(/\n/g, " ").trim())
      .filter(Boolean);
    let buf = "";
    const flush = () => {
      if (buf.trim()) out.push({ page: p.page, text: buf.trim() });
      buf = "";
    };
    for (const para of paras) {
      if (para.length > target * 1.6) {
        flush();
        const sentences = para.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [para];
        for (const s of sentences) {
          if ((buf + s).length > target) flush();
          buf += s;
        }
        flush();
        continue;
      }
      if ((buf + "\n" + para).length > target && buf.length >= min) flush();
      buf = buf ? `${buf}\n${para}` : para;
    }
    flush();
  }
  // merge tiny leftovers into the previous passage on the same page
  const merged: Piece[] = [];
  for (const piece of out) {
    const prev = merged[merged.length - 1];
    if (prev && piece.text.length < min && prev.page === piece.page) prev.text += `\n${piece.text}`;
    else merged.push({ ...piece });
  }
  return merged;
}

const STOP = new Set(
  "a an the and or but if of to in on at by for with from as is are was were be been it its this that these those which who what when where why how do does did can could will would should may might not no yes than then so such there their they them we you your i he she his her our also into about over under between each per via using use used".split(
    " ",
  ),
);

export const tokens = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

/** BM25 ranking over passages. Small, fast, no embedding service needed. */
export function rank<T extends { text: string }>(query: string, docs: T[], k = 3): T[] {
  const q = [...new Set(tokens(query))];
  if (!q.length || !docs.length) return docs.slice(0, k);
  const toks = docs.map((d) => tokens(d.text));
  const avg = toks.reduce((a, t) => a + t.length, 0) / toks.length || 1;
  const df = new Map<string, number>();
  for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
  const N = docs.length;
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    for (const w of toks[i]) tf.set(w, (tf.get(w) ?? 0) + 1);
    let s = 0;
    for (const w of q) {
      const f = tf.get(w);
      if (!f) continue;
      const idf = Math.log(1 + (N - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (toks[i].length / avg))));
    }
    return { d, s };
  });
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.d);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Is `quote` really in `source`? Exact match after normalising, or a window of the source that
 * shares at least 85% of the quote's words in order-insensitive form. Returns the matching
 * span from the source so the UI can show the student's own wording.
 */
export function verifyQuote(quote: string, source: string): { ok: boolean; span: string | null } {
  const q = norm(quote);
  if (q.length < 12) return { ok: false, span: null };
  const srcN = norm(source);
  if (srcN.includes(q)) return { ok: true, span: quote };
  const qw = q.split(" ");
  const sw = srcN.split(" ");
  const need = new Map<string, number>();
  for (const w of qw) need.set(w, (need.get(w) ?? 0) + 1);
  let best = 0;
  let bestAt = -1;
  const win = qw.length;
  for (let i = 0; i + win <= sw.length + 2; i++) {
    const have = new Map(need);
    let hit = 0;
    for (const w of sw.slice(i, i + win + 2)) {
      const c = have.get(w);
      if (c) {
        hit++;
        have.set(w, c - 1);
      }
    }
    const r = hit / win;
    if (r > best) {
      best = r;
      bestAt = i;
    }
  }
  if (best >= 0.85 && bestAt >= 0) return { ok: true, span: sw.slice(bestAt, bestAt + win).join(" ") };
  return { ok: false, span: null };
}

export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
