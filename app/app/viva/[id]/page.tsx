import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MODES, type Mode } from "@/lib/examiner";
import { VivaRoom } from "@/components/VivaRoom";

export const dynamic = "force-dynamic";

export default async function VivaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await requireUser(`/app/viva/${id}`);
  const s = await db.session.findFirst({
    where: { id, userId: u.id },
    include: { subject: { select: { id: true, title: true } }, turns: { orderBy: [{ idx: "asc" }, { createdAt: "asc" }] } },
  });
  if (!s) notFound();
  if (s.status === "done") redirect(`/app/viva/${id}/report`);
  const current = s.turns.find((t) => t.status === "asked") ?? null;
  const mainsDone = s.turns.filter((t) => t.kind === "main" && t.status === "graded").length;
  return (
    <VivaRoom
      sessionId={s.id}
      subject={s.subject}
      modeLabel={MODES[s.mode as Mode]?.label ?? s.mode}
      strictness={s.strictness}
      length={s.length}
      mainsDone={mainsDone}
      initial={current ? { id: current.id, idx: current.idx, kind: current.kind, question: current.question } : null}
    />
  );
}
