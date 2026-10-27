"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CreditCard, Download, Eye, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMyBookings, type Booking } from "@/lib/bookings";
import { createPayment, deletePayment, getMyPayments, paymentFile, updatePayment, type Payment } from "@/lib/payments";
import { isWithinBookingPaymentDeadline } from "@/lib/booking-payment-eligibility";
import { getWorkspaceBankTransferDetails, type WorkspaceBankTransferDetails } from "@/lib/workspaces";

const badge: Record<Payment["status"], string> = { pending: "bg-amber-50 text-amber-800", paid: "bg-emerald-50 text-emerald-800", failed: "bg-red-50 text-red-700", refunded: "bg-slate-100 text-slate-600" };
const dateToday = () => new Date().toISOString().slice(0, 10);

export default function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]); const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true); const [working, setWorking] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState("");
  const [bookingId, setBookingId] = useState(""); const [method, setMethod] = useState<"bank_transfer">("bank_transfer"); const [amount, setAmount] = useState(""); const [paymentDate, setPaymentDate] = useState(dateToday()); const [bank, setBank] = useState(""); const [reference, setReference] = useState(""); const [proof, setProof] = useState<File>();
  const [editing, setEditing] = useState<Payment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [proofPreview, setProofPreview] = useState<{ url: string; type: string } | null>(null);
  const [cashInstructionsBookingId, setCashInstructionsBookingId] = useState<number | null>(null);
  const [bankDetailsState, setBankDetailsState] = useState<{ bookingId: number; loading: boolean; details: WorkspaceBankTransferDetails | null; message: string } | null>(null);
  const handledBookingQuery = useRef(false);
  const refresh = async () => { const [p, b] = await Promise.all([getMyPayments(), getMyBookings()]); setPayments(p); setBookings(b); };
  useEffect(() => { void Promise.resolve().then(refresh).catch(() => setError("Could not load your payments.")).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    if (!proofPreview) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") { URL.revokeObjectURL(proofPreview.url); setProofPreview(null); } };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [proofPreview]);
  const availableBalance = (booking: Booking) => Math.max(0, Number(booking.outstanding_balance ?? booking.total_price) - Number(booking.pending_payment_amount ?? 0));
  const eligible = bookings.filter(b => (b.status === "pending" || b.status === "confirmed") && (b.payment_method === "bank_transfer" || b.payment_method === null) && isWithinBookingPaymentDeadline(b) && availableBalance(b) > 0 && !payments.some(p => p.booking_id === b.id && p.booking?.fully_paid));
  useEffect(() => {
    if (loading || handledBookingQuery.current) return;
    const timer = window.setTimeout(() => {
      if (handledBookingQuery.current) return;
      handledBookingQuery.current = true;
      const requestedBookingId = Number(new URLSearchParams(window.location.search).get("bookingId"));
      if (!Number.isInteger(requestedBookingId) || requestedBookingId <= 0) return;
      const requestedBooking = bookings.find(booking => booking.id === requestedBookingId);
      const canSubmit = requestedBooking && (requestedBooking.status === "pending" || requestedBooking.status === "confirmed")
        && isWithinBookingPaymentDeadline(requestedBooking) && availableBalance(requestedBooking) > 0
        && !payments.some(payment => payment.booking_id === requestedBooking.id && payment.booking?.fully_paid);
      if (!requestedBooking || !canSubmit) {
        setError("This booking is not eligible for a new payment submission.");
        return;
      }
      setBookingId(String(requestedBooking.id));
      setAmount(String(availableBalance(requestedBooking)));
      if (requestedBooking.payment_method === "cash") {
        setCashInstructionsBookingId(requestedBooking.id);
        setShowForm(false);
      } else {
        setCashInstructionsBookingId(null);
        setShowForm(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bookings, loading, payments]);
  useEffect(() => {
    const selected = bookings.find(booking => booking.id === Number(bookingId));
    if (!showForm || !selected?.workspace?.id || selected.payment_method === "cash") return;
    let active = true;
    const timer = window.setTimeout(() => {
      setBankDetailsState({ bookingId: selected.id, loading: true, details: null, message: "" });
      getWorkspaceBankTransferDetails(selected.workspace!.id, selected.id)
        .then(response => {
          if (!active) return;
          setBankDetailsState({ bookingId: selected.id, loading: false, details: response.details,
            message: response.configured ? "" : "Bank-transfer details have not been configured for this workspace. Contact them before sending money." });
        })
        .catch(() => { if (active) setBankDetailsState({ bookingId: selected.id, loading: false, details: null, message: "Workspace bank details could not be loaded. Contact the workspace before sending money." }); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [bookingId, bookings, showForm]);
  const handleSubmit = async (event: FormEvent) => { event.preventDefault(); if (!bookingId) return setError("Choose an eligible booking."); setWorking(true); setError(""); setSuccess("");
    try { const selected = bookings.find(b => b.id === Number(bookingId)); const amountDue = Number(editing?.booking?.outstanding_balance ?? selected?.outstanding_balance ?? selected?.total_price ?? 0);
      if (Number(amount).toFixed(2) !== amountDue.toFixed(2)) { setError(`Declare the full remaining balance of ${amountDue.toFixed(2)} MAD. Partial transfers are not accepted.`); return; }
      const data = { payment_method: method, amount: Number(amount), payment_date: paymentDate, bank_name: bank, transaction_reference: reference, proof } as const;
      if (editing) await updatePayment(Number(editing.booking?.workspace?.id), editing.id, data); else await createPayment(Number(selected?.workspace?.id), Number(bookingId), data);
      await refresh(); setAmount(""); setProof(undefined); setEditing(null); setShowForm(false); setSuccess(editing ? "Pending submission updated." : "Submission received. It will not count toward your balance until the workspace verifies it.");
    } catch (e: unknown) { const maybe = e as { response?: { data?: { message?: string; errors?: Record<string,string[]> } } }; setError(maybe.response?.data?.message ?? Object.values(maybe.response?.data?.errors ?? {})[0]?.[0] ?? "Could not submit payment."); } finally { setWorking(false); }
  };
  const download = async (url: string, name: string) => { try { const blob = await paymentFile(url); const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(blob); anchor.download = name; anchor.click(); URL.revokeObjectURL(anchor.href); } catch { setError("Could not download this file."); } };
  const viewProof = async (url: string) => {
    try {
      const blob = await paymentFile(url);
      if (blob.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const loadingTask = pdfjs.getDocument({ data: await blob.arrayBuffer() });
        const pdfDocument = await loadingTask.promise;
        try {
          const page = await pdfDocument.getPage(1);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = window.document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas rendering is unavailable.");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvas, viewport }).promise;
          const image = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
          if (!image) throw new Error("Could not render the proof image.");
          setProofPreview({ url: URL.createObjectURL(image), type: image.type });
        } finally {
          await loadingTask.destroy();
        }
      } else {
        setProofPreview({ url: URL.createObjectURL(blob), type: blob.type });
      }
    } catch {
      setError("Could not open this proof.");
    }
  };
  const closeProofPreview = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview.url);
    setProofPreview(null);
  };
  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading your payments...</p>;
  return <div className="mx-auto max-w-6xl space-y-7">
    <header><p className="text-sm font-semibold text-[#176b4d]">Your spending</p><h1 className="mt-1 text-3xl font-bold">Payments &amp; receipts</h1><p className="mt-2 text-slate-500">Submit bank-transfer proof and track verification for your bookings.</p></header>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    {cashInstructionsBookingId && (() => { const cashBooking = bookings.find(booking => booking.id === cashInstructionsBookingId); return cashBooking ? <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="font-semibold text-emerald-950">Cash payment · Booking {cashBooking.id}</h2><p className="mt-2 text-sm text-emerald-900">Pay the full outstanding balance of <strong>{availableBalance(cashBooking).toFixed(2)} MAD</strong> in person to authorized workspace staff. Staff must verify that this booking is eligible and secures its time slot before accepting cash.</p>{cashBooking.payment_deadline_at && cashBooking.status === "pending" && <p className="mt-2 text-sm text-emerald-900">Complete payment by {new Date(cashBooking.payment_deadline_at).toLocaleString()} to keep this reservation.</p>}</section> : null; })()}
    <section className="rounded-2xl border border-[#dce7de] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold text-[#176b4d]">{editing ? `Edit pending submission #${editing.id}` : "Submit payment"}</h2><p className="mt-1 text-sm text-slate-500">Only payments verified by the workspace count toward access.</p></div><Button type="button" aria-expanded={showForm} aria-controls="payment-submission-form" onClick={()=>setShowForm(open=>!open)} className="bg-[#176b4d] hover:bg-[#125a40]">{showForm ? <><ChevronUp className="mr-2 size-4"/>Hide form</> : <><ChevronDown className="mr-2 size-4"/>Submit verification</>}</Button></div>
      {showForm && <div id="payment-submission-form" className="mt-6">{eligible.length === 0 && !editing ? <p className="text-sm text-slate-500">There are no eligible bookings with a remaining balance before the payment deadline.</p> : <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {!editing && <label className="space-y-1 text-sm font-medium">Booking<select required value={bookingId} onChange={e => { setBookingId(e.target.value); const b = bookings.find(x => x.id === Number(e.target.value)); if (b) setAmount(String(availableBalance(b))); }} className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="">Choose a booking</option>{eligible.map(b => <option key={b.id} value={b.id}>#{b.id} · {b.resource.name} · available {availableBalance(b).toFixed(2)} MAD</option>)}</select></label>}
        <label className="space-y-1 text-sm font-medium">Payment method<select value={method} onChange={e => setMethod(e.target.value as typeof method)} className="mt-1 h-10 w-full rounded-md border bg-white px-3"><option value="bank_transfer">Bank transfer</option></select></label>
        {bookingId && <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm md:col-span-2">{bankDetailsState?.bookingId !== Number(bookingId) || bankDetailsState.loading ? <p className="text-blue-900">Loading workspace bank details…</p> : bankDetailsState.details ? <><p className="font-semibold text-blue-950">Transfer beneficiary</p><dl className="mt-2 grid gap-1 text-blue-900 sm:grid-cols-2"><div><dt className="inline font-medium">Beneficiary: </dt><dd className="inline">{bankDetailsState.details.beneficiary_name}</dd></div><div><dt className="inline font-medium">Bank: </dt><dd className="inline">{bankDetailsState.details.bank_name}</dd></div><div className="sm:col-span-2"><dt className="inline font-medium">RIB / IBAN: </dt><dd className="inline break-all font-mono">{bankDetailsState.details.account_identifier}</dd></div></dl><p className="mt-2 text-xs text-blue-800">Transfer the full amount and upload proof below. This information does not verify payment; workspace staff must confirm receipt.</p></> : <p role="status" className="text-amber-900">{bankDetailsState.message || "Choose a booking to load its workspace bank details."}</p>}</div>}
        <label className="space-y-1 text-sm font-medium">Full remaining amount (MAD)<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} className="mt-1 h-10 w-full rounded-md border px-3" />{bookingId && <span className="block text-xs font-normal text-slate-500">Transfer the full outstanding balance shown for this booking; partial declarations cannot be approved.</span>}</label>
        <label className="space-y-1 text-sm font-medium">Payment date<input type="date" max={dateToday()} required value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} className="mt-1 h-10 w-full rounded-md border px-3" /></label>
        {method === "bank_transfer" && <><label className="space-y-1 text-sm font-medium">Bank name<input required value={bank} onChange={e=>setBank(e.target.value)} className="mt-1 h-10 w-full rounded-md border px-3" /></label><label className="space-y-1 text-sm font-medium">Transfer reference (if available)<input value={reference} onChange={e=>setReference(e.target.value)} className="mt-1 h-10 w-full rounded-md border px-3" /></label><label className="space-y-1 text-sm font-medium md:col-span-2">Proof (image or PDF, max 10 MB){editing && " · leave blank to keep current proof"}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required={!editing} onChange={e=>setProof(e.target.files?.[0])} className="mt-1 block w-full text-sm" /></label></>}
        <div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={working} className="bg-[#176b4d] hover:bg-[#125a40]">{working ? "Submitting..." : editing ? "Save changes" : "Submit for verification"}</Button>{editing && <Button type="button" variant="outline" onClick={()=>{setEditing(null);setShowForm(false)}}>Cancel</Button>}</div>
      </form>}</div>}
    </section>
    <section className="space-y-4"><div><h2 className="text-lg font-semibold">Payments</h2><p className="text-sm text-slate-500">{payments.length} declaration{payments.length === 1 ? "" : "s"}</p></div>
      {payments.length === 0 ? <div className="rounded-2xl border border-dashed p-12 text-center"><CreditCard className="mx-auto size-8 text-[#176b4d]"/><p className="mt-3 font-medium">No payment declarations yet</p><Link href="/bookings" className="mt-4 inline-flex rounded-lg border px-4 py-2 text-sm">View bookings</Link></div> : <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[920px] text-left text-sm"><thead className="bg-[#edf5ef] text-slate-700"><tr>{["Date", "Montant", "Banque", "Type de paiement", "Statut", "Justificatif", "Reçu", "Action"].map(label=><th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y">{payments.map(p=><tr key={p.id} id={`booking-payment-${p.booking_id}`}>
        <td className="px-4 py-4"><div>{p.payment_date ?? (p.submitted_at ? new Date(p.submitted_at).toLocaleDateString() : "—")}</div><div className="mt-1 text-xs text-slate-500">Booking {p.booking_id} · {p.booking?.resource?.name ?? "Workspace"}</div></td>
        <td className="px-4 py-4 font-semibold">{Number(p.amount).toFixed(2)} MAD</td>
        <td className="px-4 py-4">{p.bank_name ?? "—"}{p.transaction_reference && <div className="mt-1 text-xs text-slate-500">Réf. {p.transaction_reference}</div>}</td>
        <td className="px-4 py-4">{p.payment_method === "bank_transfer" ? "Virement bancaire" : p.payment_method === "cash" ? "Espèces" : p.payment_method === "card" ? "Carte" : "—"}</td>
        <td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badge[p.status]}`}>{p.status === "pending" ? "En attente" : p.status === "paid" ? "Approuvée" : p.status === "failed" ? "Rejetée" : "Remboursée"}</span>{p.rejection_reason && <p className="mt-2 max-w-56 text-xs text-red-700">{p.rejection_reason}</p>}</td>
        <td className="px-4 py-4">{p.links?.proof ? <Button type="button" variant="outline" size="sm" aria-label="Voir le justificatif" onClick={()=>viewProof(p.links!.proof!)}><Eye className="mr-1 size-4"/>Voir</Button> : "—"}</td>
        <td className="px-4 py-4">{p.status === "paid" && p.receipt_available && p.links?.receipt ? <Button type="button" variant="outline" size="sm" onClick={()=>download(p.links!.receipt!, `${p.receipt_number}.pdf`)}><Download className="mr-1 size-4"/>Télécharger</Button> : "—"}</td>
        <td className="px-4 py-4">{p.status === "pending" && p.payment_method === "bank_transfer" ? <div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={()=>{setEditing(p);setBookingId(String(p.booking_id));setMethod("bank_transfer");setAmount(String(p.amount));setPaymentDate(p.payment_date ?? dateToday());setBank(p.bank_name ?? "");setReference(p.transaction_reference ?? "");setProof(undefined);setShowForm(true);window.scrollTo({top:0,behavior:"smooth"})}}><Pencil className="size-4"/><span className="sr-only">Edit pending declaration</span></Button><Button type="button" variant="outline" size="sm" disabled={working} onClick={async()=>{if(!window.confirm("Delete this pending payment declaration?"))return;setWorking(true);try{await deletePayment(p.booking?.workspace?.id ?? 0,p.id);await refresh()}catch{setError("Could not delete pending declaration.")}finally{setWorking(false)}}}><Trash2 className="size-4"/><span className="sr-only">Delete pending declaration</span></Button></div> : "—"}</td>
      </tr>)}</tbody></table></div>}
    </section>
    {proofPreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) closeProofPreview(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="proof-preview-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 id="proof-preview-title" className="font-semibold">Justificatif de paiement</h2>
          <Button type="button" variant="ghost" size="icon" aria-label="Fermer l’aperçu" onClick={closeProofPreview}><X className="size-5"/></Button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-3">
          {proofPreview.type.startsWith("image/") ? <img src={proofPreview.url} alt="Justificatif de paiement" className="max-h-[78vh] max-w-full rounded-lg object-contain"/> : <p className="text-sm text-slate-600">Ce format ne peut pas être affiché dans l’aperçu.</p>}
        </div>
      </section>
    </div>}
  </div>;
}
