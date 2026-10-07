"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, LockKeyhole, MapPin } from "lucide-react";
import { getMyBookings, type Booking } from "@/lib/bookings";
import { createPayment, type PaymentMethod } from "@/lib/payments";

export default function CheckoutPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = Number(params.bookingId);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getMyBookings().then((items) => setBooking(items.find((item) => item.id === bookingId) ?? null))
      .catch(() => setError("We could not load this booking."))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const beginPayment = async () => {
    if (!booking?.workspace || booking.status !== "confirmed") return;
    try {
      setPaying(true); setError(""); setMessage("");
      const payment = await createPayment(booking.workspace.id, booking.id, { payment_method: method });
      setBooking({ ...booking, payment, payment_status: payment.status });
      setMessage("Your payment request is ready. The payment remains pending until it is verified by the workspace or payment provider.");
    } catch (requestError: unknown) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not start payment. Please try again." : "Could not start payment. Please try again.");
    } finally { setPaying(false); }
  };

  if (loading) return <div className="flex min-h-[55vh] items-center justify-center text-sm text-slate-500">Loading secure checkout…</div>;
  if (!booking) return <div className="mx-auto max-w-2xl rounded-3xl border bg-white p-8 text-center"><h1 className="text-2xl font-semibold">Booking not found</h1><Link href="/bookings" className="mt-5 inline-flex text-sm font-semibold text-[#176b4d]">Back to my bookings</Link></div>;

  const total = Number(booking.total_price);
  const canPay = booking.status === "confirmed" && booking.payment?.status !== "paid" && booking.payment?.status !== "refunded";
  return <main className="mx-auto max-w-5xl space-y-7 pb-12">
    <Link href="/bookings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#176b4d]"><ArrowLeft className="size-4" />Back to my bookings</Link>
    <div><p className="text-sm font-semibold text-[#176b4d]">Secure checkout</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Complete your payment</h1><p className="mt-2 text-slate-500">Review your reservation and select a payment method.</p></div>
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {message && <div role="status" className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="mt-0.5 size-5 shrink-0" />{message}</div>}
    {booking.payment?.status === "paid" && <div role="status" className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><CheckCircle2 className="size-5 shrink-0" />Payment verified. Your reservation is paid.</div>}
    {booking.payment?.status === "failed" && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">The payment provider reported that this payment failed. You can retry below.</div>}
    {booking.payment?.status === "pending" && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Payment is pending provider verification. We’ll show it as paid only after verification succeeds.</div>}
    {booking.status !== "confirmed" && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Payment becomes available after the workspace confirms your booking. Current booking status: <span className="font-semibold capitalize">{booking.status.replace("_", " ")}</span>.</div>}
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-[28px] border border-[#e4eae4] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Reservation details</h2>
        <div className="mt-6 rounded-2xl bg-[#f5f8f5] p-5"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-white text-[#176b4d] shadow-sm"><MapPin className="size-5" /></span><div><p className="font-semibold">{booking.workspace?.name ?? "Workspace"}</p><p className="mt-1 text-sm text-slate-500">{booking.workspace?.city ?? ""}</p><p className="mt-3 text-sm font-medium">{booking.resource.name}</p><p className="text-xs capitalize text-slate-500">{booking.resource.type.replaceAll("_", " ")}</p></div></div><div className="mt-5 flex items-start gap-3 border-t border-[#e5ebe5] pt-4 text-sm"><CalendarDays className="mt-0.5 size-4 text-[#176b4d]" /><span>{new Date(booking.start_at).toLocaleString()}<br /><span className="text-slate-500">to {new Date(booking.end_at).toLocaleString()}</span></span></div></div>
        <h2 className="mt-8 text-lg font-semibold">Payment method</h2>
        <label className={`mt-4 flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${method === "card" ? "border-[#176b4d] bg-emerald-50/50" : "border-slate-200"}`}><input type="radio" name="payment-method" value="card" checked={method === "card"} onChange={() => setMethod("card")} className="accent-[#176b4d]" /><span className="grid size-10 place-items-center rounded-xl bg-white text-[#176b4d]"><CreditCard className="size-5" /></span><span><span className="block text-sm font-semibold">Online card payment</span><span className="mt-1 block text-xs text-slate-500">Payment is verified before it is marked paid.</span></span></label>
        <div className="mt-5 flex items-center gap-2 text-xs text-slate-500"><LockKeyhole className="size-4" />Your payment status is updated only after verification.</div>
      </section>
      <aside className="h-fit rounded-[28px] border border-[#e4eae4] bg-white p-6 shadow-sm sm:p-8"><h2 className="text-lg font-semibold">Price breakdown</h2><div className="mt-6 space-y-4 text-sm"><div className="flex justify-between gap-4"><span className="text-slate-500">Booking #{booking.id}</span><span className="font-medium">{total.toFixed(2)} MAD</span></div><div className="flex justify-between gap-4"><span className="text-slate-500">Payment method</span><span className="capitalize">{booking.payment?.payment_method ?? method}</span></div><div className="border-t border-dashed pt-4"><div className="flex justify-between text-base font-bold"><span>Total</span><span>{total.toFixed(2)} MAD</span></div></div></div>
        {booking.payment && <p className="mt-5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Payment status: <span className="font-semibold capitalize">{booking.payment.status}</span></p>}
        {canPay && <button type="button" disabled={paying} onClick={() => void beginPayment()} className="mt-6 w-full rounded-xl bg-[#176b4d] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#176b4d]/15 transition hover:bg-[#125a40] disabled:cursor-not-allowed disabled:opacity-60">{paying ? "Starting payment…" : booking.payment?.status === "failed" ? "Retry payment" : booking.payment ? "Continue payment" : `Pay ${total.toFixed(2)} MAD`}</button>}
        <p className="mt-4 text-center text-xs leading-5 text-slate-400">The total comes from your confirmed booking. We never accept an amount from the browser.</p>
      </aside>
    </div>
  </main>;
}
