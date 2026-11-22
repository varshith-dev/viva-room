// One small client for three providers. Picks the first one configured:
// Gemini (GEMINI_API_KEY), then Groq (GROQ_API_KEY), then the free keyless Pollinations API.
// Every call asks for JSON and is parsed defensively, because free models sometimes wrap it.

export type Provider = { name: string; model: string };

export function provider(): Provider {
  if (process.env.GEMINI_API_KEY) return { name: "Google Gemini", model: process.env.GEMINI_MODEL || "gemini-2.5-flash" };
  if (process.env.GROQ_API_KEY) return { name: "Groq", model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile" };
  return { name: "Pollinations (free, keyless)", model: process.env.POLLINATIONS_MODEL || "openai" };
}

type Msg = { system: string; user: string };

async function withTimeout(url: string, init: RequestInit, ms: number) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function callRaw({ system, user }: Msg, temperature: number): Promise<string> {
  const p = provider();
  if (process.env.GEMINI_API_KEY) {
    const r = await withTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature, responseMimeType: "application/json" },
        }),
      },
      40000,
    );
    if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.map((x: { text?: string }) => x.text ?? "").join("") ?? "";
  }
  const groq = !!process.env.GROQ_API_KEY;
  const url = groq ? "https://api.groq.com/openai/v1/chat/completions" : "https://text.pollinations.ai/openai";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (groq) headers.authorization = `Bearer ${process.env.GROQ_API_KEY}`;
  const r = await withTimeout(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: p.model,
        temperature,
        ...(groq ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    },
    45000,
  );
  if (!r.ok) throw new Error(`${p.name} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? "";
}

// The keyless Pollinations tier allows about one reply every 45 seconds per IP. Calls are queued
// one at a time and wait out the limit, which is fine for local use. For a public deploy, set a
// free GEMINI_API_KEY or GROQ_API_KEY instead.
let queue: Promise<unknown> = Promise.resolve();
export const isKeyless = () => !process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY;

async function callQueued(msg: Msg, temperature: number): Promise<string> {
  if (!isKeyless()) return callRaw(msg, temperature);
  const run = async () => {
    for (let i = 0; i < 3; i++) {
      try {
        return await callRaw(msg, temperature);
      } catch (e) {
        const m = e instanceof Error ? e.message.match(/Retry after (\d+)s/i) : null;
        if (!m || Number(m[1]) > 60) throw e;
        await new Promise((r) => setTimeout(r, (Number(m[1]) + 1) * 1000));
      }
    }
    return callRaw(msg, temperature);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

export function parseJson<T>(raw: string): T {
  const s = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(s) as T;
  } catch {
    const a = s.indexOf("{");
    const b = s.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1)) as T;
    throw new Error("The model did not return JSON.");
  }
}

/** Ask for JSON, retry once on a bad answer or a network error. */
export async function askJson<T>(msg: Msg, check: (v: T) => boolean, temperature = 0.4): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const v = parseJson<T>(await callQueued(msg, temperature));
      if (check(v)) return v;
      last = new Error("The model's JSON was missing fields.");
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw last instanceof Error ? last : new Error("AI call failed");
}
