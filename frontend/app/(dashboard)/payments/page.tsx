"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, CreditCard, MapPin } from "lucide-react";
import { getMyPayments, type Payment } from "@/lib/payments";

const statusStyle: Record<Payment["status"], string> = {
  pending: "bg-amber-50 text-amber-800",
  paid: "bg-emerald-50 text-emerald-800",
  failed: "bg-red-50 text-red-700",
  refunded: "bg-slate-100 text-slate-600",
};

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { getMyPayments().then(setPayments).catch(() => setError("Could not load your payments.")).finally(() => setLoading(false)); }, []);
  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading your payments...</p>;
  return <div className="mx-auto max-w-6xl space-y-7">
    <div><p className="text-sm font-semibold text-[#176b4d]">Your spending</p><h1 className="mt-1 text-3xl font-bold">Payments &amp; invoices</h1><p className="mt-2 text-slate-500">Review payments linked to your workspace bookings.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {payments.length === 0 ? <div className="rounded-2xl border border-dashed border-[#cbdccf] bg-white p-12 text-center"><CreditCard className="mx-auto size-8 text-[#176b4d]" /><h2 className="mt-4 font-semibold">No payments to show</h2><p className="mt-2 text-sm text-slate-500">Payments will appear here when they are created for your bookings.</p><Link href="/bookings" className="mt-5 inline-flex rounded-lg border border-[#cbdccf] px-4 py-2.5 text-sm font-semibold text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#eaf3ed]">View bookings</Link></div> : <div className="overflow-hidden rounded-2xl border border-[#e8ebf3] bg-white"><div className="divide-y divide-[#edf0f5]">{payments.map((payment) => <article key={payment.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#eaf3ed] text-[#176b4d]"><CreditCard className="size-4" /></span><div><h2 className="font-semibold">{payment.booking?.resource?.name ?? `Booking #${payment.booking_id}`}</h2><p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><MapPin className="size-3.5" />{payment.booking?.workspace?.name ?? "Workspace"}</p></div></div>{payment.booking && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="size-3.5" />{new Date(payment.booking.start_at).toLocaleString()}</p>}</div><div className="flex items-center justify-between gap-4 sm:justify-end"><p className="font-semibold">{Number(payment.amount).toFixed(2)} MAD</p><span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle[payment.status]}`}>{payment.status}</span></div></article>)}</div></div>}
  </div>;
}
