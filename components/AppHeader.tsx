import Link from "next/link";
import { Logo } from "./Logo";
import { LogoutButton } from "./LogoutButton";

export function AppHeader({ name }: { name: string }) {
  return (
    <header className="border-b border-rule bg-paper/80 backdrop-blur supports-[backdrop-filter]:bg-paper/70 sticky top-0 z-20">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Logo href="/app" />
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/app" className="btn btn-ghost">Desk</Link>
          <span className="hidden px-3 text-muted sm:inline">{name}</span>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
