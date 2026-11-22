import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "./Logo";
import { AuthForm } from "./AuthForm";
import { GuestButton } from "./GuestButton";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return (
    <div className="grain flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Logo />
      <div className="card mt-8 w-full max-w-md p-8">
        <h1 className="font-serif text-3xl font-medium">{mode === "login" ? "Welcome back" : "Make your exam desk"}</h1>
        <p className="mt-1.5 text-ink-2">
          {mode === "login" ? "Sign in to pick up where you left off." : "Your notes and marks stay in your account."}
        </p>
        <div className="mt-7">
          <Suspense>
            <AuthForm mode={mode} />
          </Suspense>
        </div>
        <div className="mt-6 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-rule" /> or <span className="h-px flex-1 bg-rule" />
        </div>
        <div className="mt-5 flex justify-center">
          <GuestButton className="btn btn-line w-full" label="Try with sample notes, no account" />
        </div>
      </div>
      <p className="mt-6 text-sm text-ink-2">
        {mode === "login" ? (
          <>
            New here? <Link className="font-semibold underline underline-offset-4" href="/signup">Create an account</Link>
          </>
        ) : (
          <>
            Have an account? <Link className="font-semibold underline underline-offset-4" href="/login">Sign in</Link>
          </>
        )}
      </p>
    </div>
  );
}
