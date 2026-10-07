"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { CalendarDays, MapPin, CreditCard, ArrowRight } from "lucide-react";
import { cancelBooking, getMyBookings, type Booking } from "@/lib/bookings";

const statusStyle: Record<Booking["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  checked_in: "bg-violet-100 text-violet-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const statusLabel: Record<Booking["status"], string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  checked_in: "Currently using resource",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusDescription: Record<Booking["status"], string> = {
  pending: "The workspace has your request and has not confirmed it yet.",
  confirmed: "The workspace accepted your reservation.",
  checked_in: "Your session is in progress.",
  completed: "Your booking has finished.",
  cancelled: "This reservation will not take place.",
};

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    try { setLoading(true); setError(""); setBookings(await getMyBookings()); }
    catch (requestError: unknown) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load your bookings." : "Could not load your bookings."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => loadBookings()); }, [loadBookings]);
  useEffect(() => { const timer = window.setTimeout(() => setCurrentTime(Date.now()), 0); return () => window.clearTimeout(timer); }, []);

  const handleCancel = async (booking: Booking) => {
    try { setError(""); await cancelBooking(booking.workspace?.id ?? 0, booking.id); await loadBookings(); }
    catch (requestError: unknown) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not cancel this booking." : "Could not cancel this booking."); }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading your bookings...</div>;

  return <div className="space-y-7">
    <div><h1 className="text-3xl font-bold">My bookings</h1><p className="mt-2 text-muted-foreground">Track your reservation requests and upcoming visits.</p></div>
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
    {bookings.length === 0 ? <div className="border border-dashed p-10 text-center"><h2 className="font-semibold">No bookings yet</h2><p className="mt-2 text-sm text-muted-foreground">Explore locations to reserve your first workspace.</p><Link href="/workspaces" className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Find a workspace</Link></div> : <div className="grid gap-4 lg:grid-cols-2">
      {bookings.map((booking) => <article key={booking.id} className="group relative overflow-hidden rounded-[26px] border border-[#e3eae3] bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#c5d8ca] hover:shadow-xl hover:shadow-[#153d2b]/[.06] sm:p-6">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#176b4d] via-emerald-300 to-transparent" />
        <div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{booking.resource.name}</p><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{booking.workspace?.name ?? "Workspace"}{booking.workspace?.city ? `, ${booking.workspace.city}` : ""}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[booking.status]}`}>{statusLabel[booking.status]}</span></div>
        <p className="mt-2 text-sm text-slate-500">{statusDescription[booking.status]}</p>
        <div className="mt-5 border-y border-[#edf1ed] py-4 text-sm"><p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[#176b4d]" />{new Date(booking.start_at).toLocaleString()} to {new Date(booking.end_at).toLocaleString()}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-lg font-bold">{Number(booking.total_price).toFixed(2)} MAD</p><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${booking.payment?.status === "paid" ? "bg-emerald-100 text-emerald-800" : booking.payment?.status === "failed" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}><CreditCard className="size-3.5" />{booking.payment?.status ?? "unpaid"}</span></div></div>
        {booking.status === "confirmed" && booking.payment?.status !== "paid" && booking.payment?.status !== "refunded" && <Link href={`/checkout/${booking.id}`} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#176b4d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#125a40]">{booking.payment?.status === "failed" ? "Retry payment" : booking.payment ? "Continue payment" : "Pay now"}<ArrowRight className="size-4" /></Link>}
        {(booking.status === "pending" || booking.status === "confirmed") && booking.workspace && currentTime !== null && currentTime < new Date(booking.start_at).getTime() && <button type="button" onClick={() => void handleCancel(booking)} className="mt-4 text-sm font-medium text-red-700 hover:underline">Cancel booking</button>}
      </article>)}
    </div>}
  </div>;
}
