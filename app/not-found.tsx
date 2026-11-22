import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5 text-center">
      <div>
        <p className="font-hand text-5xl text-pen">0/10</p>
        <h1 className="mt-4 font-serif text-3xl">This page isn&apos;t in your notes.</h1>
        <Link href="/app" className="btn btn-ink mt-6">Back to your desk</Link>
      </div>
    </main>
  );
}
