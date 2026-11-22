export async function post<T = unknown>(url: string, body?: unknown, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: body instanceof FormData ? undefined : { "content-type": "application/json" },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    ...init,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${r.status})`);
  return j as T;
}

export const fmtScore = (n: number | null | undefined) => (n == null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(1));

export function daysUntil(d: Date | string | null) {
  if (!d) return null;
  const ms = new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function scoreTone(n: number | null | undefined) {
  if (n == null) return "bg-fold text-muted";
  if (n >= 7.5) return "bg-tick-soft text-tick";
  if (n >= 4.5) return "bg-hl/60 text-ink";
  return "bg-pen-soft text-pen";
}
