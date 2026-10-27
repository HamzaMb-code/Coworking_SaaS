"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { UnreadCountBadge, useUnreadCounts, type UnreadCategory } from "@/components/dashboard/UnreadBadgeProvider";

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const params = useParams();
  const pathname = usePathname();
  const unread = useUnreadCounts();

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
      label: "Customers",
      href: `/workspaces/${workspaceId}/customers`,
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
            const category: UnreadCategory | null = item.label === "Bookings"
              ? "bookings"
              : item.label === "Members"
                ? "memberUpdates"
              : item.label === "Payments"
                ? "payments"
                : null;
            const count = category ? unread[category] : 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={count ? `${item.label}, ${count} unread` : undefined}
                className={
                  isActive
                    ? "flex items-center gap-2 border-b-2 border-[#176b4d] px-1 pb-3 text-sm font-semibold text-[#176b4d]"
                    : "flex items-center gap-2 px-1 pb-3 text-sm text-muted-foreground hover:text-[#176b4d]"
                }
              >
                {item.label}
                <UnreadCountBadge count={count} />
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
