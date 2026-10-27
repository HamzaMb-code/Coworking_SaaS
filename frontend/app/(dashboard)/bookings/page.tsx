"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { CalendarDays, CreditCard, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookingListControls, BookingListPagination, type BookingListFilter } from "@/components/bookings/BookingListControls";
import { cancelBooking, getMyBookingsPage, type Booking, type BookingListPagination as Pagination } from "@/lib/bookings";
import ResourceImage from "@/components/resources/ResourceImage";

const statusStyle: Record<Booking["status"], string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200", confirmed: "bg-blue-50 text-blue-800 ring-blue-200", checked_in: "bg-violet-50 text-violet-800 ring-violet-200", checked_out: "bg-teal-50 text-teal-800 ring-teal-200", completed: "bg-emerald-50 text-emerald-800 ring-emerald-200", cancelled: "bg-red-50 text-red-800 ring-red-200", rejected: "bg-rose-50 text-rose-800 ring-rose-200", no_show: "bg-orange-50 text-orange-800 ring-orange-200",
};
const statusLabel: Record<Booking["status"], string> = {
  pending: "Pending payment", confirmed: "Confirmed", checked_in: "Currently using resource", checked_out: "Checked out", completed: "Completed", cancelled: "Cancelled", rejected: "Rejected", no_show: "No-show",
};
const statusDescription: Record<Booking["status"], string> = {
  pending: "Your resource is held while you complete payment. The workspace confirms the booking after the full amount is recorded.", confirmed: "Your payment is recorded and the workspace confirmed your reservation.", checked_in: "Your session is in progress.", checked_out: "You have checked out.", completed: "Your booking has finished.", cancelled: "This reservation was cancelled.", rejected: "The workspace declined this reservation.", no_show: "The booking ended before you checked in.",
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filter, setFilter] = useState<BookingListFilter>({ tab: "upcoming", status: "", from: "", to: "", search: "", resourceId: "" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    try { setLoading(true); setError(""); const result = await getMyBookingsPage({ ...filter, page, perPage: 10 }); setBookings(result.bookings); setPagination(result.pagination); }
    catch (requestError: unknown) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load your bookings." : "Could not load your bookings."); }
    finally { setLoading(false); }
  }, [filter, page]);

  useEffect(() => { const timer = window.setTimeout(() => void loadBookings(), filter.search ? 250 : 0); return () => window.clearTimeout(timer); }, [loadBookings, filter.search]);
  useEffect(() => { const timer = window.setTimeout(() => setCurrentTime(Date.now()), 0); return () => window.clearTimeout(timer); }, []);

  const updateFilter = (nextFilter: BookingListFilter) => { setPage(1); setFilter(nextFilter); };
  const handleCancel = async (booking: Booking) => {
    try { setError(""); await cancelBooking(booking.workspace?.id ?? 0, booking.id); await loadBookings(); }
    catch (requestError: unknown) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not cancel this booking." : "Could not cancel this booking."); }
  };

  return <div className="space-y-6">
    <header className="border-b border-[#e5ebe6] pb-5"><h1 className="text-3xl font-bold tracking-tight text-[#172441]">My bookings</h1><p className="mt-2 text-sm text-muted-foreground">Keep upcoming visits close and find past reservations whenever you need them.</p></header>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <BookingListControls filter={filter} onChange={updateFilter} />
    <section aria-label={filter.tab === "upcoming" ? "Upcoming bookings" : "Booking history"} aria-busy={loading} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-lg font-semibold text-[#172441]">{filter.tab === "upcoming" ? "Upcoming bookings" : "Booking history"}</h2><p className="mt-1 text-sm text-muted-foreground">{pagination ? `${pagination.total} ${pagination.total === 1 ? "booking" : "bookings"}` : "Your reservations"}</p></div></div>
      {loading ? <div className="space-y-3" aria-label="Loading bookings">{[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border border-[#e4e9e5] bg-white" />)}</div>
        : bookings.length === 0 ? <div className="card-surface border-dashed px-6 py-12 text-center"><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]"><CalendarDays className="size-6" /></span><h3 className="mt-4 font-semibold text-[#172441]">{filter.tab === "upcoming" ? "No upcoming bookings" : "No booking history matches"}</h3><p className="mt-2 text-sm text-muted-foreground">{filter.tab === "upcoming" ? "Your pending and confirmed reservations will appear here." : "Try changing the search, status, or date filters."}</p>{filter.tab === "upcoming" && <Button render={<Link href="/workspaces" />} nativeButton={false} className="mt-5 bg-[#176b4d] text-white hover:bg-[#125a40]">Find a workspace</Button>}</div>
        : <>
          {bookings.map((booking) => <article key={booking.id} className="card-surface grid gap-4 p-4 transition-colors hover:border-[#cbdccf] sm:grid-cols-[76px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4">
            <ResourceImage imageUrl={booking.resource.image_url} type={booking.resource.type} alt={`${booking.resource.name} preview`} className="relative aspect-square size-[76px] overflow-hidden rounded-xl" sizes="76px" />
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold tracking-tight text-[#172441]">{booking.resource.name}</h3><span className="text-xs capitalize text-slate-500">{booking.resource.type.replaceAll("_", " ")}</span><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${booking.expired ? "bg-orange-50 text-orange-800 ring-orange-200" : statusStyle[booking.status]}`}>{booking.expired ? "Expired" : statusLabel[booking.status]}</span><span className="rounded-full bg-[#f4f6f4] px-2.5 py-1 text-[11px] font-medium text-slate-600">Booking {booking.id}</span></div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="size-3.5 shrink-0" />{booking.workspace?.name ?? "Workspace"}{booking.workspace?.city ? `, ${booking.workspace.city}` : ""}</p><p className="mt-2 text-xs leading-5 text-slate-500">{booking.expired ? "The payment deadline passed and the resource hold was released. Create a new booking to continue." : statusDescription[booking.status]}</p>
              {booking.payment_method && <p className="mt-1 text-xs font-medium text-slate-600">Intended payment method: {booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : booking.payment_method}</p>}
              {booking.status === "pending" && booking.payment_deadline_at && <p className="mt-1 text-xs font-medium text-amber-800">{booking.payment?.status === "pending" && booking.payment.payment_method === "bank_transfer" ? "Payment deadline paused while your bank transfer awaits review." : `Complete payment by ${new Date(booking.payment_deadline_at).toLocaleString()} to keep this reservation.`}</p>}
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5 text-[#176b4d]" />{new Date(booking.start_at).toLocaleString()} – {new Date(booking.end_at).toLocaleString()}</span>{booking.checked_in_at && <span>Checked in {new Date(booking.checked_in_at).toLocaleString()}</span>}{booking.checked_out_at && <span>Checked out {new Date(booking.checked_out_at).toLocaleString()}</span>}</div>
              <details className="mt-2 text-xs text-slate-600"><summary className="w-fit cursor-pointer font-semibold text-[#176b4d]">View booking details</summary><dl className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2"><div>Booking: {booking.id}</div><div>Resource type: {booking.resource.type.replaceAll("_", " ")}</div><div>Booking status: {booking.expired ? "Expired" : statusLabel[booking.status]}</div><div>Payment status: {booking.fully_paid ? "Paid" : booking.payment?.status ?? "Unpaid"}</div><div>Payment method: {booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "Not selected"}</div><div>{booking.fully_paid ? "Amount paid" : "Amount due"}: {Number(booking.fully_paid ? booking.verified_amount ?? booking.total_price : booking.outstanding_balance ?? booking.total_price).toFixed(2)} MAD</div></dl></details>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0ed] pt-3 sm:min-w-44 sm:flex-col sm:items-end sm:justify-center sm:border-0 sm:pt-0"><div className="text-right"><p className="text-lg font-semibold text-[#176b4d]">{booking.fully_paid ? `${Number(booking.verified_amount ?? booking.total_price).toFixed(2)} MAD paid` : `${Number(booking.outstanding_balance ?? booking.total_price).toFixed(2)} MAD due`}</p><span className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${booking.fully_paid || booking.payment?.status === "paid" ? "bg-emerald-50 text-emerald-800" : booking.payment?.status === "failed" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-600"}`}><CreditCard className="size-3" />Payment · {booking.fully_paid ? "paid" : booking.payment?.status ?? "unpaid"}</span></div>
              <div className="flex flex-wrap items-center justify-end gap-2">{(booking.status === "pending" || booking.status === "confirmed") && booking.payment?.status !== "paid" && booking.payment?.status !== "refunded" && !(booking.payment?.status === "pending" && booking.payment.payment_method === "bank_transfer") && <Button render={<Link href={`/payments?bookingId=${booking.id}`} />} nativeButton={false} size="sm" className="bg-[#176b4d] text-white hover:bg-[#125a40]">{booking.payment?.status === "failed" ? "Retry payment" : booking.payment ? "Continue payment" : "Pay now"}</Button>}{(booking.payment?.status === "paid" || booking.payment?.status === "refunded" || booking.fully_paid) && <Button render={<Link href={`/payments#booking-payment-${booking.id}`} />} nativeButton={false} size="sm" variant="outline">View payment</Button>}{(booking.status === "pending" || booking.status === "confirmed") && booking.workspace && currentTime !== null && currentTime < new Date(booking.start_at).getTime() && <Button type="button" size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => void handleCancel(booking)}>Cancel booking</Button>}</div>
            </div>
          </article>)}
          {pagination && <BookingListPagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} perPage={pagination.per_page} onChange={setPage} />}
        </>}
    </section>
  </div>;
}
