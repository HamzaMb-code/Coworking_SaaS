"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Check, ChevronLeft, ChevronRight, Download, Eye, FileCheck2, Search, X } from "lucide-react";
import { getCashReconciliationCases, getPaymentsPage, paymentFile, refundPayment, resolveCashReconciliationCase, reviewPayment, type CashReconciliationCase, type Payment, type PaymentStatus } from "@/lib/payments";
import { getMyWorkspaces } from "@/lib/workspaces";
import { Button } from "@/components/ui/button";

const statuses: { value: PaymentStatus | ""; label: string; count: PaymentStatus }[] = [
  { value: "", label: "All declarations", count: "pending" },
  { value: "pending", label: "Pending", count: "pending" },
  { value: "paid", label: "Approved", count: "paid" },
  { value: "failed", label: "Rejected", count: "failed" },
  { value: "refunded", label: "Refunded", count: "refunded" },
];
const rejectionReasons = ["Incorrect declared amount", "Invalid or unreadable proof", "Transfer not received", "Missing or inconsistent payment information", "Other"];

export default function PaymentsPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [counts, setCounts] = useState<Record<PaymentStatus, number>>({ pending: 0, paid: 0, failed: 0, refunded: 0 });
  const [lastPage, setLastPage] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [filter, setFilter] = useState<PaymentStatus | "">("");
  const [methodFilter, setMethodFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [canRefund, setCanRefund] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selected, setSelected] = useState<Payment | null>(null);
  const [dialog, setDialog] = useState<"details" | "approve" | "reject" | null>(null);
  const [verificationConfirmed, setVerificationConfirmed] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [reconciliationCases, setReconciliationCases] = useState<CashReconciliationCase[]>([]);

  const loadData = useCallback(async () => {
    if (!workspaceId || Number.isNaN(workspaceId)) return;
    try {
      setLoading(true);
      setError("");
      const [data, memberships] = await Promise.all([
        getPaymentsPage(workspaceId, { page, per_page: 25, status: filter || undefined, method: methodFilter || undefined, search: search || undefined, from: fromDate || undefined, to: toDate || undefined }),
        getMyWorkspaces(),
      ]);
      setPayments(data.data);
      setLastPage(data.lastPage);
      setTotalPayments(data.total);
      setCounts(data.counts);
      setCanRefund(memberships.some((workspace) => workspace.id === workspaceId && workspace.pivot?.role === "owner"));
      const isWorkspaceMember = memberships.some((workspace) => workspace.id === workspaceId && ["owner", "staff"].includes(workspace.pivot?.role ?? ""));
      if (isWorkspaceMember) setReconciliationCases(await getCashReconciliationCases(workspaceId));
      else setReconciliationCases([]);
    } catch (cause: unknown) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? "Failed to load payment declarations." : "Failed to load payment declarations.");
    } finally { setLoading(false); }
  }, [workspaceId, page, filter, methodFilter, search, fromDate, toDate]);

  useEffect(() => { void Promise.resolve().then(loadData); }, [loadData]);

  const formatAmount = (amount: string | number | undefined) => `${Number(amount ?? 0).toFixed(2)} MAD`;
  const formatDate = (date: string | null | undefined, dateOnly = false) => date ? new Date(date).toLocaleString(undefined, dateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }) : "—";
  const statusText = (status: PaymentStatus) => ({ pending: "Pending", paid: "Approved", failed: "Rejected", refunded: "Refunded" })[status];
  const statusStyle = (status: PaymentStatus) => ({ pending: "border-amber-200 bg-amber-50 text-amber-800", paid: "border-emerald-200 bg-emerald-50 text-emerald-800", failed: "border-rose-200 bg-rose-50 text-rose-800", refunded: "border-slate-200 bg-slate-100 text-slate-700" })[status];
  const methodText = (method: string | null) => ({ bank_transfer: "Bank transfer", cash: "Cash", card: "Card" }[method ?? ""] ?? method ?? "—");

  const showDialog = (payment: Payment, mode: "details" | "approve" | "reject") => {
    setSelected(payment); setDialog(mode); setVerificationConfirmed(false); setRejectReason(""); setOtherReason(""); setError("");
  };
  const closeDialog = () => { if (actionId === null) { setDialog(null); setSelected(null); } };
  const download = async (url: string, filename: string) => {
    try { const blob = await paymentFile(url); const objectUrl = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = filename; anchor.click(); URL.revokeObjectURL(objectUrl); }
    catch { setError("Could not download the payment file."); }
  };
  const submitReview = async (approved: boolean) => {
    if (!selected) return;
    const reason = rejectReason === "Other" ? otherReason.trim() : rejectReason;
    if (!approved && reason.length < 3) { setError("Please provide a rejection reason of at least 3 characters."); return; }
    try {
      setActionId(selected.id); setError(""); setSuccess("");
      await reviewPayment(workspaceId, selected.id, approved, reason);
      setSuccess(approved ? "Payment approved and receipt issued." : "Payment rejected with reason recorded.");
      setDialog(null); setSelected(null);
      await loadData();
    } catch (cause: unknown) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? "Could not update this payment. Refresh the list and try again." : "Could not update this payment.");
    } finally { setActionId(null); }
  };
  const handleRefund = async (payment: Payment) => {
    if (!window.confirm(`Only continue after you have processed the ${formatAmount(payment.amount)} refund outside this application. This action records that external refund; it does not move money.`)) return;
    const refundReference = window.prompt("Enter the external refund receipt, transaction, or reconciliation reference:")?.trim();
    if (!refundReference || refundReference.length < 3) { setError("A valid external refund reference is required. No refund was recorded."); return; }
    try { setActionId(payment.id); setError(""); await refundPayment(workspaceId, payment.id, refundReference); setSuccess("External refund recorded. The money movement was handled outside this application."); await loadData(); }
    catch (cause: unknown) { setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? "Failed to refund payment." : "Failed to refund payment."); }
    finally { setActionId(null); }
  };
  const resolveReconciliationCase = async (item: CashReconciliationCase) => {
    const notes = window.prompt(`Add the resolution note for cash reconciliation case #${item.id}:`)?.trim();
    if (!notes || notes.length < 3) return;
    try { setError(""); setSuccess(""); await resolveCashReconciliationCase(workspaceId, item.id, notes); setSuccess(`Cash reconciliation case #${item.id} resolved.`); await loadData(); }
    catch (cause: unknown) { setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? "Could not update the reconciliation case." : "Could not update the reconciliation case."); }
  };

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-medium text-[#176b4d]">Workspace finance</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#1d3027]">Payment verification</h1><p className="mt-2 text-sm text-muted-foreground">Review customer declarations, verify funds, and issue receipts. Refunds must be processed externally before you record them here.</p></div>
      <div className="rounded-xl border border-[#dce7de] bg-white px-4 py-3 text-sm"><span className="font-semibold text-[#176b4d]">{counts.pending}</span><span className="ml-2 text-muted-foreground">awaiting review</span></div>
    </header>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
    {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</div>}

    {reconciliationCases.some((item) => item.status === "open") && <section aria-labelledby="cash-reconciliation-title" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 id="cash-reconciliation-title" className="font-semibold text-amber-950">Cash reconciliation needed</h2>
      <p className="mt-1 text-sm text-amber-900">These cases record cash reported as received when normal payment recording failed. They are not successful payment receipts. Verify the cash ledger before resolving a case.</p>
      <div className="mt-3 space-y-3">{reconciliationCases.filter((item) => item.status === "open").map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3">
        <div className="min-w-0"><p className="font-medium text-slate-900">Case #{item.id} · Booking {item.booking_id ? `${item.booking_id}` : "removed"} · {item.amount == null ? "Amount unverified" : formatAmount(item.amount)}</p><p className="mt-1 break-words text-xs text-slate-600">Staff: {item.staff_member?.name ?? "Unknown"} · Ref: {item.idempotency_key}</p><p className="mt-1 break-words text-xs text-slate-600">{item.reason}</p></div>
        {canRefund && <Button type="button" size="sm" variant="outline" onClick={() => void resolveReconciliationCase(item)}>Resolve case</Button>}
      </div>)}</div>
    </section>}

    <section className="overflow-hidden rounded-2xl border border-[#dce7de] bg-white shadow-sm">
      <div className="border-b border-[#e8eee9] px-5 pt-4">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Payment status">
          {statuses.map(({ value, label, count }) => <button key={label} role="tab" aria-selected={filter === value} onClick={() => { setPage(1); setFilter(value); }} className={`shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition ${filter === value ? "border-[#176b4d] text-[#176b4d]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${filter === value ? "bg-[#e8f2eb] text-[#176b4d]" : "bg-slate-100 text-slate-600"}`}>{value ? counts[count] : Object.values(counts).reduce((sum, n) => sum + n, 0)}</span></button>)}
        </div>
      </div>
      <div className="grid gap-3 border-b border-[#e8eee9] bg-[#fbfcfb] p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">Search customer or booking</span><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400"/><input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Customer, booking, reference" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/15"/></label>
        <label className="text-sm"><span className="sr-only">Payment method</span><select aria-label="Payment method" value={methodFilter} onChange={(e) => { setPage(1); setMethodFilter(e.target.value); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-[#176b4d] focus:outline-none"><option value="">All methods</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option></select></label>
        <label className="text-sm"><span className="sr-only">Submitted from</span><input aria-label="Payment date from" type="date" value={fromDate} onChange={(e) => { setPage(1); setFromDate(e.target.value); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-[#176b4d] focus:outline-none"/></label>
        <label className="text-sm"><span className="sr-only">Submitted to</span><input aria-label="Payment date to" type="date" value={toDate} onChange={(e) => { setPage(1); setToDate(e.target.value); }} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-[#176b4d] focus:outline-none"/></label>
      </div>
      {loading ? <div className="p-12 text-center text-sm text-muted-foreground">Loading payment declarations…</div> : payments.length === 0 ? <div className="p-12 text-center"><FileCheck2 className="mx-auto size-8 text-slate-300"/><p className="mt-3 font-medium">No declarations found</p><p className="mt-1 text-sm text-muted-foreground">Try changing the filters or check back later.</p></div> : <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-[#f4f8f5] text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3 font-semibold">Customer / booking</th><th className="px-4 py-3 font-semibold">Workspace / resource</th><th className="px-4 py-3 font-semibold">Declared payment</th><th className="px-4 py-3 font-semibold">Amount / method</th><th className="px-4 py-3 font-semibold">Bank / reference</th><th className="px-4 py-3 font-semibold">Status / reviewer</th><th className="px-4 py-3 font-semibold">Proof</th><th className="px-4 py-3 font-semibold">Review</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{payments.map((payment) => <tr key={payment.id} className={`transition hover:bg-[#fafcfb] ${payment.status === "pending" ? "bg-amber-50/30" : ""}`}>
              <td className="px-4 py-4"><div className="font-medium text-slate-900">{payment.booking?.customer?.name ?? "Customer"}</div><div className="mt-0.5 text-xs text-muted-foreground">{payment.booking?.customer?.email ?? "—"}</div><div className="mt-1 text-xs font-medium text-[#176b4d]">Booking {payment.booking_id}</div></td>
              <td className="px-4 py-4"><div className="font-medium">{payment.booking?.workspace?.name ?? "—"}</div><div className="mt-0.5 text-xs text-muted-foreground">{payment.booking?.resource?.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground">{formatDate(payment.booking?.start_at, true)} – {formatDate(payment.booking?.end_at, true)}</div></td>
              <td className="px-4 py-4"><div>{formatDate(payment.payment_date, true)}</div><div className="mt-1 text-xs text-muted-foreground">Submitted {formatDate(payment.submitted_at)}</div></td>
              <td className="px-4 py-4"><div className="font-semibold">{formatAmount(payment.amount)}</div><div className="mt-1 text-xs text-muted-foreground">{methodText(payment.payment_method)}</div></td>
              <td className="px-4 py-4"><div>{payment.bank_name ?? (payment.payment_method === "cash" ? "Cash received" : "—")}</div><div className="mt-1 max-w-44 truncate text-xs text-muted-foreground" title={payment.transaction_reference ?? ""}>{payment.transaction_reference ?? "—"}</div></td>
              <td className="px-4 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(payment.status)}`}>{statusText(payment.status)}</span>{payment.verified_at && <div className="mt-1.5 text-xs text-muted-foreground">{payment.verifier_name ?? "Reviewed"}<br/>{formatDate(payment.verified_at)}</div>}</td>
              <td className="px-4 py-4">{payment.links?.proof ? <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => void download(payment.links!.proof!, `payment-proof-${payment.id}`)}><Download className="size-3.5"/>Download</Button> : <span className="text-xs text-muted-foreground">—</span>}</td>
              <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => showDialog(payment, "details")}><Eye className="mr-1.5 size-3.5"/>Details</Button>{payment.status === "pending" && payment.payment_method !== "card" && <><Button type="button" size="sm" className="bg-[#176b4d] hover:bg-[#125a40]" disabled={actionId === payment.id} onClick={() => showDialog(payment, "approve")}>Approve</Button><Button type="button" size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-50" disabled={actionId === payment.id} onClick={() => showDialog(payment, "reject")}>Reject</Button></>}{canRefund && payment.status === "paid" && <Button type="button" size="sm" variant="outline" disabled={actionId === payment.id} onClick={() => void handleRefund(payment)}>Refund</Button>}</div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"><p className="text-sm text-muted-foreground">Showing {payments.length} of {totalPayments} declaration{totalPayments === 1 ? "" : "s"}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4"/>Previous</Button><span className="min-w-20 text-center text-sm">Page {page} / {lastPage}</span><Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight className="size-4"/></Button></div></div>
      </>}
    </section>

    {dialog && selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#dce7de] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b bg-white/95 px-5 py-4 backdrop-blur"><div><p className="text-xs font-medium uppercase tracking-wide text-[#176b4d]">Declaration #{selected.id} · Booking {selected.booking_id}</p><h2 id="payment-dialog-title" className="mt-1 text-xl font-semibold">{dialog === "details" ? "Payment declaration details" : dialog === "approve" ? "Approve this payment?" : "Reject this payment"}</h2></div><button type="button" onClick={closeDialog} aria-label="Close dialog" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#176b4d]"><X className="size-5"/></button></div>
        <div className="space-y-5 p-5">
          {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
          <div className="grid gap-3 sm:grid-cols-2">{[["Customer", selected.booking?.customer?.name], ["Email", selected.booking?.customer?.email], ["Workspace", selected.booking?.workspace?.name], ["Resource", selected.booking?.resource?.name], ["Booking status", selected.booking?.status?.replaceAll("_", " ")], ["Period", `${formatDate(selected.booking?.start_at)} – ${formatDate(selected.booking?.end_at)}`], ["Booking total", formatAmount(selected.booking?.total_price)], ["Previously verified", formatAmount(selected.booking?.verified_amount)], ["Remaining balance", formatAmount(selected.booking?.outstanding_balance)], ["Declared amount", formatAmount(selected.amount)], ["Payment method", methodText(selected.payment_method)], ["Payment date", formatDate(selected.payment_date, true)], ["Submitted", formatDate(selected.submitted_at)], ["Bank", selected.bank_name], ["Transfer reference", selected.transaction_reference], ["Current status", statusText(selected.status)], ["Reviewed by", selected.verifier_name], ["Review date", formatDate(selected.verified_at)], ["Refund recorded by", selected.refund_verifier_name], ["Refund date", formatDate(selected.refunded_at)], ["External refund reference", selected.refund_reference]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 px-3 py-2.5"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 break-words text-sm font-medium capitalize">{value || "—"}</p></div>)}</div>
          {selected.rejection_reason && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Rejection reason</p><p className="mt-1 text-sm text-rose-900">{selected.rejection_reason}</p></div>}
          <div className="flex flex-wrap gap-2">{selected.links?.proof && <Button type="button" variant="outline" className="gap-2" onClick={() => void download(selected.links!.proof!, `payment-proof-${selected.id}`)}><Download className="size-4"/>Download original proof</Button>}{selected.receipt_available && selected.links?.receipt && <Button type="button" variant="outline" className="gap-2" onClick={() => void download(selected.links!.receipt!, `${selected.receipt_number ?? `receipt-${selected.id}`}.pdf`)}><Download className="size-4"/>Download receipt</Button>}</div>

          {dialog === "details" && selected.status === "pending" && selected.payment_method !== "card" && <div className="flex flex-wrap justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" className="border-rose-200 text-rose-700" onClick={() => setDialog("reject")}>Reject declaration</Button><Button type="button" className="bg-[#176b4d] hover:bg-[#125a40]" onClick={() => setDialog("approve")}>Approve declaration</Button></div>}
          {dialog === "approve" && <div className="space-y-4 border-t pt-4"><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Verify the full transfer before approval.</strong> A screenshot is not conclusive. Confirm the funds reached the workspace account and that the transfer covers the full remaining balance of {formatAmount(selected.booking?.outstanding_balance)}. Partial transfers must be rejected with a clear reason.</div><label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={verificationConfirmed} onChange={(e) => setVerificationConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-[#176b4d]"/><span>I independently verified receipt of the full remaining amount from {selected.booking?.customer?.name ?? "the customer"} for booking {selected.booking_id} via bank transfer.</span></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="button" className="gap-2 bg-[#176b4d] hover:bg-[#125a40]" disabled={!verificationConfirmed || Number(selected.amount).toFixed(2) !== Number(selected.booking?.outstanding_balance ?? 0).toFixed(2) || actionId === selected.id} onClick={() => void submitReview(true)}><Check className="size-4"/>{actionId === selected.id ? "Approving…" : "Confirm approval"}</Button></div></div>}
          {dialog === "reject" && <div className="space-y-4 border-t pt-4"><p className="text-sm text-muted-foreground">Choose the closest reason. The customer will see this message and can submit a corrected declaration if the booking is still eligible.</p><label className="block text-sm font-medium">Reason<select value={rejectReason} onChange={(e) => { setRejectReason(e.target.value); setError(""); }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal focus:border-[#176b4d] focus:outline-none"><option value="">Select a reason</option>{rejectionReasons.map((reason) => <option key={reason}>{reason}</option>)}</select></label>{rejectReason === "Other" && <label className="block text-sm font-medium">Explanation<textarea value={otherReason} onChange={(e) => setOtherReason(e.target.value)} rows={3} maxLength={1000} placeholder="Explain what needs to be corrected" className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-normal focus:border-[#176b4d] focus:outline-none"/><span className="text-xs text-muted-foreground">{otherReason.length}/1000</span></label>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button><Button type="button" variant="destructive" disabled={!rejectReason || (rejectReason === "Other" && otherReason.trim().length < 3) || actionId === selected.id} onClick={() => void submitReview(false)}>{actionId === selected.id ? "Rejecting…" : "Confirm rejection"}</Button></div></div>}
        </div>
      </section>
    </div>}
  </div>;
}
