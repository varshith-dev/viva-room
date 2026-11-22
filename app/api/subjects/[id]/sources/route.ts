import { db } from "@/lib/db";
import { apiUser, fail, HttpError } from "@/lib/auth";
import { addSource, pdfPages, MAX_BYTES } from "@/lib/ingest";

export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const u = await apiUser();
    const { id } = await params;
    const subject = await db.subject.findFirst({ where: { id, userId: u.id } });
    if (!subject) throw new HttpError(404, "Subject not found.");

    const type = req.headers.get("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "Choose a file.");
      if (file.size > MAX_BYTES) throw new HttpError(413, "Keep files under 4 MB.");
      const name = file.name || "notes";
      const buf = await file.arrayBuffer();
      if (/\.pdf$/i.test(name) || file.type === "application/pdf") {
        const pages = await pdfPages(buf).catch(() => {
          throw new HttpError(422, "Couldn't read that PDF. Try another file or paste the text.");
        });
        return Response.json(await addSource(id, name, "pdf", pages));
      }
      if (/\.(txt|md|markdown)$/i.test(name) || file.type.startsWith("text/")) {
        const text = new TextDecoder().decode(buf);
        return Response.json(await addSource(id, name, "text", [{ page: 1, text }]));
      }
      throw new HttpError(415, "Upload a PDF, .txt or .md file.");
    }
    const body = (await req.json()) as { title?: string; text?: string };
    const text = (body.text ?? "").trim();
    if (text.length < 200) throw new HttpError(400, "Paste at least a paragraph or two of notes.");
    if (text.length > 200000) throw new HttpError(413, "That is a lot of text. Split it into a few uploads.");
    return Response.json(await addSource(id, body.title?.trim() || "Pasted notes", "text", [{ page: 1, text }]));
  } catch (e) {
    if (e instanceof Error && !(e instanceof HttpError) && e.message.startsWith("That file")) return fail(new HttpError(422, e.message));
    return fail(e);
  }
}
