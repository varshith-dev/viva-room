import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viva Room: rehearse your viva out loud, from your own notes",
  description:
    "Upload your notes. An AI examiner asks you questions out loud, listens to your answer, marks it like an answer script and shows the line in your notes you missed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
