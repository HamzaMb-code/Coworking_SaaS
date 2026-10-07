import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Workplace | Find your next workspace",
  description: "Find and book flexible workspaces, meeting rooms, and private offices.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
