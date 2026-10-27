"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Search,
  X,
} from "lucide-react";

import {
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  getBookingsPage,
  rejectBooking,
  type Booking,
  type BookingStatus,
} from "@/lib/bookings";
import { getResources, type Resource } from "@/lib/resources";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import ResourceImage from "@/components/resources/ResourceImage";
import { BookingListPagination } from "@/components/bookings/BookingListControls";

type StatusFilter = "all" | BookingStatus;

const statusLabel: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Rejected",
  no_show: "No-show",
};

const statusStyle: Record<BookingStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  confirmed: "bg-blue-50 text-blue-800 ring-blue-200",
  checked_in: "bg-violet-50 text-violet-800 ring-violet-200",
  checked_out: "bg-teal-50 text-teal-800 ring-teal-200",
  completed: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelled: "bg-red-50 text-red-800 ring-red-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200",
  no_show: "bg-orange-50 text-orange-800 ring-orange-200",
};

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "checked_in", label: "Checked in" },
  { value: "checked_out", label: "Checked out" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "rejected", label: "Rejected" },
  { value: "no_show", label: "No-show" },
];

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDate(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function displayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(start: string, end: string): string {
  const minutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours && remaining) return `${hours}h ${remaining}m`;
  if (hours) return `${hours}h`;
  return `${remaining}m`;
}

function formatPrice(value: string | number): string {
  return `${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function requestErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Something went wrong. Please try again.";
  const validationErrors = error.response?.data?.errors as Record<string, string[]> | undefined;
  return (validationErrors && Object.values(validationErrors)[0]?.[0])
    || error.response?.data?.message
    || "Something went wrong. Please try again.";
}

export default function TodaysBookingsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = Number(params.workspaceId);
  const { confirm: confirmAction, dialog } = useConfirmDialog();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingPagination, setBookingPagination] = useState<{ current_page: number; per_page: number; total: number; last_page: number } | null>(null);
  const [bookingCounts, setBookingCounts] = useState<Partial<Record<BookingStatus, number>>>({});
  const [page, setPage] = useState(1);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const requestedStatus = searchParams.get("status");
    return statusFilters.some((filter) => filter.value === requestedStatus)
      ? requestedStatus as StatusFilter
      : "all";
  });
  const [resourceFilter, setResourceFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async (showSpinner = true) => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setError("This workspace could not be identified.");
      if (showSpinner) setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      setError("");
      const [bookingData, resourceData] = await Promise.all([
        getBookingsPage(workspaceId, {
          tab: "all", from: selectedDate, to: selectedDate, search,
          status: statusFilter === "all" ? "" : statusFilter,
          resourceId: resourceFilter === "all" ? "" : resourceFilter,
          page, perPage: 25,
        }),
        getResources(workspaceId),
      ]);
      setBookings(bookingData.bookings);
      setBookingPagination(bookingData.pagination);
      setBookingCounts(bookingData.counts ?? {});
      setResources(resourceData);
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [workspaceId, page, resourceFilter, search, selectedDate, statusFilter]);

  useEffect(() => {
    const searchTimer = window.setTimeout(() => void loadData(), search ? 250 : 0);
    const refreshTimer = window.setInterval(() => void loadData(false), 60_000);
    const refreshOnFocus = () => void loadData(false);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(refreshTimer);
      window.clearTimeout(searchTimer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadData, search]);

  useEffect(() => {
    const requestedStatus = searchParams.get("status");
    if (!statusFilters.some((filter) => filter.value === requestedStatus)) return;
    const timer = window.setTimeout(() => { setPage(1); setStatusFilter(requestedStatus as StatusFilter); }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  useEffect(() => {
    const bookingId = Number(searchParams.get("bookingId"));
    if (!bookingId || bookings.length === 0) return;
    const timer = window.setTimeout(() => {
      const booking = bookings.find((item) => item.id === bookingId);
      if (!booking) return;
      setSelectedDate(localDateKey(new Date(booking.start_at)));
      setSelectedBooking(booking);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bookings, searchParams]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const dayBookings = bookings;
  const filteredBookings = bookings;

  const upcomingBookings = useMemo(() => dayBookings
    .filter((booking) => (booking.status === "pending" || booking.status === "confirmed")
      && new Date(booking.start_at).getTime() > currentTime)
    .slice(0, 5), [currentTime, dayBookings]);

  const counts = useMemo(() => ({
    total: Object.values(bookingCounts).reduce((total, count) => total + (count ?? 0), 0),
    pending: bookingCounts.pending ?? 0,
    confirmed: bookingCounts.confirmed ?? 0,
    checkedIn: bookingCounts.checked_in ?? 0,
    completed: bookingCounts.completed ?? 0,
    noShow: bookingCounts.no_show ?? 0,
  }), [bookingCounts]);

  const performAction = async (booking: Booking, action: () => Promise<Booking>, message: string) => {
    try {
      setBusyId(booking.id);
      setError("");
      setSuccess("");
      await action();
      setSuccess(message);
      await loadData(false);
    } catch (requestError: unknown) {
      setError(requestErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  };

  const rejectPending = async (booking: Booking) => {
    const approved = await confirmAction(`Reject booking ${booking.id} for ${booking.user.name}?`);
    if (!approved) return;
    await performAction(booking, () => rejectBooking(workspaceId, booking.id), "Booking rejected.");
  };

  const goToDate = (amount: number) => { setPage(1); setSelectedDate((date) => shiftDate(date, amount)); };
  const isToday = selectedDate === localDateKey(new Date());

  if (loading) {
    return <div className="space-y-7" aria-label="Loading today’s bookings">
      <div className="h-24 animate-pulse rounded-2xl bg-[#eaf0eb]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl bg-[#eaf0eb]" />)}</div>
      <div className="h-96 animate-pulse rounded-2xl bg-[#eaf0eb]" />
    </div>;
  }

  return <div className="space-y-7">
    <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div>
        <p className="text-sm font-semibold text-[#176b4d]">Front desk operations</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Today&apos;s Bookings</h1>
        <p className="mt-2 text-sm text-slate-500">Manage today&apos;s reservations, check-ins, check-outs, and no-shows.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => goToDate(-1)} className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#dce7de] bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-[#f6f9f6]"><ChevronLeft className="size-4" />Previous</button>
        <div className="inline-flex h-10 min-w-48 items-center justify-center gap-2 rounded-xl border border-[#dce7de] bg-white px-3 text-sm font-semibold text-[#26332e]"><CalendarDays className="size-4 text-[#176b4d]" />{displayDate(selectedDate)}</div>
        <button type="button" onClick={() => goToDate(1)} className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#dce7de] bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-[#f6f9f6]">Next<ChevronRight className="size-4" /></button>
        {!isToday && <button type="button" onClick={() => { setPage(1); setSelectedDate(localDateKey(new Date())); }} className="h-10 rounded-xl bg-[#176b4d] px-4 text-sm font-semibold text-white hover:bg-[#125a40]">Today</button>}
      </div>
    </header>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span className="flex items-center gap-2"><AlertCircle className="size-4 shrink-0" />{error}</span><button type="button" onClick={() => void loadData()} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold hover:bg-red-100">Try again</button></div>}
    {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{success}</div>}

    <section aria-label="Booking summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <SummaryCard label="Bookings" value={counts.total} tone="green" />
      <SummaryCard label="Pending" value={counts.pending} tone="amber" />
      <SummaryCard label="Confirmed" value={counts.confirmed} tone="blue" />
      <SummaryCard label="Checked in" value={counts.checkedIn} tone="violet" />
      <SummaryCard label="Completed" value={counts.completed} tone="emerald" />
      <SummaryCard label="No-show" value={counts.noShow} tone="orange" />
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="card-surface min-w-0 overflow-hidden">
        <div className="border-b border-[#edf1ed] p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="font-semibold">Bookings for {isToday ? "today" : displayDate(selectedDate)}</h2><p className="mt-1 text-sm text-slate-500">{filteredBookings.length} of {dayBookings.length} bookings</p></div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="relative sm:col-span-1"><span className="sr-only">Search bookings</span><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search bookings..." className="h-10 w-full rounded-xl border border-[#dce5df] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" /></label>
              <label><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value as StatusFilter); }} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus:border-[#176b4d]"><option value="all">All statuses</option>{statusFilters.slice(1).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span className="sr-only">Filter by resource</span><select value={resourceFilter} onChange={(event) => { setPage(1); setResourceFilter(event.target.value); }} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus:border-[#176b4d]"><option value="all">All resources</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>
            </div>
          </div>
        </div>

        {counts.total === 0 ? <div className="px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf3ed] text-[#176b4d]"><CalendarDays className="size-6" /></span><h3 className="mt-4 font-semibold">No bookings for this day</h3><p className="mt-1 text-sm text-slate-500">There are no bookings scheduled for this day.</p></div>
          : filteredBookings.length === 0 ? <div className="px-6 py-14 text-center"><p className="font-semibold">No matching bookings</p><p className="mt-1 text-sm text-slate-500">Adjust your search or filters to see bookings.</p></div>
            : <>
              <div className="hidden overflow-x-auto xl:block">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="bg-[#f8faf8] text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Booking</th><th className="px-4 py-3 font-semibold">Time</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Resource</th><th className="px-4 py-3 font-semibold">Amount due</th><th className="px-4 py-3 font-semibold">Payment</th><th className="px-4 py-3 font-semibold">Booking status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
                  <tbody className="divide-y divide-[#edf1ed]">{filteredBookings.map((booking) => <tr key={booking.id} className="align-middle hover:bg-[#fbfcfb]">
                    <td className="whitespace-nowrap px-4 py-4 font-semibold">Booking {booking.id}</td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium text-[#26332e]">{formatTime(booking.start_at)} – {formatTime(booking.end_at)}</td>
                    <td className="px-4 py-4"><p className="font-semibold text-[#26332e]">{booking.user.name}</p><p className="mt-0.5 max-w-48 truncate text-xs text-slate-500">{booking.user.email}</p></td>
                    <td className="px-4 py-4"><div className="flex items-center gap-2.5"><ResourceImage imageUrl={booking.resource.image_url} type={booking.resource.type} alt={`${booking.resource.name} thumbnail`} className="relative aspect-square size-10 shrink-0 overflow-hidden rounded-lg" sizes="40px" /><span><span className="block font-medium">{booking.resource.name}</span><span className="mt-0.5 block text-xs capitalize text-slate-500">{booking.resource.type.replaceAll("_", " ")}</span></span></div></td>
                    <td className="whitespace-nowrap px-4 py-4 font-medium">{formatPrice(booking.outstanding_balance ?? booking.total_price)}</td>
                    <td className="px-4 py-4"><p className="font-medium capitalize">{booking.payment?.status ?? "Unpaid"}</p><p className="mt-0.5 text-xs text-slate-500">{booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "—"}</p></td>
                    <td className="px-4 py-4"><StatusBadge status={booking.status} overdue={booking.is_overdue} expired={booking.expired} /></td>
                    <td className="px-4 py-4"><div className="flex justify-end gap-2"><BookingActions booking={booking} busy={busyId === booking.id} onConfirm={() => void performAction(booking, () => confirmBooking(workspaceId, booking.id), "Booking confirmed.")} onReject={() => void rejectPending(booking)} onCheckIn={() => void performAction(booking, () => checkInBooking(workspaceId, booking.id), "Customer checked in.")} onCheckOut={() => void performAction(booking, () => checkOutBooking(workspaceId, booking.id), "Customer checked out; booking completed.")} onView={() => setSelectedBooking(booking)} /></div></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="divide-y divide-[#edf1ed] xl:hidden">{filteredBookings.map((booking) => <article key={booking.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">Booking {booking.id}</p><p className="mt-1 font-semibold">{booking.user.name}</p><p className="mt-0.5 break-all text-xs text-slate-500">{booking.user.email}</p></div><StatusBadge status={booking.status} overdue={booking.is_overdue} expired={booking.expired} /></div>
                <div className="flex items-center gap-3"><ResourceImage imageUrl={booking.resource.image_url} type={booking.resource.type} alt={`${booking.resource.name} thumbnail`} className="relative aspect-square size-12 shrink-0 overflow-hidden rounded-lg" sizes="48px" /><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Resource</p><p className="mt-1 text-sm font-medium text-[#26332e]">{booking.resource.name}</p></div></div>
                <div className="grid grid-cols-2 gap-3 text-sm"><Info label="Time" value={`${formatTime(booking.start_at)} – ${formatTime(booking.end_at)}`} /><Info label="Amount due" value={formatPrice(booking.outstanding_balance ?? booking.total_price)} /><Info label="Payment status" value={booking.payment?.status ?? "Unpaid"} /><Info label="Payment method" value={booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "—"} /></div>
                <div className="flex flex-wrap gap-2 border-t border-[#edf1ed] pt-3"><BookingActions booking={booking} busy={busyId === booking.id} onConfirm={() => void performAction(booking, () => confirmBooking(workspaceId, booking.id), "Booking confirmed.")} onReject={() => void rejectPending(booking)} onCheckIn={() => void performAction(booking, () => checkInBooking(workspaceId, booking.id), "Customer checked in.")} onCheckOut={() => void performAction(booking, () => checkOutBooking(workspaceId, booking.id), "Customer checked out; booking completed.")} onView={() => setSelectedBooking(booking)} /></div>
              </article>)}</div>
            </>}
        {bookingPagination && <div className="p-4 sm:px-5"><BookingListPagination page={bookingPagination.current_page} lastPage={bookingPagination.last_page} total={bookingPagination.total} perPage={bookingPagination.per_page} onChange={setPage} /></div>}
      </section>

      <aside className="card-surface p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">Upcoming {isToday ? "today" : "that day"}</h2><p className="mt-1 text-sm text-slate-500">Next bookings not yet started</p></div><Clock3 className="size-5 text-[#176b4d]" /></div>
        {upcomingBookings.length === 0 ? <p className="mt-5 rounded-xl bg-[#f8faf8] p-4 text-sm text-slate-500">No upcoming bookings.</p> : <div className="mt-4 divide-y divide-[#edf1ed]">{upcomingBookings.map((booking) => <button type="button" key={booking.id} onClick={() => setSelectedBooking(booking)} className="flex w-full items-center justify-between gap-3 py-3 text-left first:pt-0 last:pb-0"><span className="min-w-0"><span className="block text-sm font-semibold">{booking.user.name}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{booking.resource.name}</span></span><span className="shrink-0 text-right"><span className="block text-sm font-semibold text-[#176b4d]">{formatTime(booking.start_at)}</span><span className="mt-0.5 block text-[11px] text-slate-500">{statusLabel[booking.status]}</span></span></button>)}</div>}
      </aside>
    </div>

    {selectedBooking && <BookingDetails booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}
    {dialog}
  </div>;
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "green" | "amber" | "blue" | "violet" | "emerald" | "orange" }) {
  const tones = {
    green: "bg-[#eaf3ed] text-[#176b4d]",
    amber: "bg-amber-50 text-amber-800",
    blue: "bg-blue-50 text-blue-800",
    violet: "bg-violet-50 text-violet-800",
    emerald: "bg-emerald-50 text-emerald-800",
    orange: "bg-orange-50 text-orange-800",
  };
  return <article className="card-surface p-4 shadow-[0_2px_8px_rgba(21,59,43,0.04)] sm:p-5"><p className="text-2xl font-bold tracking-tight text-[#26332e]">{value}</p><p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{label}</p></article>;
}

function StatusBadge({ status, overdue, expired = false }: { status: BookingStatus; overdue: boolean; expired?: boolean }) {
  return <span className="inline-flex flex-wrap items-center gap-1.5"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${expired ? "bg-orange-50 text-orange-800 ring-orange-200" : statusStyle[status]}`}>{expired ? "Expired" : statusLabel[status]}</span>{status === "checked_in" && overdue && <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">Overdue</span>}</span>;
}

function BookingActions({ booking, busy, onConfirm, onReject, onCheckIn, onCheckOut, onView }: { booking: Booking; busy: boolean; onConfirm: () => void; onReject: () => void; onCheckIn: () => void; onCheckOut: () => void; onView: () => void }) {
  const buttonClass = "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-50";
  return <>
    {booking.status === "pending" && <>
      <button type="button" disabled={busy} onClick={onConfirm} className={`${buttonClass} border-[#176b4d] bg-[#176b4d] text-white hover:bg-[#125a40]`}><Check className="size-3.5" />Confirm</button>
      <button type="button" disabled={busy} onClick={onReject} className={`${buttonClass} border-red-200 bg-white text-red-700 hover:bg-red-50`}><X className="size-3.5" />Reject</button>
    </>}
    {booking.can_check_in && <button type="button" disabled={busy} onClick={onCheckIn} className={`${buttonClass} border-[#176b4d] bg-[#176b4d] text-white hover:bg-[#125a40]`}><Check className="size-3.5" />Check in</button>}
    {booking.status === "checked_in" && <button type="button" disabled={busy} onClick={onCheckOut} className={`${buttonClass} border-[#176b4d]/25 bg-[#eaf3ed] text-[#176b4d] hover:bg-[#dcece0]`}>Check out</button>}
    <button type="button" onClick={onView} className={`${buttonClass} border-[#dce5df] bg-white text-slate-700 hover:bg-[#f6f9f6]`}><Eye className="size-3.5" />View</button>
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-sm font-medium text-[#26332e]">{value}</p></div>;
}

function BookingDetails({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm">
    <section role="dialog" aria-modal="true" aria-labelledby="booking-details-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#dce7de] bg-white p-5 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-[#176b4d]">Booking details</p><h2 id="booking-details-title" className="mt-1 text-2xl font-bold">Booking {booking.id}</h2></div><button type="button" aria-label="Close booking details" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="size-4" /></button></div>
      <div className="mt-5 flex flex-wrap items-center gap-2"><StatusBadge status={booking.status} overdue={booking.is_overdue} expired={booking.expired} /></div>
      <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
        <Info label="Customer" value={booking.user.name} />
        <Info label="Email" value={booking.user.email} />
        <Info label="Workspace" value={booking.workspace?.name ?? "—"} />
        <div className="flex items-center gap-3"><ResourceImage imageUrl={booking.resource.image_url} type={booking.resource.type} alt={`${booking.resource.name} thumbnail`} className="relative aspect-square size-12 shrink-0 overflow-hidden rounded-lg" sizes="48px" /><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Resource</p><p className="mt-1 text-sm font-medium text-[#26332e]">{booking.resource.name}</p></div></div>
        <Info label="Date" value={new Date(booking.start_at).toLocaleDateString(undefined, { dateStyle: "long" })} />
        <Info label="Duration" value={formatDuration(booking.start_at, booking.end_at)} />
        <Info label="Start" value={new Date(booking.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} />
        <Info label="End" value={new Date(booking.end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} />
        <Info label="Total price" value={formatPrice(booking.total_price)} />
        <Info label="Amount due" value={formatPrice(booking.outstanding_balance ?? booking.total_price)} />
        <Info label="Payment status" value={booking.fully_paid ? "Paid" : booking.payment?.status ?? "Unpaid"} />
        <Info label="Payment method" value={booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "—"} />
        <Info label="Created at" value={new Date(booking.created_at).toLocaleString()} />
        {booking.payment_deadline_at && booking.status === "pending" && <Info label="Payment deadline" value={new Date(booking.payment_deadline_at).toLocaleString()} />}
        {booking.checked_in_at && <Info label="Checked in at" value={new Date(booking.checked_in_at).toLocaleString()} />}
        {booking.checked_out_at && <Info label="Checked out at" value={new Date(booking.checked_out_at).toLocaleString()} />}
      </div>
    </section>
  </div>;
}
