"use client";

import { CalendarDays, Search } from "lucide-react";
import type { BookingPaymentStatus, BookingStatus } from "@/lib/bookings";

export type BookingListTab = "upcoming" | "history";
export type BookingListFilter = { tab: BookingListTab; status: BookingStatus | ""; from: string; to: string; search: string; resourceId: string; paymentStatus?: BookingPaymentStatus | "unpaid" | ""; paymentMethod?: "bank_transfer" | "cash" | "" };

const upcomingStatuses: BookingStatus[] = ["pending", "confirmed", "checked_in"];
const historyStatuses: BookingStatus[] = ["checked_out", "completed", "cancelled", "rejected", "no_show"];
const labels: Record<BookingStatus, string> = { pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Checked out", completed: "Completed", cancelled: "Cancelled", rejected: "Rejected", no_show: "No-show" };

export function BookingListControls({ filter, onChange, resources = [], showPaymentFilters = false }: { filter: BookingListFilter; onChange: (filter: BookingListFilter) => void; resources?: { id: number; name: string }[]; showPaymentFilters?: boolean }) {
  const update = (values: Partial<BookingListFilter>) => onChange({ ...filter, ...values });
  const statuses = filter.tab === "upcoming" ? upcomingStatuses : historyStatuses;

  return <section className="space-y-4 rounded-2xl border border-[#e3eae3] bg-white p-4 sm:p-5" aria-label="Booking filters">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Booking view">
      {(["upcoming", "history"] as const).map((tab) => <button key={tab} type="button" aria-pressed={filter.tab === tab} onClick={() => update({ tab, status: "" })} className={`min-h-10 rounded-xl px-4 text-sm font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] focus-visible:ring-offset-2 ${filter.tab === tab ? "bg-[#176b4d] text-white" : "border border-[#dce5df] bg-white text-[#526158] hover:bg-[#f4f8f4]"}`}>{tab}</button>)}
    </div>
    <div className={`grid gap-3 sm:grid-cols-2 ${showPaymentFilters ? "xl:grid-cols-8" : "xl:grid-cols-5"}`}>
      <label className="relative sm:col-span-2 xl:col-span-2"><span className="sr-only">Search bookings</span><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input value={filter.search} onChange={(event) => update({ search: event.target.value })} placeholder="Search reference, resource, or customer" className="h-10 w-full rounded-xl border border-[#dce5df] bg-white pl-9 pr-3 text-sm outline-none focus-visible:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#176b4d]/15" /></label>
      <label><span className="sr-only">Filter by status</span><select value={filter.status} onChange={(event) => update({ status: event.target.value as BookingStatus | "" })} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus-visible:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#176b4d]/15"><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></label>
      {resources.length > 0 && <label><span className="sr-only">Filter by resource</span><select value={filter.resourceId} onChange={(event) => update({ resourceId: event.target.value })} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus-visible:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#176b4d]/15"><option value="">All resources</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name}</option>)}</select></label>}
      {showPaymentFilters && <>
        <label><span className="sr-only">Filter by payment status</span><select value={filter.paymentStatus ?? ""} onChange={(event) => update({ paymentStatus: event.target.value as BookingListFilter["paymentStatus"] })} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus-visible:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#176b4d]/15"><option value="">All payment statuses</option><option value="unpaid">Unpaid</option><option value="pending">Pending</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="refunded">Refunded</option></select></label>
        <label><span className="sr-only">Filter by payment method</span><select value={filter.paymentMethod ?? ""} onChange={(event) => update({ paymentMethod: event.target.value as BookingListFilter["paymentMethod"] })} className="h-10 w-full rounded-xl border border-[#dce5df] bg-white px-3 text-sm outline-none focus-visible:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#176b4d]/15"><option value="">All payment methods</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option></select></label>
      </>}
      <label className="relative"><span className="sr-only">Start date from</span><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input type="date" value={filter.from} max={filter.to || undefined} onChange={(event) => update({ from: event.target.value })} aria-label="Start date from" className="h-10 w-full rounded-xl border border-[#dce5df] bg-white pl-9 pr-2 text-sm outline-none focus-visible:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#176b4d]/15" /></label>
      <label className="relative"><span className="sr-only">Start date to</span><CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input type="date" value={filter.to} min={filter.from || undefined} onChange={(event) => update({ to: event.target.value })} aria-label="Start date to" className="h-10 w-full rounded-xl border border-[#dce5df] bg-white pl-9 pr-2 text-sm outline-none focus-visible:border-[#176b4d] focus-visible:ring-2 focus-visible:ring-[#176b4d]/15" /></label>
    </div>
  </section>;
}

export function BookingListPagination({ page, lastPage, total, perPage, onChange }: { page: number; lastPage: number; total: number; perPage: number; onChange: (page: number) => void }) {
  if (lastPage <= 1) return null;
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  return <nav aria-label="Bookings pagination" className="flex flex-col gap-3 border-t border-[#edf1ed] pt-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between"><p>Showing {start}–{end} of {total} bookings</p><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="min-h-10 rounded-lg border border-[#dce5df] px-3 font-medium text-[#425149] hover:bg-[#f4f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button type="button" disabled={page >= lastPage} onClick={() => onChange(page + 1)} className="min-h-10 rounded-lg border border-[#dce5df] px-3 font-medium text-[#425149] hover:bg-[#f4f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></nav>;
}
