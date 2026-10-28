"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowRight, Banknote, Building2, CalendarDays, CheckCircle2, Clock3,
  CreditCard, DoorOpen, Heart, MapPin, Plus, Search, Users,
} from "lucide-react";
import { getCurrentUser, type AuthUser } from "@/lib/auth";
import { getBookings, getMyBookings, type Booking } from "@/lib/bookings";
import { getDashboard, type DashboardData } from "@/lib/dashboard";
import { getMyPayments, type Payment } from "@/lib/payments";
import { getResources, type Resource } from "@/lib/resources";
import { getPendingBookingAlertSeenAt } from "@/lib/booking-alerts";
import { getMyFavorites, getMyWorkspaces, getWorkspaceBankTransferSetupStatus, type Workspace } from "@/lib/workspaces";
import ResourceImage from "@/components/resources/ResourceImage";

type Role = "customer" | "owner" | "staff";
const activeStatuses = new Set(["pending", "confirmed", "checked_in"]);

export default function DashboardPage() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedWorkspaceId = Number(params.get("workspace"));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<Role>("customer");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [favorites, setFavorites] = useState<Workspace[]>([]);
  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingBookingAlertSeenAt, setPendingBookingAlertSeenAt] = useState<string | null>(null);

  useEffect(() => {
    const activeWorkspaceId = requestedWorkspaceId || workspaces[0]?.id || 0;
    const syncSeenAt = (event?: Event) => {
      const detail = (event as CustomEvent<{ workspaceId: number; seenAt: string }> | undefined)?.detail;
      if (detail && detail.workspaceId !== activeWorkspaceId) return;
      setPendingBookingAlertSeenAt(getPendingBookingAlertSeenAt(activeWorkspaceId));
    };
    syncSeenAt();
    window.addEventListener("pending-booking-alert-seen", syncSeenAt);
    return () => window.removeEventListener("pending-booking-alert-seen", syncSeenAt);
  }, [requestedWorkspaceId, workspaces]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [currentUser, memberships] = await Promise.all([getCurrentUser(), getMyWorkspaces()]);
        if (!alive) return;
        setUser(currentUser);
        const selectedMembership = memberships.find((workspace) => workspace.id === requestedWorkspaceId)
          ?? memberships.find((workspace) => workspace.pivot?.role === "owner")
          ?? memberships.find((workspace) => workspace.pivot?.role === "staff")
          ?? memberships[0];
        const currentRole: Role = selectedMembership?.pivot?.role ?? "customer";
        setRole(currentRole);

        if (currentRole === "customer") {
          setWorkspaces(memberships);
          const [myBookings, myPayments, savedWorkspaces] = await Promise.all([
            getMyBookings(), getMyPayments(), getMyFavorites().catch(() => []),
          ]);
          if (!alive) return;
          setBookings(myBookings);
          setPayments(myPayments);
          setFavorites(savedWorkspaces);
          return;
        }

        const manageable = memberships.filter((workspace) => workspace.pivot?.role === currentRole);
        setWorkspaces(manageable);
        const activeWorkspace = manageable.find((workspace) => workspace.id === requestedWorkspaceId) ?? manageable[0];
        if (!activeWorkspace) return;

        const [locationBookings, locationResources] = await Promise.all([
          getBookings(activeWorkspace.id),
          getResources(activeWorkspace.id),
        ]);
        if (!alive) return;
        if (currentRole === "owner") {
          setDashboards([await getDashboard(activeWorkspace.id)]);
          if (!alive) return;
        }
        setBookings(locationBookings);
        setResources(locationResources);
      } catch (requestError: unknown) {
        if (alive) setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load your dashboard." : "Could not load your dashboard.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [requestedWorkspaceId, reloadKey]);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ?? workspaces[0];
  const upcoming = useMemo(() => bookings.filter((booking) => activeStatuses.has(booking.status) && new Date(booking.start_at) >= new Date()).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id), [bookings]);

  if (loading) return role === "staff" ? <StaffOverviewSkeleton /> : <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center text-sm text-slate-500">Preparing your dashboard...</div>;

  return <div className="mx-auto max-w-7xl space-y-7">
    {error && role !== "staff" && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {role === "customer" ? <CustomerOverview user={user} upcoming={upcoming} bookings={bookings} payments={payments} favorites={favorites} router={router} /> : role === "owner" ? <OwnerOverview workspace={selectedWorkspace} dashboards={dashboards} bookings={bookings} resources={resources} pendingBookingAlertSeenAt={pendingBookingAlertSeenAt} /> : error ? <DashboardLoadError onRetry={() => { setLoading(true); setReloadKey((value) => value + 1); }} /> : <StaffOverview user={user} workspace={selectedWorkspace} bookings={bookings} resources={resources} />}
  </div>;
}

function CustomerOverview({ user, upcoming, bookings, payments, favorites, router }: { user: AuthUser | null; upcoming: Booking[]; bookings: Booking[]; payments: Payment[]; favorites: Workspace[]; router: ReturnType<typeof useRouter> }) {
  const [search, setSearch] = useState("");
  const bookingHistory = bookings.filter((booking) => !upcoming.some((next) => next.id === booking.id));
  const paidTotal = payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + Number(payment.amount), 0);
  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#176b4d]">Your workday, your way</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome back, {user?.name.split(" ")[0] ?? "there"}</h1><p className="mt-2 text-slate-500">Find a good place to focus and keep your plans in view.</p></div><div className="flex flex-wrap gap-2"><Link href="/workspaces" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b4d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md"><Search className="size-4" />Find a workspace</Link></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<CalendarDays />} label="Upcoming bookings" value={upcoming.length} /><Metric icon={<CheckCircle2 />} label="Bookings to date" value={bookings.length} /><Metric icon={<Heart />} label="Favorite spaces" value={favorites.length} /><Metric icon={<CreditCard />} label="Paid so far" value={`${paidTotal.toFixed(2)} MAD`} /></div>
    <section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">Quick workspace search</h2><p className="mt-1 text-sm text-slate-500">Search by workspace, neighborhood, or city.</p></div></div><form onSubmit={(event) => { event.preventDefault(); router.push(search.trim() ? `/workspaces?search=${encodeURIComponent(search.trim())}` : "/workspaces"); }} className="mt-4 flex gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-3 size-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try ‘Casablanca’ or ‘meeting room’" className="h-11 w-full rounded-lg border border-[#e5e8f0] pl-10 pr-3 text-sm" /></div><button className="rounded-lg bg-[#176b4d] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md">Search</button></form></section>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_.9fr]"><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Upcoming bookings</h2><p className="mt-1 text-sm text-slate-500">Your next visits and reservation requests.</p></div><Link href="/bookings" className="text-sm font-semibold text-[#176b4d]">All bookings</Link></div>{upcoming.length === 0 ? <Empty message="No upcoming bookings yet." href="/workspaces" action="Explore workspaces" /> : <div className="mt-4 divide-y divide-[#edf0f5]">{upcoming.slice(0, 4).map((booking) => <BookingLine key={booking.id} booking={booking} />)}</div>}</section><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Recent payments</h2><p className="mt-1 text-sm text-slate-500">Your latest payment activity.</p></div><Link href="/payments" className="text-sm font-semibold text-[#176b4d]">View all</Link></div>{payments.length === 0 ? <Empty message="Payments for your bookings will appear here." href="/bookings" action="View bookings" /> : <div className="mt-4 space-y-3">{payments.slice(0, 4).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-medium">{payment.booking?.workspace?.name ?? `Booking ${payment.booking_id}`}</p><p className="mt-1 text-xs capitalize text-slate-500">{payment.status}</p></div><p className="text-sm font-semibold">{Number(payment.amount).toFixed(2)} MAD</p></div>)}</div>}</section></div>
    <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Favorite workspaces</h2><Link href="/favorites" className="text-sm font-semibold text-[#176b4d]">Manage</Link></div>{favorites.length === 0 ? <Empty message="Save a workspace to keep it close." href="/workspaces" action="Explore spaces" /> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{favorites.slice(0, 4).map((workspace) => <Link key={workspace.id} href={`/workspaces/${workspace.id}`} className="rounded-xl border p-4 hover:border-[#b9d3c0]"><p className="font-semibold">{workspace.name}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="size-3.5" />{workspace.city}</p></Link>)}</div>}</section><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Booking history</h2><p className="mt-1 text-sm text-slate-500">Recent completed, cancelled, or past bookings.</p></div><Link href="/bookings" className="text-sm font-semibold text-[#176b4d]">View history</Link></div>{bookingHistory.length === 0 ? <p className="mt-5 text-sm text-slate-500">Your completed reservations will appear here.</p> : <div className="mt-3 space-y-2">{bookingHistory.slice(0, 3).map((booking) => <BookingLine key={booking.id} booking={booking} compact />)}</div>}</section></div>
  </>;
}

function OwnerOverview({ workspace, dashboards, bookings, resources, pendingBookingAlertSeenAt }: { workspace?: Workspace; dashboards: DashboardData[]; bookings: Booking[]; resources: Resource[]; pendingBookingAlertSeenAt: string | null }) {
  const totals = dashboards.reduce((sum, dashboard) => ({ pending: sum.pending + dashboard.bookings.pending, revenue: sum.revenue + Number(dashboard.revenue.total), active: sum.active + dashboard.resources.active }), { pending: 0, revenue: 0, active: 0 });
  const pendingRequests = bookings.filter((booking) => booking.status === "pending" && (!pendingBookingAlertSeenAt || booking.created_at > pendingBookingAlertSeenAt));
  const activity = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return { date, count: bookings.filter((booking) => new Date(booking.start_at).toDateString() === date.toDateString()).length }; });
  const maxActivity = Math.max(1, ...activity.map((item) => item.count));
  const currentBookings = bookings.filter((booking) => activeStatuses.has(booking.status) && new Date(booking.start_at) <= new Date() && new Date(booking.end_at) > new Date());
  const occupiedResourceIds = new Set(currentBookings.filter((booking) => booking.status === "checked_in").map((booking) => booking.resource?.id));
  const reservedResourceIds = new Set(currentBookings.filter((booking) => booking.status !== "checked_in").map((booking) => booking.resource?.id));
  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#176b4d]">Business overview</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome back{workspace ? ` to ${workspace.name}` : ""}.</h1><p className="mt-2 text-slate-500">A clear view of your workspace, resources, and reservations.</p></div><div className="flex flex-wrap gap-2"><Link href="/owner/workspaces" className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold"><Building2 className="size-4" />My workspaces</Link><Link href="/owner/workspaces" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b4d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md"><Plus className="size-4" />Add workspace</Link></div></div>
    {workspace && <BankTransferSetupReminder key={workspace.id} workspace={workspace} />}
    {pendingRequests.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-amber-950">Bookings pending payment</h2><p className="mt-1 text-sm text-amber-800">{pendingRequests.length} reservation{pendingRequests.length === 1 ? "" : "s"} awaiting customer payment or transfer review.</p></div>{workspace && <Link href={`/workspaces/${workspace.id}/bookings`} className="text-sm font-semibold text-amber-950">View bookings <ArrowRight className="inline size-4" /></Link>}</div><div className="mt-3 divide-y divide-amber-200">{pendingRequests.slice(0, 3).map((booking) => <Link key={booking.id} href={`/workspaces/${booking.workspace?.id ?? workspace?.id}/bookings`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span><strong>{booking.user?.name ?? "Customer"}</strong> requested {booking.resource?.name ?? "a resource"} at {booking.workspace?.name ?? "your workspace"}</span><span className="text-amber-900">{new Date(booking.start_at).toLocaleString()}</span></Link>)}</div></section>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric icon={<Banknote />} label="Total revenue" value={`${totals.revenue.toFixed(2)} MAD`} /><Metric icon={<Banknote />} label="Revenue this month" value={`${dashboards.reduce((sum, item) => sum + Number(item.revenue.current_period), 0).toFixed(2)} MAD`} /><Metric icon={<CalendarDays />} label="Total bookings" value={dashboards.reduce((sum, item) => sum + item.bookings.total, 0)} /><Metric icon={<CalendarDays />} label="Today's bookings" value={dashboards.reduce((sum, item) => sum + item.today.bookings, 0)} /><Metric icon={<DoorOpen />} label="Active / total resources" value={`${totals.active} / ${dashboards.reduce((sum, item) => sum + item.resources.total, 0)}`} /><Metric icon={<Users />} label="Workspace members" value={dashboards.reduce((sum, item) => sum + item.members.total, 0)} /></div>
    <section className="grid gap-3 rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:grid-cols-3 lg:grid-cols-5">{(["pending", "confirmed", "checked_in", "completed", "cancelled"] as const).map((status) => <div key={status} className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium capitalize text-slate-500">{status.replace("_", " ")}</p><p className="mt-1 text-xl font-bold">{dashboards.reduce((sum, item) => sum + item.bookings[status], 0)}</p></div>)}</section>
    <div className="grid gap-6 xl:grid-cols-[1.45fr_.8fr]"><section id="analytics" className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Booking activity</h2><p className="mt-1 text-sm text-slate-500">Reservations by start date over the last seven days.</p></div><ActivityLabel /></div><div className="mt-6 flex h-44 items-end gap-3 border-b border-l border-[#edf0f5] px-3 pb-0 pt-3">{activity.map((item) => <div key={item.date.toISOString()} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[11px] text-slate-500">{item.count}</span><div className="w-full max-w-12 rounded-t-md bg-[#176b4d]" style={{ height: `${Math.max(8, (item.count / maxActivity) * 110)}px` }} /><span className="pb-2 text-[10px] text-slate-400">{item.date.toLocaleDateString(undefined, { weekday: "short" })}</span></div>)}</div></section><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Resource availability</h2><p className="mt-1 text-sm text-slate-500">Active spaces and current reservations.</p>{resources.length === 0 ? <Empty message="Add resources to your workspaces to start accepting bookings." href="/owner/workspaces" action="Manage spaces" /> : <div className="mt-4 space-y-2">{resources.slice(0, 5).map((resource) => { const occupied = occupiedResourceIds.has(resource.id); const reserved = reservedResourceIds.has(resource.id); const status = resource.status !== "active" ? "Inactive" : occupied ? "Occupied" : reserved ? "Reserved" : "Available"; return <div key={resource.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-medium">{resource.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{resource.pricing_unit} · {resource.price} MAD</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Occupied" ? "bg-amber-50 text-amber-800" : status === "Reserved" ? "bg-blue-50 text-blue-700" : status === "Available" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{status}</span></div>; })}</div>}</section></div>
    <section className="overflow-hidden rounded-2xl border border-[#e8ebf3] bg-white"><div className="flex items-center justify-between gap-3 p-5 sm:px-6"><div className="min-w-0"><h2 className="text-lg font-semibold">Recent bookings</h2><p className="mt-1 text-sm text-slate-500">Latest requests for this workspace.</p></div>{workspace && <Link href={`/workspaces/${workspace.id}/bookings`} className="shrink-0 text-sm font-semibold text-[#176b4d]">Manage bookings</Link>}</div>{bookings.length === 0 ? <p className="border-t p-8 text-center text-sm text-slate-500">No reservations yet. Add spaces and share your workspace listing.</p> : <><div className="hidden overflow-x-auto xl:block"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3 font-semibold">Booking</th><th className="px-5 py-3 font-semibold">Customer</th><th className="px-5 py-3 font-semibold">Workspace &amp; resource</th><th className="px-5 py-3 font-semibold">When</th><th className="px-5 py-3 font-semibold">Payment method</th><th className="px-5 py-3 font-semibold">Total</th><th className="px-5 py-3 font-semibold">Booking status</th><th className="px-5 py-3 font-semibold">Payment status</th></tr></thead><tbody className="divide-y divide-[#edf0f5]">{bookings.slice(0, 6).map((booking) => <tr key={booking.id}><td className="px-5 py-4 font-semibold">Booking {booking.id}</td><td className="px-5 py-4 font-medium">{booking.user?.name ?? "Customer"}</td><td className="px-5 py-4"><p className="font-medium">{booking.resource?.name ?? "Booked resource"}</p><p className="mt-1 text-xs text-slate-500">{booking.workspace?.name ?? "Workspace"}</p></td><td className="px-5 py-4 text-slate-500">{new Date(booking.start_at).toLocaleString()}</td><td className="px-5 py-4">{booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "—"}</td><td className="px-5 py-4 font-medium">{Number(booking.total_price).toFixed(2)} MAD</td><td className="px-5 py-4 capitalize text-slate-600">{booking.expired ? "Expired" : booking.status.replace("_", " ")}</td><td className="px-5 py-4 capitalize text-slate-600">{booking.fully_paid ? "Paid" : booking.payment?.status ?? "Unpaid"}</td></tr>)}</tbody></table></div><div className="divide-y divide-[#edf0f5] xl:hidden">{bookings.slice(0, 6).map((booking) => <article key={booking.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f5] px-5 py-4"><div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold text-slate-500">Booking {booking.id} · {booking.user?.name ?? "Customer"}</p><p className="mt-1 break-words font-medium">{booking.resource?.name ?? "Booked resource"}</p><p className="mt-1 text-xs text-slate-500">{new Date(booking.start_at).toLocaleString()}</p><p className="mt-1 break-words text-xs text-slate-500">{booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "No payment method"} · {Number(booking.total_price).toFixed(2)} MAD</p></div><div className="ml-auto shrink-0 text-right"><p className="text-xs font-medium capitalize text-slate-600">{booking.expired ? "Expired" : booking.status.replace("_", " ")}</p><p className="mt-1 text-xs capitalize text-slate-500">{booking.fully_paid ? "Paid" : booking.payment?.status ?? "Unpaid"}</p></div></article>)}</div></>}</section>
    <div className="grid gap-4 sm:grid-cols-3"><QuickAction href="/owner/workspaces" icon={<Plus />} title="Add a workspace" description="List a new location" /><QuickAction href={workspace ? `/workspaces/${workspace.id}/resources` : "/owner/workspaces"} icon={<DoorOpen />} title="Add a resource" description="Create a desk, office, or room" /><QuickAction href={workspace ? `/workspaces/${workspace.id}/members` : "/owner/workspaces"} icon={<Users />} title="Manage your team" description="Invite staff and members" /></div>
  </>;
}

function BankTransferSetupReminder({ workspace }: { workspace: Workspace }) {
  const [setupStatus, setSetupStatus] = useState<{ workspaceId: number; configured: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    const loadStatus = () => {
      setSetupStatus(null);
      void getWorkspaceBankTransferSetupStatus(workspace.id)
        .then((configured) => { if (active) setSetupStatus({ workspaceId: workspace.id, configured }); })
        .catch(() => { if (active) setSetupStatus(null); });
    };
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId: number }>).detail;
      if (detail?.workspaceId === workspace.id) loadStatus();
    };
    loadStatus();
    window.addEventListener("workspace-bank-transfer-setup-updated", onUpdated);
    return () => { active = false; window.removeEventListener("workspace-bank-transfer-setup-updated", onUpdated); };
  }, [workspace.id]);

  if (setupStatus?.workspaceId !== workspace.id || setupStatus.configured) return null;

  return <section role="status" aria-labelledby="bank-transfer-reminder-title" className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800"><Banknote className="size-5" /></span><div><h2 id="bank-transfer-reminder-title" className="font-semibold text-amber-950">Bank Transfer Setup Incomplete</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-amber-900">This workspace doesn&apos;t have bank-transfer beneficiary details configured yet. Configure them in Settings to accept bank-transfer payments.</p></div></div>
    <Link href={`/workspaces/${workspace.id}/settings#bank-transfer-details`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#176b4d] px-4 text-sm font-semibold text-white transition hover:bg-[#125a40] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#176b4d]/20">Configure Bank Details<ArrowRight className="size-4" /></Link>
  </section>;
}

function StaffOverview({ user, workspace, bookings, resources }: { user: AuthUser | null; workspace?: Workspace; bookings: Booking[]; resources: Resource[] }) {
  const now = new Date();
  const today = now.toDateString();
  const todayBookings = bookings.filter((booking) => new Date(booking.start_at).toDateString() === today);
  const countToday = (status: Booking["status"]) => todayBookings.filter((booking) => booking.status === status).length;
  const checkedIn = bookings.filter((booking) => booking.status === "checked_in");
  const upcoming = todayBookings.filter((booking) => ["pending", "confirmed"].includes(booking.status) && new Date(booking.start_at) > now).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id).slice(0, 5);
  const occupiedIds = new Set(bookings.filter((booking) => booking.status === "checked_in" && new Date(booking.end_at) > now).map((booking) => booking.resource.id));
  const reservedIds = new Set(bookings.filter((booking) => ["pending", "confirmed"].includes(booking.status) && new Date(booking.start_at) <= now && new Date(booking.end_at) > now).map((booking) => booking.resource.id));
  const availableResources = resources.filter((resource) => resource.status === "active" && !occupiedIds.has(resource.id) && !reservedIds.has(resource.id));
  const occupiedResources = resources.filter((resource) => resource.status === "active" && occupiedIds.has(resource.id));
  const reservedResources = resources.filter((resource) => resource.status === "active" && !occupiedIds.has(resource.id) && reservedIds.has(resource.id));
  const inactiveResources = resources.filter((resource) => resource.status !== "active");
  const todayHref = workspace ? `/workspaces/${workspace.id}/bookings/today` : "/dashboard";
  const resourcesHref = workspace ? `/workspaces/${workspace.id}/resources` : "/dashboard";
  const firstName = user?.name.trim().split(/\s+/)[0] || "there";
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";

  return <div className="space-y-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-[#176b4d]">Staff overview{workspace ? ` · ${workspace.name}` : ""}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{greeting}, {firstName}</h1><p className="mt-2 text-slate-500">Here&apos;s what&apos;s happening in your workspace today.</p></div>
      <div className="rounded-xl border border-[#e4ebe5] bg-white px-4 py-3 text-sm font-medium text-slate-600"><CalendarDays className="mr-2 inline size-4 text-[#176b4d]" />{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
    </header>

    <section aria-label="Today's overview" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <OverviewMetric icon={<CalendarDays />} label="Today’s Bookings" value={todayBookings.length} href={todayHref} action="View bookings" tone="green" />
      <OverviewMetric icon={<Clock3 />} label="Pending" value={countToday("pending")} href={todayHref} action="Review today" tone="amber" />
      <OverviewMetric icon={<DoorOpen />} label="Currently Checked In" value={checkedIn.length} href={todayHref} action="View bookings" tone="violet" />
      <OverviewMetric icon={<CheckCircle2 />} label="Completed Today" value={countToday("completed")} href={todayHref} action="View bookings" tone="emerald" />
      <OverviewMetric icon={<CalendarDays />} label="No Shows Today" value={countToday("no_show")} href={todayHref} action="View bookings" tone="orange" />
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.85fr)]">
      <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Upcoming Today</h2><p className="mt-1 text-sm text-slate-500">The next bookings scheduled to arrive.</p></div><span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]"><Clock3 className="size-5" /></span></div>
        {todayBookings.length === 0 ? <Empty message="There are no bookings scheduled for today." href={todayHref} action="Open today’s bookings" /> : upcoming.length === 0 ? <p className="mt-5 rounded-xl bg-[#f8faf8] p-4 text-sm text-slate-500">There are no more bookings scheduled for today.</p> : <div className="mt-4 divide-y divide-[#edf1ed]">{upcoming.map((booking) => <Link key={booking.id} href={`${todayHref}?bookingId=${booking.id}`} className="flex items-center gap-3 py-3 transition hover:bg-[#fbfcfb]">
          <span className="min-w-16 rounded-xl bg-[#eaf3ed] px-2.5 py-2 text-center text-sm font-bold text-[#176b4d]">{new Date(booking.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">Booking {booking.id} · {booking.user.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{booking.resource.name} · Payment {booking.fully_paid ? "Paid" : booking.payment?.status ?? "Unpaid"}</span></span>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${booking.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-800"}`}>{booking.status === "pending" ? "Pending" : "Confirmed"}</span><ArrowRight className="size-4 shrink-0 text-slate-400" />
        </Link>)}</div>}
        <Link href={todayHref} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#176b4d] hover:underline">View all today&apos;s bookings<ArrowRight className="size-4" /></Link>
      </section>

      <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Resource Availability</h2><p className="mt-1 text-sm text-slate-500">Based on resource status and current bookings.</p></div><Link href={resourcesHref} aria-label="Manage resources" className="text-sm font-semibold text-[#176b4d] hover:underline">Manage</Link></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><ResourceCount label="Available" value={availableResources.length} tone="green" /><ResourceCount label="Occupied" value={occupiedResources.length} tone="amber" /><ResourceCount label="Reserved" value={reservedResources.length} tone="blue" /><ResourceCount label="Inactive" value={inactiveResources.length} tone="slate" /></div>
        {resources.length === 0 ? <p className="mt-4 rounded-xl bg-[#f8faf8] p-4 text-sm text-slate-500">No resources are configured for this workspace.</p> : <div className="mt-4 divide-y divide-[#edf1ed]">{resources.slice(0, 5).map((resource) => {
          const state = resource.status !== "active" ? "Inactive" : occupiedIds.has(resource.id) ? "Occupied" : reservedIds.has(resource.id) ? "Reserved" : "Available";
          const style = state === "Occupied" ? "bg-amber-50 text-amber-800" : state === "Reserved" ? "bg-blue-50 text-blue-800" : state === "Available" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600";
          return <div key={resource.id} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><span className="block truncate text-sm font-medium">{resource.name}</span><span className="mt-0.5 block text-xs capitalize text-slate-500">{resource.type.replaceAll("_", " ")}</span></span><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{state}</span></div>;
        })}</div>}
      </section>
    </div>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)]">
      <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Needs Attention</h2><p className="mt-1 text-sm text-slate-500">Follow up on items that may need staff action.</p></div><span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-700"><Clock3 className="size-5" /></span></div>
        {countToday("pending") === 0 && countToday("no_show") === 0 && checkedIn.length === 0 ? <p className="mt-5 rounded-xl bg-[#f8faf8] p-4 text-sm text-slate-500">Everything is up to date.</p> : <div className="mt-4 space-y-2">
          {countToday("pending") > 0 && <AttentionLink href={`${todayHref}?status=pending`} title={`${countToday("pending")} pending booking${countToday("pending") === 1 ? "" : "s"}`} detail="Review today’s booking requests" />}
          {checkedIn.length > 0 && <AttentionLink href={todayHref} title={`${checkedIn.length} customer${checkedIn.length === 1 ? "" : "s"} currently checked in`} detail="Review active stays and check-outs" />}
          {countToday("no_show") > 0 && <AttentionLink href={`${todayHref}?status=no_show`} title={`${countToday("no_show")} no-show${countToday("no_show") === 1 ? "" : "s"} today`} detail="View today’s booking records" />}
        </div>}
      </section>

      <section className="rounded-2xl border border-[#e4ebe5] bg-white p-5 shadow-sm sm:p-6"><div><h2 className="text-lg font-semibold">Quick Actions</h2><p className="mt-1 text-sm text-slate-500">Go directly to daily workspace tasks.</p></div><div className="mt-4 grid gap-2"><QuickAction href={todayHref} icon={<CalendarDays />} title="Today’s Bookings" description="Review and manage arrivals" /><QuickAction href={resourcesHref} icon={<DoorOpen />} title="Manage Resources" description="Check spaces and their status" />{workspace && <><QuickAction href={`/workspaces/${workspace.id}/customers`} icon={<Users />} title="View Customers" description="Look up customer contact and booking history" /><QuickAction href={`/workspaces/${workspace.id}/bookings`} icon={<CheckCircle2 />} title="Booking Management" description="Open the full booking list" /></>}</div></section>
    </div>
  </div>;
}

function OverviewMetric({ icon, label, value, href, action, tone }: { icon: React.ReactNode; label: string; value: number; href: string; action: string; tone: "green" | "amber" | "violet" | "emerald" | "orange" }) {
  const tones = { green: "bg-[#eaf3ed] text-[#176b4d]", amber: "bg-amber-50 text-amber-800", violet: "bg-violet-50 text-violet-800", emerald: "bg-emerald-50 text-emerald-800", orange: "bg-orange-50 text-orange-800" };
  return <article className="card-surface p-4 shadow-[0_2px_8px_rgba(21,59,43,0.04)] sm:p-5"><span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>{icon}</span><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-[#26332e]">{value}</p><Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#176b4d] hover:underline">{action}<ArrowRight className="size-3.5" /></Link></article>;
}

function ResourceCount({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "blue" | "slate" }) {
  const styles = { green: "bg-emerald-50 text-emerald-800", amber: "bg-amber-50 text-amber-800", blue: "bg-blue-50 text-blue-800", slate: "bg-slate-100 text-slate-700" };
  return <div className="rounded-xl bg-[#f8faf8] p-3"><p className="text-xl font-bold">{value}</p><p className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[tone]}`}>{label}</p></div>;
}

function AttentionLink({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link href={href} className="flex items-center justify-between gap-3 rounded-xl border border-[#edf1ed] p-3 transition hover:border-[#b9d3c0] hover:bg-[#fbfcfb]"><span><span className="block text-sm font-semibold">{title}</span><span className="mt-0.5 block text-xs text-slate-500">{detail}</span></span><ArrowRight className="size-4 shrink-0 text-[#176b4d]" /></Link>;
}

function StaffOverviewSkeleton() {
  return <div className="space-y-7" aria-label="Loading staff overview"><div className="h-24 animate-pulse rounded-2xl bg-[#eaf0eb]" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-[#eaf0eb]" />)}</div><div className="grid gap-6 xl:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-[#eaf0eb]" /><div className="h-80 animate-pulse rounded-2xl bg-[#eaf0eb]" /></div></div>;
}

function DashboardLoadError({ onRetry }: { onRetry: () => void }) {
  return <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-bold">Unable to load dashboard</h1><p className="mt-2 text-sm text-slate-600">Something went wrong while loading your workspace overview.</p><button type="button" onClick={onRetry} className="mt-5 rounded-lg bg-[#176b4d] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#125a40]">Try Again</button></section>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <article className="rounded-2xl border border-[#e8ebf3] bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]">{icon}</span><p className="mt-5 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-[#176b4d]">{value}</p></article>; }
function BookingLine({ booking, compact = false }: { booking: Booking; compact?: boolean }) {
  const label = ({ pending: "Pending", confirmed: "Confirmed", checked_in: "In progress", checked_out: "Checked out", completed: "Completed", cancelled: "Cancelled", rejected: "Rejected", no_show: "No-show" } as const)[booking.status];
  const paymentStatus = booking.fully_paid ? "Paid" : booking.payment?.status ?? "Unpaid";
  return <article className={`flex items-start justify-between gap-3 ${compact ? "rounded-xl bg-slate-50 p-3" : "py-4"}`}>
    <div className="flex min-w-0 items-start gap-3"><ResourceImage imageUrl={booking.resource?.image_url} type={booking.resource?.type ?? "desk"} alt={`${booking.resource?.name ?? "Workspace resource"} thumbnail`} className="relative aspect-square size-12 shrink-0 overflow-hidden rounded-lg" sizes="48px" /><div className="min-w-0"><p className="truncate font-medium">{booking.resource?.name ?? "Booked resource"} <span className="text-xs font-normal text-slate-500">· Booking {booking.id}</span></p><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="size-3.5 shrink-0" />{booking.workspace?.name ?? "Workspace"}{booking.workspace?.city ? `, ${booking.workspace.city}` : ""}</p><p className="mt-2 text-xs text-slate-500">{new Date(booking.start_at).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Booking: {label} · Payment: {paymentStatus}</p></div></div>
    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{Number(booking.outstanding_balance ?? booking.total_price).toFixed(2)} MAD due</span>
  </article>;
}
function Empty({ message, href, action }: { message: string; href: string; action: string }) { return <div className="mt-5 rounded-xl bg-slate-50 p-5"><p className="text-sm text-slate-500">{message}</p><Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#176b4d]">{action}<ArrowRight className="size-4" /></Link></div>; }
function QuickAction({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) { return <Link href={href} className="card-surface card-interactive flex items-center gap-4 p-3.5"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]">{icon}</span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span><ArrowRight className="ml-auto size-4 text-slate-400" /></Link>; }
function ActivityLabel() { return <span className="rounded-full bg-[#eaf3ed] px-3 py-1 text-xs font-semibold text-[#176b4d]">Last 7 days</span>; }
