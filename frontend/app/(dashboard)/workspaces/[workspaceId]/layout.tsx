"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const params = useParams();
  const pathname = usePathname();

  const workspaceId = Number(params.workspaceId);

  const navigation = [
    {
      label: "Overview",
      href: `/workspaces/${workspaceId}`,
    },
    {
      label: "Resources",
      href: `/workspaces/${workspaceId}/resources`,
    },
    {
      label: "Members",
      href: `/workspaces/${workspaceId}/members`,
    },
    {
      label: "Bookings",
      href: `/workspaces/${workspaceId}/bookings`,
    },
    {
      label: "Payments",
      href: `/workspaces/${workspaceId}/payments`,
    },
    {
      label: "Settings",
      href: `/workspaces/${workspaceId}/settings`,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Back to workspaces */}
      <Link
        href="/workspaces"
        className="inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to workspaces
      </Link>

      {/* Workspace navigation */}
      <nav className="overflow-x-auto border-b">
        <div className="flex min-w-max gap-6">
          {navigation.map((item) => {
            const isActive =
              item.label === "Overview"
                ? pathname === item.href
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "border-b-2 border-foreground px-1 pb-3 text-sm font-medium"
                    : "px-1 pb-3 text-sm text-muted-foreground hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Current workspace page */}
      {children}
    </div>
  );
}
