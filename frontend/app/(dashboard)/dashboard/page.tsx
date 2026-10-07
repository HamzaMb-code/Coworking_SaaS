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
import { getMyFavorites, getMyWorkspaces, type Workspace } from "@/lib/workspaces";

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

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [currentUser, memberships, myBookings, myPayments, savedWorkspaces] = await Promise.all([
          getCurrentUser(), getMyWorkspaces(), getMyBookings(), getMyPayments(), getMyFavorites().catch(() => []),
        ]);
        if (!alive) return;
        setUser(currentUser);
        setBookings(myBookings);
        setPayments(myPayments);
        setFavorites(savedWorkspaces);
        const selectedMembership = memberships.find((workspace) => workspace.id === requestedWorkspaceId)
          ?? memberships.find((workspace) => workspace.pivot?.role === "owner")
          ?? memberships.find((workspace) => workspace.pivot?.role === "staff")
          ?? memberships[0];
        const currentRole: Role = selectedMembership?.pivot?.role ?? "customer";
        setRole(currentRole);

        if (currentRole === "customer") {
          setWorkspaces(memberships);
          return;
        }

        const manageable = memberships.filter((workspace) => workspace.pivot?.role === currentRole);
        setWorkspaces(manageable);
        const activeWorkspace = manageable.find((workspace) => workspace.id === requestedWorkspaceId) ?? manageable[0];
        if (!activeWorkspace) return;

        const [stats, locationBookings, locationResources] = await Promise.all([
          getDashboard(activeWorkspace.id),
          getBookings(activeWorkspace.id),
          getResources(activeWorkspace.id),
        ]);
        if (!alive) return;
        setDashboards([stats]);
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
  }, [requestedWorkspaceId]);

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === requestedWorkspaceId) ?? workspaces[0];
  const upcoming = useMemo(() => bookings.filter((booking) => activeStatuses.has(booking.status) && new Date(booking.start_at) >= new Date()).sort((a, b) => a.start_at.localeCompare(b.start_at)), [bookings]);
  const today = new Date().toDateString();
  const todayBookings = useMemo(() => bookings.filter((booking) => new Date(booking.start_at).toDateString() === today && activeStatuses.has(booking.status)).sort((a, b) => a.start_at.localeCompare(b.start_at)), [bookings, today]);

  if (loading) return <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center text-sm text-slate-500">Preparing your dashboard...</div>;

  return <div className="mx-auto max-w-7xl space-y-7">
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {role === "customer" ? <CustomerOverview user={user} upcoming={upcoming} bookings={bookings} payments={payments} favorites={favorites} router={router} /> : role === "owner" ? <OwnerOverview workspace={selectedWorkspace} dashboards={dashboards} bookings={bookings} resources={resources} /> : <StaffOverview workspace={selectedWorkspace} bookings={bookings} resources={resources} todayBookings={todayBookings} />}
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
    <div className="grid gap-6 xl:grid-cols-[1.4fr_.9fr]"><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Upcoming bookings</h2><p className="mt-1 text-sm text-slate-500">Your next visits and reservation requests.</p></div><Link href="/bookings" className="text-sm font-semibold text-[#176b4d]">All bookings</Link></div>{upcoming.length === 0 ? <Empty message="No upcoming bookings yet." href="/workspaces" action="Explore workspaces" /> : <div className="mt-4 divide-y divide-[#edf0f5]">{upcoming.slice(0, 4).map((booking) => <BookingLine key={booking.id} booking={booking} />)}</div>}</section><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Recent payments</h2><p className="mt-1 text-sm text-slate-500">Your latest payment activity.</p></div><Link href="/payments" className="text-sm font-semibold text-[#176b4d]">View all</Link></div>{payments.length === 0 ? <Empty message="Payments for your bookings will appear here." href="/bookings" action="View bookings" /> : <div className="mt-4 space-y-3">{payments.slice(0, 4).map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-medium">{payment.booking?.workspace?.name ?? `Booking #${payment.booking_id}`}</p><p className="mt-1 text-xs capitalize text-slate-500">{payment.status}</p></div><p className="text-sm font-semibold">{Number(payment.amount).toFixed(2)} MAD</p></div>)}</div>}</section></div>
    <div className="grid gap-6 xl:grid-cols-2"><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Favorite workspaces</h2><Link href="/favorites" className="text-sm font-semibold text-[#176b4d]">Manage</Link></div>{favorites.length === 0 ? <Empty message="Save a workspace to keep it close." href="/workspaces" action="Explore spaces" /> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{favorites.slice(0, 4).map((workspace) => <Link key={workspace.id} href={`/workspaces/${workspace.id}`} className="rounded-xl border p-4 hover:border-[#b9d3c0]"><p className="font-semibold">{workspace.name}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="size-3.5" />{workspace.city}</p></Link>)}</div>}</section><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Booking history</h2><p className="mt-1 text-sm text-slate-500">Recent completed, cancelled, or past bookings.</p></div><Link href="/bookings" className="text-sm font-semibold text-[#176b4d]">View history</Link></div>{bookingHistory.length === 0 ? <p className="mt-5 text-sm text-slate-500">Your completed reservations will appear here.</p> : <div className="mt-3 space-y-2">{bookingHistory.slice(0, 3).map((booking) => <BookingLine key={booking.id} booking={booking} compact />)}</div>}</section></div>
  </>;
}

function OwnerOverview({ workspace, dashboards, bookings, resources }: { workspace?: Workspace; dashboards: DashboardData[]; bookings: Booking[]; resources: Resource[] }) {
  const totals = dashboards.reduce((sum, dashboard) => ({ pending: sum.pending + dashboard.bookings.pending, revenue: sum.revenue + Number(dashboard.revenue.total), active: sum.active + dashboard.resources.active }), { pending: 0, revenue: 0, active: 0 });
  const pendingRequests = bookings.filter((booking) => booking.status === "pending");
  const activity = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return { date, count: bookings.filter((booking) => new Date(booking.start_at).toDateString() === date.toDateString()).length }; });
  const maxActivity = Math.max(1, ...activity.map((item) => item.count));
  const currentBookings = bookings.filter((booking) => activeStatuses.has(booking.status) && new Date(booking.start_at) <= new Date() && new Date(booking.end_at) > new Date());
  const occupiedResourceIds = new Set(currentBookings.filter((booking) => booking.status === "checked_in").map((booking) => booking.resource?.id));
  const reservedResourceIds = new Set(currentBookings.filter((booking) => booking.status !== "checked_in").map((booking) => booking.resource?.id));
  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#176b4d]">Business overview</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Welcome back{workspace ? ` to ${workspace.name}` : ""}.</h1><p className="mt-2 text-slate-500">A clear view of your workspace, resources, and reservations.</p></div><div className="flex flex-wrap gap-2"><Link href="/owner/workspaces" className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold"><Building2 className="size-4" />My workspaces</Link><Link href="/owner/workspaces" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#176b4d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md"><Plus className="size-4" />Add workspace</Link></div></div>
    {pendingRequests.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-amber-950">New booking requests</h2><p className="mt-1 text-sm text-amber-800">{pendingRequests.length} reservation{pendingRequests.length === 1 ? "" : "s"} awaiting your confirmation.</p></div>{workspace && <Link href={`/workspaces/${workspace.id}/bookings`} className="text-sm font-semibold text-amber-950">Review bookings <ArrowRight className="inline size-4" /></Link>}</div><div className="mt-3 divide-y divide-amber-200">{pendingRequests.slice(0, 3).map((booking) => <Link key={booking.id} href={`/workspaces/${booking.workspace?.id ?? workspace?.id}/bookings`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span><strong>{booking.user?.name ?? "Customer"}</strong> requested {booking.resource?.name ?? "a resource"} at {booking.workspace?.name ?? "your workspace"}</span><span className="text-amber-900">{new Date(booking.start_at).toLocaleString()}</span></Link>)}</div></section>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Metric icon={<Banknote />} label="Total revenue" value={`${totals.revenue.toFixed(2)} MAD`} /><Metric icon={<Banknote />} label="Revenue this month" value={`${dashboards.reduce((sum, item) => sum + Number(item.revenue.current_period), 0).toFixed(2)} MAD`} /><Metric icon={<CalendarDays />} label="Total bookings" value={dashboards.reduce((sum, item) => sum + item.bookings.total, 0)} /><Metric icon={<CalendarDays />} label="Today's bookings" value={dashboards.reduce((sum, item) => sum + item.today.bookings, 0)} /><Metric icon={<DoorOpen />} label="Active / total resources" value={`${totals.active} / ${dashboards.reduce((sum, item) => sum + item.resources.total, 0)}`} /><Metric icon={<Users />} label="Workspace members" value={dashboards.reduce((sum, item) => sum + item.members.total, 0)} /></div>
    <section className="grid gap-3 rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:grid-cols-3 lg:grid-cols-5">{(["pending", "confirmed", "checked_in", "completed", "cancelled"] as const).map((status) => <div key={status} className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-medium capitalize text-slate-500">{status.replace("_", " ")}</p><p className="mt-1 text-xl font-bold">{dashboards.reduce((sum, item) => sum + item.bookings[status], 0)}</p></div>)}</section>
    <div className="grid gap-6 xl:grid-cols-[1.45fr_.8fr]"><section id="analytics" className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">Booking activity</h2><p className="mt-1 text-sm text-slate-500">Reservations by start date over the last seven days.</p></div><ActivityLabel /></div><div className="mt-6 flex h-44 items-end gap-3 border-b border-l border-[#edf0f5] px-3 pb-0 pt-3">{activity.map((item) => <div key={item.date.toISOString()} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-[11px] text-slate-500">{item.count}</span><div className="w-full max-w-12 rounded-t-md bg-[#176b4d]" style={{ height: `${Math.max(8, (item.count / maxActivity) * 110)}px` }} /><span className="pb-2 text-[10px] text-slate-400">{item.date.toLocaleDateString(undefined, { weekday: "short" })}</span></div>)}</div></section><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Resource availability</h2><p className="mt-1 text-sm text-slate-500">Active spaces and current reservations.</p>{resources.length === 0 ? <Empty message="Add resources to your workspaces to start accepting bookings." href="/owner/workspaces" action="Manage spaces" /> : <div className="mt-4 space-y-2">{resources.slice(0, 5).map((resource) => { const occupied = occupiedResourceIds.has(resource.id); const reserved = reservedResourceIds.has(resource.id); const status = resource.status !== "active" ? "Inactive" : occupied ? "Occupied" : reserved ? "Reserved" : "Available"; return <div key={resource.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-medium">{resource.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{resource.pricing_unit} · {resource.price} MAD</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "Occupied" ? "bg-amber-50 text-amber-800" : status === "Reserved" ? "bg-blue-50 text-blue-700" : status === "Available" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{status}</span></div>; })}</div>}</section></div>
    <section className="overflow-hidden rounded-2xl border border-[#e8ebf3] bg-white"><div className="flex items-center justify-between p-5 sm:px-6"><div><h2 className="text-lg font-semibold">Recent bookings</h2><p className="mt-1 text-sm text-slate-500">Latest requests for this workspace.</p></div>{workspace && <Link href={`/workspaces/${workspace.id}/bookings`} className="text-sm font-semibold text-[#176b4d]">Manage bookings</Link>}</div>{bookings.length === 0 ? <p className="border-t p-8 text-center text-sm text-slate-500">No reservations yet. Add spaces and share your workspace listing.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3 font-semibold">Customer</th><th className="px-5 py-3 font-semibold">Workspace &amp; resource</th><th className="px-5 py-3 font-semibold">When</th><th className="px-5 py-3 font-semibold">Total</th><th className="px-5 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-[#edf0f5]">{bookings.slice(0, 6).map((booking) => <tr key={booking.id}><td className="px-5 py-4 font-medium">{booking.user?.name ?? "Customer"}</td><td className="px-5 py-4"><p className="font-medium">{booking.resource?.name ?? "Booked resource"}</p><p className="mt-1 text-xs text-slate-500">{booking.workspace?.name ?? "Workspace"}</p></td><td className="px-5 py-4 text-slate-500">{new Date(booking.start_at).toLocaleString()}</td><td className="px-5 py-4 font-medium">{Number(booking.total_price).toFixed(2)} MAD</td><td className="px-5 py-4 capitalize text-slate-600">{booking.status.replace("_", " ")}</td></tr>)}</tbody></table></div>}</section>
    <div className="grid gap-4 sm:grid-cols-3"><QuickAction href="/owner/workspaces" icon={<Plus />} title="Add a workspace" description="List a new location" /><QuickAction href={workspace ? `/workspaces/${workspace.id}/resources` : "/owner/workspaces"} icon={<DoorOpen />} title="Add a resource" description="Create a desk, office, or room" /><QuickAction href={workspace ? `/workspaces/${workspace.id}/members` : "/owner/workspaces"} icon={<Users />} title="Manage your team" description="Invite staff and members" /></div>
  </>;
}

function StaffOverview({ workspace, bookings, resources, todayBookings }: { workspace?: Workspace; bookings: Booking[]; resources: Resource[]; todayBookings: Booking[] }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toDateString());
  const now = new Date();
  const calendarDays = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + index); return date; });
  const selectedDayBookings = bookings.filter((booking) => new Date(booking.start_at).toDateString() === selectedDate && activeStatuses.has(booking.status)).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const upcomingCheckIns = bookings.filter((booking) => booking.status === "confirmed" && new Date(booking.start_at) >= now).sort((a, b) => a.start_at.localeCompare(b.start_at)).slice(0, 5);
  const pending = bookings.filter((booking) => booking.status === "pending");
  const occupied = new Set(bookings.filter((booking) => booking.status === "checked_in" && new Date(booking.end_at) > now).map((booking) => booking.resource.id));
  const reservedNow = new Set(bookings.filter((booking) => activeStatuses.has(booking.status) && new Date(booking.start_at) <= now && new Date(booking.end_at) > now).map((booking) => booking.resource.id));
  const available = resources.filter((resource) => resource.status === "active" && !reservedNow.has(resource.id));
  return <>
    <div><p className="text-sm font-semibold text-[#176b4d]">Daily operations</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Today at {workspace?.name ?? "your workspace"}</h1><p className="mt-2 text-slate-500">Reservations, arrivals, and space status for your shift.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<CalendarDays />} label="Today's reservations" value={todayBookings.length} /><Metric icon={<Clock3 />} label="Upcoming check-ins" value={upcomingCheckIns.length} /><Metric icon={<DoorOpen />} label="Currently occupied" value={occupied.size} /><Metric icon={<CheckCircle2 />} label="Available resources" value={available.length} /></div>
    <div className="grid gap-6 xl:grid-cols-2"><section id="today" className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Today&apos;s bookings</h2><p className="mt-1 text-sm text-slate-500">Keep check-ins moving and the day on schedule.</p>{todayBookings.length === 0 ? <Empty message="There are no reservations starting today." href={workspace ? `/workspaces/${workspace.id}/bookings` : "/workspaces"} action="Booking management" /> : <div className="mt-4 space-y-3">{todayBookings.map((booking) => <BookingLine key={booking.id} booking={booking} />)}</div>}</section><section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Upcoming check-ins</h2><p className="mt-1 text-sm text-slate-500">Confirmed guests due to arrive.</p></div>{workspace && <Link href={`/workspaces/${workspace.id}/bookings`} className="text-sm font-semibold text-[#176b4d]">Open list</Link>}</div>{upcomingCheckIns.length === 0 ? <p className="mt-5 text-sm text-slate-500">No confirmed arrivals are scheduled.</p> : <div className="mt-4 space-y-3">{upcomingCheckIns.map((booking) => <BookingLine key={booking.id} booking={booking} />)}</div>}</section></div>
    <section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><h2 className="text-lg font-semibold">Booking calendar</h2><p className="mt-1 text-sm text-slate-500">Select a day to see scheduled reservations.</p><div className="mt-4 grid grid-cols-7 gap-2">{calendarDays.map((date) => { const count = bookings.filter((booking) => new Date(booking.start_at).toDateString() === date.toDateString() && activeStatuses.has(booking.status)).length; const selected = selectedDate === date.toDateString(); return <button key={date.toISOString()} type="button" onClick={() => setSelectedDate(date.toDateString())} className={`rounded-xl border p-2 text-center sm:p-3 ${selected ? "border-[#176b4d] bg-[#eaf3ed] text-[#176b4d]" : "hover:bg-slate-50"}`}><span className="block text-[10px] font-medium text-slate-400 sm:text-xs">{date.toLocaleDateString(undefined, { weekday: "short" })}</span><span className="mt-1 block text-sm font-bold">{date.getDate()}</span><span className="mt-1 block text-[10px] text-slate-500">{count} bookings</span></button>; })}</div>{selectedDayBookings.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No reservations on this day.</p> : <div className="mt-4 divide-y divide-[#edf0f5]">{selectedDayBookings.map((booking) => <BookingLine key={booking.id} booking={booking} />)}</div>}</section>
    {pending.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-amber-950">Pending confirmations</h2><p className="mt-1 text-sm text-amber-800">{pending.length} reservation requests need review.</p></div>{workspace && <Link href={`/workspaces/${workspace.id}/bookings`} className="text-sm font-semibold text-amber-950">Review requests <ArrowRight className="inline size-4" /></Link>}</div></section>}
    <section className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Space status</h2><p className="mt-1 text-sm text-slate-500">Quick view of today’s resource availability.</p></div>{workspace && <Link href={`/workspaces/${workspace.id}/resources`} className="text-sm font-semibold text-[#176b4d]">Manage resources</Link>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{resources.map((resource) => { const inUse = occupied.has(resource.id); const booked = reservedNow.has(resource.id); return <div key={resource.id} className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-medium">{resource.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{resource.type.replaceAll("_", " ")}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${inUse ? "bg-amber-50 text-amber-800" : booked ? "bg-blue-50 text-blue-700" : resource.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{inUse ? "Occupied" : booked ? "Reserved" : resource.status === "active" ? "Available" : "Inactive"}</span></div>; })}</div></section>
    {workspace && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><QuickAction href={`/workspaces/${workspace.id}/bookings`} icon={<CalendarDays />} title="View bookings" description="Confirm requests and manage reservations" /><QuickAction href={`/workspaces/${workspace.id}/bookings#check-in`} icon={<CheckCircle2 />} title="Check in customer" description="Handle arrivals and completed sessions" /><QuickAction href={`/workspaces/${workspace.id}/resources`} icon={<DoorOpen />} title="View resources" description="Check availability and current occupancy" /><QuickAction href={`/workspaces/${workspace.id}/payments`} icon={<CreditCard />} title="View payments" description="Review workspace payment activity" /></div>}
  </>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) { return <article className="rounded-2xl border border-[#e8ebf3] bg-white p-5"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]">{icon}</span><p className="mt-5 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-[#176b4d]">{value}</p></article>; }
function BookingLine({ booking, compact = false }: { booking: Booking; compact?: boolean }) { const label = ({ pending: "Awaiting confirmation", confirmed: "Confirmed", checked_in: "In progress", completed: "Completed", cancelled: "Cancelled" } as const)[booking.status]; return <article className={`flex items-start justify-between gap-3 ${compact ? "rounded-xl bg-slate-50 p-3" : "py-4"}`}><div className="min-w-0"><p className="truncate font-medium">{booking.resource?.name ?? "Booked resource"}</p><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="size-3.5 shrink-0" />{booking.workspace?.name ?? "Workspace"}{booking.workspace?.city ? `, ${booking.workspace.city}` : ""}</p><p className="mt-2 text-xs text-slate-500">{new Date(booking.start_at).toLocaleString()}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{label}</span></article>; }
function Empty({ message, href, action }: { message: string; href: string; action: string }) { return <div className="mt-5 rounded-xl bg-slate-50 p-5"><p className="text-sm text-slate-500">{message}</p><Link href={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#176b4d]">{action}<ArrowRight className="size-4" /></Link></div>; }
function QuickAction({ href, icon, title, description }: { href: string; icon: React.ReactNode; title: string; description: string }) { return <Link href={href} className="flex items-center gap-4 rounded-2xl border border-[#e8ebf3] bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]">{icon}</span><span><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-slate-500">{description}</span></span><ArrowRight className="ml-auto size-4 text-slate-400" /></Link>; }
function ActivityLabel() { return <span className="rounded-full bg-[#eaf3ed] px-3 py-1 text-xs font-semibold text-[#176b4d]">Last 7 days</span>; }
