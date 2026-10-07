"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Building2, CalendarCheck, CalendarDays, Compass,
  CreditCard, DoorOpen, Heart, Inbox, LayoutDashboard, LogOut, Settings,
  UserRound, Users, Wallet,
} from "lucide-react";
import { getCurrentUser, logout, type AuthUser } from "@/lib/auth";
import { getMyWorkspaces, type Workspace } from "@/lib/workspaces";

type DashboardRole = "customer" | "owner" | "staff";
type NavLink = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const navigation: Record<DashboardRole, NavLink[]> = {
  customer: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Explore Workspaces", href: "/workspaces", icon: Compass },
    { label: "My Bookings", href: "/bookings", icon: CalendarDays },
    { label: "Invitations", href: "/invitations", icon: Inbox },
    { label: "Favorites", href: "/favorites", icon: Heart },
    { label: "Payments & Invoices", href: "/payments", icon: CreditCard },
    { label: "Profile & Settings", href: "/profile", icon: UserRound },
  ],
  owner: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Explore Workspaces", href: "/workspaces", icon: Compass },
    { label: "My Workspaces", href: "/owner/workspaces", icon: Building2 },
    { label: "Resources", href: "resources", icon: DoorOpen },
    { label: "Bookings", href: "bookings", icon: CalendarDays },
    { label: "Invitations", href: "/invitations", icon: Inbox },
    { label: "Members & Staff", href: "members", icon: Users },
    { label: "Revenue & Payments", href: "payments", icon: Wallet },
    { label: "Settings", href: "settings", icon: Settings },
  ],
  staff: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Explore Workspaces", href: "/workspaces", icon: Compass },
    { label: "Today's Bookings", href: "/dashboard#today", icon: CalendarCheck },
    { label: "Booking Management", href: "bookings", icon: CalendarDays },
    { label: "Invitations", href: "/invitations", icon: Inbox },
    { label: "Resources", href: "resources", icon: DoorOpen },
    { label: "Check-in", href: "bookings#check-in", icon: DoorOpen },
    { label: "Payments", href: "payments", icon: CreditCard },
    { label: "Profile", href: "/profile", icon: UserRound },
  ],
};

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading dashboard...</div>}><DashboardShell>{children}</DashboardShell></Suspense>;
}

function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedId = Number(searchParams.get("workspace"));

  useEffect(() => {
    let active = true;
    const loadAccount = () => {
      Promise.all([getCurrentUser(), getMyWorkspaces()])
        .then(([currentUser, memberships]) => {
          if (!active) return;
          setUser(currentUser);
          setWorkspaces(memberships);
        })
        .catch(() => {
          if (active) router.replace("/login");
        })
        .finally(() => { if (active) setLoading(false); });
    };
    const refreshMemberships = () => loadAccount();
    loadAccount();
    window.addEventListener("workspace-memberships-changed", refreshMemberships);
    return () => { active = false; window.removeEventListener("workspace-memberships-changed", refreshMemberships); };
  }, [router]);

  const role = useMemo<DashboardRole>(() => {
    const selected = workspaces.find((workspace) => workspace.id === selectedId)
      ?? workspaces.find((workspace) => workspace.pivot?.role === "owner")
      ?? workspaces.find((workspace) => workspace.pivot?.role === "staff")
      ?? workspaces[0];
    return selected?.pivot?.role ?? "customer";
  }, [selectedId, workspaces]);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedId)
    ?? workspaces.find((workspace) => workspace.pivot?.role === "owner")
    ?? workspaces.find((workspace) => workspace.pivot?.role === "staff")
    ?? workspaces[0];

  const getHref = (href: string) => {
    if (href.startsWith("/")) {
      if (selectedWorkspace && href.startsWith("/dashboard")) {
        const [path, fragment] = href.split("#");
        return `${path}?workspace=${selectedWorkspace.id}${fragment ? `#${fragment}` : ""}`;
      }
      return href;
    }
    if (!selectedWorkspace) return role === "owner" ? "/owner/workspaces" : "/workspaces";
    const [path, fragment] = href.split("#");
    const target = path === "settings"
      ? `/workspaces/${selectedWorkspace.id}/settings`
      : `/workspaces/${selectedWorkspace.id}/${path}`;
    return fragment ? `${target}#${fragment}` : target;
  };

  const handleLogout = async () => {
    try { await logout(); } finally { localStorage.removeItem("token"); router.replace("/login"); }
  };

  const nav = navigation[role];

  if (loading) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading your workspace...</div>;

  return <div className="workspace-dashboard min-h-screen bg-[#eceeeb] text-[#1b2b24] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="m-3 rounded-[26px] border-0 bg-[#f7f8f6] lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col">
      <div className="flex h-[72px] items-center gap-3 border-b border-[#e9ece8] px-5"><span className="grid size-9 place-items-center rounded-xl bg-[#176b4d] text-white"><Building2 className="size-5" /></span><span className="font-bold tracking-tight">WorkSpace</span></div>
      {selectedWorkspace && workspaces.length > 1 && <div className="border-b border-[#edf0f5] p-4"><label htmlFor="workspace-switcher" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">Workspace role</label><select id="workspace-switcher" value={selectedWorkspace.id} onChange={(event) => router.push(`/dashboard?workspace=${event.target.value}`)} className="h-10 w-full rounded-lg border border-[#e5e8f0] bg-white px-3 text-sm font-medium">{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name} · {workspace.pivot?.role}</option>)}</select></div>}
      <nav aria-label={`${role} dashboard`} className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">{nav.map(({ label, href, icon: Icon }) => {
        const target = getHref(href);
        const active = !target.includes("#") && pathname === target;
        return <Link key={`${label}-${href}`} href={target} className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition lg:w-full ${active ? "bg-[#e5f0e9] text-[#176b4d]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon className="size-[18px]" />{label}</Link>;
      })}</nav>
      <div className="hidden border-t border-[#edf0f5] p-4 lg:block"><div className="mb-3 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-indigo-50 text-sm font-semibold text-[#4e5ff7]">{user?.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs capitalize text-slate-500">{role} in this workspace</p></div></div><button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-left text-sm font-semibold text-red-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-900/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200"><LogOut className="size-4" />Log out</button></div>
    </aside>
    <div className="m-3 flex min-h-[calc(100vh-1.5rem)] min-w-0 flex-col rounded-[26px] bg-white shadow-sm lg:my-4 lg:mr-4 lg:ml-0"><header className="sticky top-0 z-10 flex h-[72px] items-center justify-between rounded-t-[26px] border-b border-[#edf0ed] bg-white/95 px-5 backdrop-blur sm:px-8"><div><p className="text-xs font-medium capitalize text-slate-400">{role} dashboard</p><p className="text-sm font-semibold">{selectedWorkspace?.name ?? "Your workspace hub"}</p></div><div className="flex items-center gap-3"><Link href="/profile" className="grid size-9 place-items-center rounded-full border border-[#e7eae1] text-slate-600 hover:bg-slate-50" aria-label="Profile settings"><UserRound className="size-4" /></Link><button type="button" onClick={handleLogout} className="grid size-9 place-items-center rounded-full border border-red-200 bg-red-50 text-red-700 shadow-sm transition duration-200 hover:scale-110 hover:border-red-500 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-900/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 lg:hidden" aria-label="Log out"><LogOut className="size-4" /></button></div></header><main className="w-full flex-1 p-4 sm:p-7 lg:p-9">{children}</main><footer className="rounded-b-[26px] border-t border-[#edf0ed] bg-white px-6 py-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} WorkSpace</footer></div>
  </div>;
}
