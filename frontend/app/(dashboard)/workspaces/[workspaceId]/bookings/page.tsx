"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, X, Eye, CalendarDays, UserRound, Banknote } from "lucide-react";
import { useParams } from "next/navigation";
import axios from "axios";

import {
  cancelBooking,
  checkInBooking,
  checkOutBooking,
  confirmBooking,
  recordCashReceived,
  verifyCashEligibility,
  createBooking,
  getBookingQuote,
  getBookingsPage,
  getWorkspaceCustomers,
  type Booking,
  type BookingQuote,
  type WorkspaceCustomer,
} from "@/lib/bookings";
import { getResources, type Resource } from "@/lib/resources";
import ResourceImage from "@/components/resources/ResourceImage";
import DateTimePicker from "@/components/bookings/DateTimePicker";
import { BookingListControls, BookingListPagination, type BookingListFilter } from "@/components/bookings/BookingListControls";

export default function BookingsPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingPagination, setBookingPagination] = useState<{ current_page: number; per_page: number; total: number; last_page: number } | null>(null);
  const [bookingFilter, setBookingFilter] = useState<BookingListFilter>({ tab: "upcoming", status: "", from: "", to: "", search: "", resourceId: "", paymentStatus: "", paymentMethod: "" });
  const [bookingPage, setBookingPage] = useState(1);
  const [resources, setResources] = useState<Resource[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"" | "bank_transfer" | "cash">("");
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [cashBookingId, setCashBookingId] = useState<number | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [cashVerifiedAmount, setCashVerifiedAmount] = useState<string | null>(null);
  const [cashIdempotencyKey, setCashIdempotencyKey] = useState("");
  const [cashAcknowledged, setCashAcknowledged] = useState(false);
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null);

  const loadData = useCallback(async (showSpinner = true) => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setError("Invalid workspace.");
      setLoading(false);
      return;
    }

    try {
      if (showSpinner) setLoading(true);
      setError("");

      const [bookingData, resourceData, customerData] = await Promise.all([
        getBookingsPage(workspaceId, { ...bookingFilter, page: bookingPage, perPage: 10 }),
        getResources(workspaceId),
        getWorkspaceCustomers(workspaceId),
      ]);

      setBookings(bookingData.bookings);
      setBookingPagination(bookingData.pagination);
      setResources(resourceData);
      setCustomers(customerData);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
            "Failed to load bookings.",
        );
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, bookingFilter, bookingPage]);

  useEffect(() => {
    const requestTimer = window.setTimeout(() => void loadData(false), bookingFilter.search ? 250 : 0);
    const refreshTimer = window.setInterval(() => void loadData(false), 60_000);
    const handleFocus = () => void loadData(false);
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(requestTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadData, bookingFilter.search]);
  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());
    updateTime();
    const timer = window.setInterval(updateTime, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const resetForm = () => {
    setResourceId("");
    setStartAt("");
    setEndAt("");
    setCustomerId("");
    setPaymentMethod("");
    setQuote(null);
  };

  const handleQuote = async () => {
    if (!resourceId || !startAt || !endAt) {
      setError("Select a resource and booking period to calculate the price.");
      return;
    }
    try {
      setQuoting(true); setError(""); setQuote(null);
      setQuote(await getBookingQuote(workspaceId, {
        resource_id: Number(resourceId),
        start_at: startAt,
        end_at: endAt,
      }));
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        const errors = requestError.response?.data?.errors as Record<string, string[]> | undefined;
        setError(errors ? Object.values(errors)[0]?.[0] ?? "Could not calculate this booking." : requestError.response?.data?.message ?? "Could not calculate this booking.");
      } else setError("Could not calculate this booking.");
    } finally { setQuoting(false); }
  };

  const handleCreate = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!customerId || !resourceId || !startAt || !endAt || !paymentMethod) {
      setError("Choose a customer, resource, booking period, and payment method.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const createdBooking = await createBooking(workspaceId, {
        customer_id: Number(customerId),
        resource_id: Number(resourceId),
        start_at: startAt,
        end_at: endAt,
        payment_method: paymentMethod,
      });

      resetForm();
      setShowCreateForm(false);
      setSuccess(`Booking created for ${customers.find((customer) => customer.id === Number(customerId))?.name ?? "customer"} · ${Number(createdBooking.total_price).toFixed(2)} MAD`);

      await loadData();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const validationErrors = error.response?.data?.errors;

        if (validationErrors) {
          const firstError = Object.values(
            validationErrors,
          )[0];

          if (Array.isArray(firstError)) {
            setError(String(firstError[0]));
          } else {
            setError("The booking data is invalid.");
          }
        } else {
          setError(
            error.response?.data?.message ??
              "Failed to create booking.",
          );
        }
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (
    action: () => Promise<Booking>,
    successMessage: string,
  ) => {
    try {
      setError("");
      setSuccess("");

      await action();

      setSuccess(successMessage);

      await loadData();
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const validationErrors = error.response?.data?.errors;

        if (validationErrors) {
          const firstError = Object.values(
            validationErrors,
          )[0];

          if (Array.isArray(firstError)) {
            setError(String(firstError[0]));
          } else {
            setError("The requested action could not be completed.");
          }
        } else {
          setError(
            error.response?.data?.message ??
              "The requested action could not be completed.",
          );
        }
      } else {
        setError("Something went wrong.");
      }
    }
  };

  const openCashForm = (booking: Booking) => {
    setCashBookingId(booking.id);
    setCashAmount("");
    setCashVerifiedAmount(null);
    setCashIdempotencyKey(crypto.randomUUID());
    setCashAcknowledged(false);
    setError("");
  };

  const handleVerifyCash = async (booking: Booking) => {
    try {
      setSubmitting(true); setError(""); setSuccess("");
      const eligibility = await verifyCashEligibility(workspaceId, booking.id);
      setCashVerifiedAmount(eligibility.amount_due);
      setCashAmount(eligibility.amount_due);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) setError(error.response?.data?.message ?? "Booking is not eligible for cash. Do not accept money.");
      else setError("Could not verify booking eligibility. Do not accept money.");
    } finally { setSubmitting(false); }
  };

  const handleRecordCash = async (event: React.FormEvent<HTMLFormElement>, booking: Booking) => {
    event.preventDefault();
    try {
      setSubmitting(true); setError(""); setSuccess("");
      await recordCashReceived(workspaceId, booking.id, { amount: Number(cashAmount), idempotency_key: cashIdempotencyKey, cash_received_confirmed: true });
      setCashBookingId(null); setSuccess(`Full cash payment recorded for booking ${booking.id}.`);
      await loadData(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors as Record<string, string[]> | undefined;
        const message = error.response?.data?.message;
        const reconciliation = error.response?.data?.reconciliation_required;
        setError(reconciliation
          ? `${message} Reference: ${error.response?.data?.reconciliation_reference ?? cashIdempotencyKey}.`
          : errors ? Object.values(errors)[0]?.[0] ?? "Could not record cash received." : message ?? `No response received. Retry this request with reference ${cashIdempotencyKey}; do not take cash again.`);
      } else setError(`No response received. Retry this request with reference ${cashIdempotencyKey}; do not take cash again.`);
    } finally { setSubmitting(false); }
  };

  const formatDate = (value: string) => {
    return new Date(value).toLocaleString();
  };

  const formatPrice = (value: string | number) => {
    return `${Number(value).toFixed(2)} MAD`;
  };

  const getStatusClass = (status: Booking["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";

      case "confirmed":
        return "bg-blue-100 text-blue-800";

      case "checked_in":
        return "bg-purple-100 text-purple-800";

      case "checked_out":
        return "bg-teal-100 text-teal-800";

      case "completed":
        return "bg-green-100 text-green-800";

      case "cancelled":
        return "bg-red-100 text-red-800";

      case "rejected":
        return "bg-rose-100 text-rose-800";

      case "no_show":
        return "bg-orange-100 text-orange-800";

      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: Booking["status"]) => ({
    pending: "Pending payment",
    confirmed: "Confirmed",
    checked_in: "Currently using resource",
    checked_out: "Checked out",
    completed: "Completed",
    cancelled: "Cancelled",
    rejected: "Rejected",
    no_show: "No-show",
  })[status];

  const canCheckIn = (booking: Booking) => {
    return booking.can_check_in;
  };

  const updateBookingFilter = (nextFilter: BookingListFilter) => {
    setBookingPage(1);
    setBookingFilter(nextFilter);
  };

  const activeCashBooking = bookings.find((booking) => booking.id === cashBookingId) ?? null;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading bookings...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <h1 className="text-2xl font-bold sm:text-3xl">
          Bookings
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Create and manage bookings for this workspace.
        </p>
        </div>
        <button type="button" onClick={() => setShowCreateForm((visible) => !visible)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#176b4d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40]">
          {showCreateForm ? <X className="size-4" /> : <Plus className="size-4" />}{showCreateForm ? "Close form" : "Create booking"}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-600">
          {success}
        </div>
      )}

      {showCreateForm && <section className="rounded-[26px] border border-[#e3eae3] bg-white p-5 shadow-lg shadow-[#153d2b]/[.04] sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">
            Create Booking
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Select a resource and choose the booking period.
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          className="mt-6 grid gap-4 md:grid-cols-2"
        >
          <div>
            <label htmlFor="customer" className="text-sm font-medium">Customer</label>
            <select id="customer" required value={customerId} onChange={(event) => { setCustomerId(event.target.value); setQuote(null); }} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Select a customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.email}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="payment-method" className="text-sm font-medium">Intended payment method</label>
            <select id="payment-method" required value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as typeof paymentMethod)} className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Choose a method</option><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">Bank transfer requires full payment proof for verification; cash is recorded by authorized staff after receiving the full amount.</p>
          </div>
          <div className="md:col-span-2">
            <label
              htmlFor="resource"
              className="text-sm font-medium"
            >
              Resource
            </label>

            <select
              id="resource"
              value={resourceId}
              onChange={(event) =>
                (setResourceId(event.target.value), setQuote(null))
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Select a resource</option>

              {resources
                .filter((resource) => resource.status === "active")
                .map((resource) => (
                  <option
                    key={resource.id}
                    value={resource.id}
                  >
                    {resource.name} — {resource.price} MAD/
                    {resource.pricing_unit}
                  </option>
                ))}
            </select>
          </div>

          <DateTimePicker id="startAt" label="Start" value={startAt} onChange={(value) => (setStartAt(value), setQuote(null))} />
          <DateTimePicker id="endAt" label="End" value={endAt} onChange={(value) => (setEndAt(value), setQuote(null))} />

          {quote && <div className="md:col-span-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Calculated booking total</p><p className="mt-1 text-2xl font-bold">{Number(quote.total_price).toFixed(2)} MAD</p><p className="mt-1 text-xs text-emerald-800">Price based on {quote.pricing_unit} billing at {Number(quote.unit_price).toFixed(2)} MAD per {quote.pricing_unit}. Final amount is confirmed by the backend when saved.</p></div>}
          <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void handleQuote()} disabled={quoting || !resourceId || !startAt || !endAt} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">{quoting ? "Calculating..." : "Review price"}</button>
            <button
              type="submit"
              disabled={submitting || !customerId || !paymentMethod || !quote}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting
                ? "Creating..."
                : "Create Booking"}
            </button>
          </div>
        </form>
      </section>}

      <section id="check-in">
        <div className="mb-4"><h2 className="text-lg font-semibold">{bookingFilter.tab === "upcoming" ? "Upcoming bookings" : "Booking history"}</h2><p className="mt-1 text-sm text-muted-foreground">{bookingPagination ? `${bookingPagination.total} ${bookingPagination.total === 1 ? "booking" : "bookings"}` : "Bookings for this workspace"}</p></div>
        <BookingListControls filter={bookingFilter} onChange={updateBookingFilter} resources={resources.map(({ id, name }) => ({ id, name }))} showPaymentFilters />

        {bookings.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">{bookingFilter.tab === "upcoming" ? "No upcoming bookings" : "No booking history matches"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{bookingFilter.tab === "upcoming" ? "Pending requests and active reservations will appear here." : "Try adjusting the search, status, resource, or dates."}</p>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto rounded-xl border border-[#e3eae3] bg-white xl:block">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-[#f8faf8] text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Booking</th><th className="px-4 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Resource</th><th className="px-4 py-3 font-semibold">Date &amp; time</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Payment</th><th className="px-4 py-3 font-semibold">Amount</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#edf1ed]">{bookings.map((booking) => {
                const canRecordCash = (booking.status === "pending" || booking.status === "confirmed")
                  && (booking.payment_method === "cash" || booking.payment_method === null)
                  && currentTime !== null
                  && Number(booking.outstanding_balance ?? booking.total_price) - Number(booking.pending_payment_amount ?? 0) > 0
                  && (booking.status === "pending" ? new Date(booking.start_at).getTime() > currentTime : new Date(booking.end_at).getTime() > currentTime);
                return <tr key={booking.id} className="align-middle hover:bg-[#fbfcfb]">
                  <td className="whitespace-nowrap px-4 py-4 font-semibold">Booking {booking.id}</td>
                  <td className="px-4 py-4"><p className="font-medium">{booking.user.name}</p><p className="mt-0.5 max-w-44 truncate text-xs text-slate-500">{booking.user.email}</p></td>
                  <td className="px-4 py-4"><p className="font-medium">{booking.resource.name}</p><p className="mt-0.5 text-xs capitalize text-slate-500">{booking.resource.type.replaceAll("_", " ")}</p></td>
                  <td className="whitespace-nowrap px-4 py-4 text-slate-600">{new Date(booking.start_at).toLocaleDateString()}<br /><span className="text-xs">{new Date(booking.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–{new Date(booking.end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(booking.status)}`}>{booking.expired ? "Expired" : getStatusLabel(booking.status)}</span></td>
                  <td className="px-4 py-4"><p className="font-medium capitalize">{booking.payment?.status ?? "Unpaid"}</p><p className="mt-0.5 text-xs text-slate-500">{booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "Legacy method"}</p></td>
                  <td className="whitespace-nowrap px-4 py-4"><p className="font-medium">{formatPrice(booking.total_price)}</p><p className="mt-0.5 text-xs text-slate-500">{Number(booking.outstanding_balance ?? booking.total_price) > 0 ? `${formatPrice(booking.outstanding_balance ?? booking.total_price)} due` : "Paid"}</p></td>
                  <td className="px-4 py-4"><div className="flex flex-wrap justify-end gap-1.5">
                    <button type="button" onClick={() => setDetailsBooking(booking)} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold"><Eye className="mr-1 inline size-3.5" />Details</button>
                    {booking.payment?.status === "pending" && booking.payment.payment_method === "bank_transfer" && <Link href={`/workspaces/${workspaceId}/payments`} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900">Review payment</Link>}
                    {canRecordCash && <button type="button" onClick={() => openCashForm(booking)} className="rounded-lg bg-[#176b4d] px-2.5 py-1.5 text-xs font-semibold text-white">Record cash</button>}
                    {booking.status === "pending" && Number(booking.outstanding_balance ?? booking.total_price) <= 0 && <button type="button" onClick={() => void handleAction(() => confirmBooking(workspaceId, booking.id), "Booking confirmed successfully.")} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Confirm</button>}
                    {canCheckIn(booking) && <button type="button" onClick={() => void handleAction(() => checkInBooking(workspaceId, booking.id), "Booking checked in successfully.")} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Check in</button>}
                    {booking.status === "checked_in" && <button type="button" onClick={() => void handleAction(() => checkOutBooking(workspaceId, booking.id), "Customer checked out successfully.")} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold">Check out</button>}
                    {(booking.status === "pending" || booking.status === "confirmed") && <button type="button" onClick={() => void handleAction(() => cancelBooking(workspaceId, booking.id), "Booking cancelled successfully.")} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700">Cancel</button>}
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <div className="space-y-4 xl:hidden">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="card-surface p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        Booking {booking.id}
                      </h3>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                          booking.status,
                        )}`}
                      >
                        {booking.expired ? "Expired" : getStatusLabel(booking.status)}
                      </span>
                      {booking.status === "checked_in" && (booking.is_overdue || (currentTime !== null && currentTime > new Date(booking.end_at).getTime())) && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">⚠ Overdue</span>}
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${booking.fully_paid ? "bg-emerald-100 text-emerald-800" : booking.payment?.status === "failed" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                        {booking.fully_paid ? "Fully paid" : Number(booking.verified_amount ?? 0) > 0 ? `${formatPrice(booking.verified_amount ?? 0)} verified · ${formatPrice(booking.outstanding_balance ?? 0)} due` : `Payment · ${booking.payment?.status ?? "unpaid"}`}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <div className="flex items-center gap-2"><ResourceImage imageUrl={booking.resource.image_url} type={booking.resource.type} alt={`${booking.resource.name} thumbnail`} className="relative aspect-square size-11 shrink-0 overflow-hidden rounded-lg" sizes="44px" /><span><span className="block text-xs font-medium text-muted-foreground">Resource</span><span className="font-medium text-foreground">{booking.resource.name}</span></span></div>
                      <p className="flex items-center gap-2"><UserRound className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Customer</span><br />{booking.user.name}</span></p>
                      <p className="flex items-center gap-2"><Banknote className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Intended payment method</span><br />{booking.payment_method === "bank_transfer" ? "Bank transfer" : booking.payment_method === "cash" ? "Cash" : "Legacy booking"}</span></p>
                      <p className="flex items-center gap-2"><CalendarDays className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Starts</span><br />{formatDate(booking.start_at)}</span></p>
                      <p className="flex items-center gap-2"><CalendarDays className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Ends</span><br />{formatDate(booking.end_at)}</span></p>
                    </div>
                    {(booking.checked_in_at || booking.checked_out_at) && <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      {booking.checked_in_at && <span>Checked in {formatDate(booking.checked_in_at)}</span>}
                      {booking.checked_out_at && <span>Checked out {formatDate(booking.checked_out_at)}</span>}
                    </div>}
                  </div>

                  <div className="shrink-0 lg:text-right">
                    <p className="text-lg font-semibold">
                      {formatPrice(booking.total_price)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  {booking.payment?.status === "pending" && booking.payment.payment_method === "bank_transfer" && <Link href={`/workspaces/${workspaceId}/payments`} className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">Review payment</Link>}
                  {(booking.status === "pending" || booking.status === "confirmed") && (booking.payment_method === "cash" || booking.payment_method === null) && currentTime !== null && Number(booking.outstanding_balance ?? booking.total_price) - Number(booking.pending_payment_amount ?? 0) > 0 && (booking.status === "pending" ? new Date(booking.start_at).getTime() > currentTime : new Date(booking.end_at).getTime() > currentTime) && (
                    <button type="button" onClick={() => openCashForm(booking)} className="inline-flex items-center gap-2 rounded-md bg-[#176b4d] px-3 py-2 text-sm font-medium text-white hover:bg-[#125a40]">
                      <Banknote className="size-4" />Record cash received
                    </button>
                  )}

                  {booking.status === "pending" && Number(booking.outstanding_balance ?? booking.total_price) <= 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () =>
                            confirmBooking(
                              workspaceId,
                              booking.id,
                            ),
                          "Booking confirmed successfully.",
                        )
                      }
                      className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      Confirm
                    </button>
                  )}

                  {canCheckIn(booking) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () =>
                            checkInBooking(
                              workspaceId,
                              booking.id,
                            ),
                          "Booking checked in successfully.",
                        )
                      }
                      className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      Check in
                    </button>
                  )}

                  {booking.status === "checked_in" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () =>
                            checkOutBooking(
                              workspaceId,
                              booking.id,
                            ),
                          "Customer checked out successfully.",
                        )
                      }
                      className="rounded-md border border-[#176b4d]/25 bg-[#176b4d]/5 px-3 py-2 text-sm font-medium text-[#176b4d] hover:bg-[#176b4d]/10"
                    >
                      Check out
                    </button>
                  )}

                  {(booking.status === "pending" ||
                    booking.status === "confirmed") && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () =>
                            cancelBooking(
                              workspaceId,
                              booking.id,
                            ),
                          "Booking cancelled successfully.",
                        )
                      }
                      className="rounded-md border px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Cancel
                    </button>
                  )}

                </div>

                {cashBookingId === booking.id && <form onSubmit={(event) => void handleRecordCash(event, booking)} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between"><h4 className="font-semibold text-emerald-950">Record cash for booking {booking.id}</h4><span className="text-xs text-emerald-800">{booking.user.name} · verified balance {formatPrice(booking.outstanding_balance ?? booking.total_price)}</span></div>
                  <p className="mt-1 text-sm text-emerald-900">Verify the customer and booking with the server first. <strong>Do not take cash until eligibility is confirmed.</strong> The server will require the full amount due.</p>
                  {!cashVerifiedAmount ? <div className="mt-4 flex gap-2"><button type="button" disabled={submitting} onClick={() => void handleVerifyCash(booking)} className="rounded-md bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#125a40] disabled:opacity-50">{submitting ? "Checking…" : "Verify booking and amount"}</button><button type="button" disabled={submitting} onClick={() => setCashBookingId(null)} className="rounded-md border bg-white px-4 py-2 text-sm font-medium">Cancel</button></div> : <>
                    <p className="mt-3 rounded-md border border-emerald-300 bg-white p-3 text-sm text-emerald-950">Booking eligible. Full amount due: <strong>{formatPrice(cashVerifiedAmount)}</strong>. Only now may you receive that exact amount.</p>
                    <label className="mt-3 block text-sm font-medium">Full cash amount physically received (MAD)<input type="number" required min={cashVerifiedAmount} max={cashVerifiedAmount} step="0.01" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-emerald-200 bg-white px-3" /></label>
                    <label className="mt-3 flex items-start gap-2 text-sm text-emerald-950"><input type="checkbox" required checked={cashAcknowledged} onChange={(event) => setCashAcknowledged(event.target.checked)} className="mt-0.5 size-4 accent-[#176b4d]" /><span>I verified this customer and booking, and physically received the full amount shown above.</span></label>
                    <div className="mt-4 flex gap-2"><button type="submit" disabled={submitting || !cashAcknowledged || Number(cashAmount).toFixed(2) !== Number(cashVerifiedAmount).toFixed(2)} className="rounded-md bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#125a40] disabled:opacity-50">{submitting ? "Recording…" : "Confirm full cash received"}</button><button type="button" disabled={submitting} onClick={() => setCashBookingId(null)} className="rounded-md border bg-white px-4 py-2 text-sm font-medium">Cancel</button></div>
                    <p className="mt-2 text-xs text-emerald-900">If recording fails after receiving cash, secure it and contact the workspace owner with reference {cashIdempotencyKey}. Retry only with this same request.</p>
                  </>}
                </form>}
              </div>
            ))}
          </div>
          </>
        )}
        {bookingPagination && <div className="mt-4"><BookingListPagination page={bookingPagination.current_page} lastPage={bookingPagination.last_page} total={bookingPagination.total} perPage={bookingPagination.per_page} onChange={setBookingPage} /></div>}
      </section>
      {detailsBooking && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsBooking(null); }}><section role="dialog" aria-modal="true" aria-labelledby="booking-details-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#176b4d]">Booking details</p><h2 id="booking-details-title" className="mt-1 text-xl font-bold">Booking {detailsBooking.id}</h2></div><button type="button" onClick={() => setDetailsBooking(null)} aria-label="Close booking details" className="rounded-full border p-2 text-slate-500 hover:bg-slate-50"><X className="size-4" /></button></div><dl className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-slate-500">Customer</dt><dd className="mt-1 break-words font-medium">{detailsBooking.user.name}<br />{detailsBooking.user.email}</dd></div><div><dt className="text-xs text-slate-500">Resource</dt><dd className="mt-1 font-medium">{detailsBooking.resource.name} · {detailsBooking.resource.type.replaceAll("_", " ")}</dd></div><div><dt className="text-xs text-slate-500">Starts</dt><dd className="mt-1 font-medium">{formatDate(detailsBooking.start_at)}</dd></div><div><dt className="text-xs text-slate-500">Ends</dt><dd className="mt-1 font-medium">{formatDate(detailsBooking.end_at)}</dd></div><div><dt className="text-xs text-slate-500">Booking status</dt><dd className="mt-1 font-medium">{detailsBooking.expired ? "Expired" : getStatusLabel(detailsBooking.status)}</dd></div><div><dt className="text-xs text-slate-500">Payment method / status</dt><dd className="mt-1 font-medium">{detailsBooking.payment_method === "bank_transfer" ? "Bank transfer" : detailsBooking.payment_method === "cash" ? "Cash" : "Legacy"} · {detailsBooking.payment?.status ?? "Unpaid"}</dd></div><div><dt className="text-xs text-slate-500">Amount due</dt><dd className="mt-1 font-medium">{formatPrice(detailsBooking.outstanding_balance ?? detailsBooking.total_price)}</dd></div>{detailsBooking.payment_deadline_at && detailsBooking.status === "pending" && <div><dt className="text-xs text-slate-500">Payment deadline</dt><dd className="mt-1 font-medium">{new Date(detailsBooking.payment_deadline_at).toLocaleString()}</dd></div>}</dl><div className="mt-5 flex justify-end"><button type="button" onClick={() => setDetailsBooking(null)} className="rounded-lg bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white">Close</button></div></section></div>}
      {activeCashBooking && <div className="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/40 p-4 xl:flex" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setCashBookingId(null); }}><section role="dialog" aria-modal="true" aria-labelledby="cash-dialog-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#176b4d]">Cash payment</p><h2 id="cash-dialog-title" className="mt-1 text-xl font-bold">Booking {activeCashBooking.id}</h2></div><button type="button" disabled={submitting} onClick={() => setCashBookingId(null)} aria-label="Close cash payment" className="rounded-full border p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"><X className="size-4" /></button></div><p className="mt-4 text-sm text-slate-600">Verify the customer and booking with the server first. <strong>Do not take cash until eligibility is confirmed.</strong> Full payment is required.</p>{!cashVerifiedAmount ? <button type="button" disabled={submitting} onClick={() => void handleVerifyCash(activeCashBooking)} className="mt-4 rounded-lg bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Checking…" : "Verify booking and amount"}</button> : <><p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">Booking eligible. Full amount due: <strong>{formatPrice(cashVerifiedAmount)}</strong>. Only now may you receive that exact amount.</p><form onSubmit={(event) => void handleRecordCash(event, activeCashBooking)}><label className="mt-4 block text-sm font-medium">Full cash amount physically received (MAD)<input type="number" required min={cashVerifiedAmount} max={cashVerifiedAmount} step="0.01" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} className="mt-1 h-10 w-full rounded-md border px-3" /></label><label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" required checked={cashAcknowledged} onChange={(event) => setCashAcknowledged(event.target.checked)} className="mt-0.5 size-4 accent-[#176b4d]" /><span>I verified this customer and booking, and physically received the full amount shown above.</span></label><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={submitting} onClick={() => setCashBookingId(null)} className="rounded-lg border px-4 py-2 text-sm font-medium">Cancel</button><button type="submit" disabled={submitting || !cashAcknowledged || Number(cashAmount).toFixed(2) !== Number(cashVerifiedAmount).toFixed(2)} className="rounded-lg bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Recording…" : "Confirm full cash received"}</button></div><p className="mt-3 text-xs text-slate-500">If recording fails after receiving cash, secure it and contact the workspace owner with reference {cashIdempotencyKey}. Retry only with this same request.</p></form></>}</section></div>}
    </div>
  );
}
