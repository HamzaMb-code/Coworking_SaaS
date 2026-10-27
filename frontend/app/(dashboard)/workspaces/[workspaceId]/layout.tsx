"use client";

import Link from "next/link";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-5">
      {/* Back to workspaces */}
      <Link
        href="/workspaces"
        className="inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to workspaces
      </Link>

      {/* Current workspace page */}
      {children}
    </div>
  );
}
