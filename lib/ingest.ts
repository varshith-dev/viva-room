import { db } from "./db";
import { splitIntoPieces, type Page } from "./text";
import { labelTopics } from "./examiner";

export const MAX_BYTES = 4 * 1024 * 1024;

export async function pdfPages(buf: ArrayBuffer): Promise<Page[]> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map((t, i) => ({ page: i + 1, text: t }));
}

export async function addSource(subjectId: string, title: string, kind: "pdf" | "text", pages: Page[]) {
  const pieces = splitIntoPieces(pages);
  const chars = pieces.reduce((a, p) => a + p.text.length, 0);
  if (chars < 200) throw new Error("That file has almost no readable text. If it is a scanned PDF, paste the text instead.");
  const topics = await labelTopics(pieces.map((p) => p.text));
  const src = await db.source.create({
    data: { subjectId, title: title.slice(0, 120), kind, pages: pages.length, chars },
  });
  await db.chunk.createMany({
    data: pieces.map((p, i) => ({ sourceId: src.id, subjectId, idx: i, page: p.page, topic: topics[i], text: p.text })),
  });
  return { ...src, chunks: pieces.length };
}
