"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { post } from "@/lib/client";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const r = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setErr("");
        try {
          await post(`/api/auth/${mode}`, {
            name: f.get("name"),
            email: f.get("email"),
            password: f.get("password"),
            sample: f.get("sample") === "on",
          });
          const next = sp.get("next");
          r.push(next && next.startsWith("/") ? next : "/app");
          r.refresh();
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Something went wrong");
          setBusy(false);
        }
      }}
    >
      {mode === "signup" ? (
        <label className="block">
          <span className="label">Your name</span>
          <input name="name" required className="field mt-1.5" placeholder="Varshith" autoComplete="name" />
        </label>
      ) : null}
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" required className="field mt-1.5" placeholder="you@college.edu" autoComplete="email" />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : 1}
          className="field mt-1.5"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </label>
      {mode === "signup" ? (
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" name="sample" defaultChecked className="h-4 w-4 accent-[#1c2230]" />
          Add the sample OS notes so I can try it straight away
        </label>
      ) : null}
      {err ? <p className="rounded-lg bg-pen-soft px-3 py-2 text-sm text-pen">{err}</p> : null}
      <button className="btn btn-ink w-full" disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
