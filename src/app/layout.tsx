import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSMS - Digital Student Movement Management System",
  description: "Sistem digital pengurusan pergerakan pelajar kolej.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ms" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-surface text-ink">{children}</body>
    </html>
  );
}
