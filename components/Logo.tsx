import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center">
        <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full text-pen" aria-hidden>
          <path d="M20 4c9 0 16 6.5 16 15.5S29 36 19.5 36 4 29.5 4.5 20 11 3.6 21 4.4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
        <span className="font-serif text-[19px] font-semibold italic text-ink">V</span>
      </span>
      <span className="font-serif text-[21px] font-semibold tracking-tight text-ink">Viva Room</span>
    </Link>
  );
}
