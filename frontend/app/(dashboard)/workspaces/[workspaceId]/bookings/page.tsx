"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, X, CalendarDays, UserRound, MapPin } from "lucide-react";
import { useParams } from "next/navigation";
import axios from "axios";

import {
  cancelBooking,
  checkInBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  getBookingQuote,
  getBookings,
  getWorkspaceCustomers,
  type Booking,
  type BookingQuote,
  type WorkspaceCustomer,
} from "@/lib/bookings";
import { getResources, type Resource } from "@/lib/resources";

export default function BookingsPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);

  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  const loadData = useCallback(async () => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setError("Invalid workspace.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [bookingData, resourceData, customerData] = await Promise.all([
        getBookings(workspaceId),
        getResources(workspaceId),
        getWorkspaceCustomers(workspaceId),
      ]);

      setBookings(bookingData);
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
  }, [workspaceId]);

  useEffect(() => {
    void Promise.resolve().then(() => loadData());
  }, [loadData]);
  useEffect(() => { const timer = window.setTimeout(() => setCurrentTime(Date.now()), 0); return () => window.clearTimeout(timer); }, []);

  const resetForm = () => {
    setResourceId("");
    setStartAt("");
    setEndAt("");
    setCustomerId("");
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

    if (!customerId || !resourceId || !startAt || !endAt) {
      setError("Choose a customer, resource, and booking period.");
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

      case "completed":
        return "bg-green-100 text-green-800";

      case "cancelled":
        return "bg-red-100 text-red-800";

      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: Booking["status"]) => ({
    pending: "Awaiting confirmation",
    confirmed: "Confirmed",
    checked_in: "Currently using resource",
    completed: "Completed",
    cancelled: "Cancelled",
  })[status];

  const canCheckIn = (booking: Booking) => {
    const now = currentTime;
    if (now === null) return false;
    return booking.status === "confirmed"
      && now >= new Date(booking.start_at).getTime()
      && now < new Date(booking.end_at).getTime();
  };

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

          <div>
            <label
              htmlFor="startAt"
              className="text-sm font-medium"
            >
              Start
            </label>

            <input
              id="startAt"
              type="datetime-local"
              value={startAt}
              onChange={(event) =>
                (setStartAt(event.target.value), setQuote(null))
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="endAt"
              className="text-sm font-medium"
            >
              End
            </label>

            <input
              id="endAt"
              type="datetime-local"
              value={endAt}
              onChange={(event) =>
                (setEndAt(event.target.value), setQuote(null))
              }
              className="mt-2 h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          {quote && <div className="md:col-span-2 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">Calculated booking total</p><p className="mt-1 text-2xl font-bold">{Number(quote.total_price).toFixed(2)} MAD</p><p className="mt-1 text-xs text-emerald-800">Price based on {quote.pricing_unit} billing at {Number(quote.unit_price).toFixed(2)} MAD per {quote.pricing_unit}. Final amount is confirmed by the backend when saved.</p></div>}
          <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => void handleQuote()} disabled={quoting || !resourceId || !startAt || !endAt} className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50">{quoting ? "Calculating..." : "Review price"}</button>
            <button
              type="submit"
              disabled={submitting || !customerId || !quote}
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
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            All Bookings
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {bookings.length} booking
            {bookings.length !== 1 ? "s" : ""}
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="rounded-xl border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No bookings found.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="group relative overflow-hidden rounded-[26px] border border-[#e3eae3] bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[#c5d8ca] hover:shadow-xl hover:shadow-[#153d2b]/[.06] sm:p-6"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#176b4d] via-emerald-300 to-transparent" />
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">
                        Booking #{booking.id}
                      </h3>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(
                          booking.status,
                        )}`}
                      >
                        {getStatusLabel(booking.status)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${booking.payment?.status === "paid" ? "bg-emerald-100 text-emerald-800" : booking.payment?.status === "failed" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-600"}`}>
                        Payment · {booking.payment?.status ?? "unpaid"}
                      </span>
                    </div>

                    <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                      <p className="flex items-center gap-2"><MapPin className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Resource</span><br />{booking.resource.name}</span></p>
                      <p className="flex items-center gap-2"><UserRound className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Customer</span><br />{booking.user.name}</span></p>
                      <p className="flex items-center gap-2"><CalendarDays className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Starts</span><br />{formatDate(booking.start_at)}</span></p>
                      <p className="flex items-center gap-2"><CalendarDays className="size-4 text-[#176b4d]" /><span><span className="font-medium text-foreground">Ends</span><br />{formatDate(booking.end_at)}</span></p>
                    </div>
                  </div>

                  <div className="shrink-0 lg:text-right">
                    <p className="text-lg font-semibold">
                      {formatPrice(booking.total_price)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  {booking.status === "pending" && (
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
                      Check In
                    </button>
                  )}

                  {booking.status === "checked_in" && (
                    <button
                      type="button"
                      onClick={() =>
                        handleAction(
                          () =>
                            completeBooking(
                              workspaceId,
                              booking.id,
                            ),
                          "Booking completed successfully.",
                        )
                      }
                      className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      Complete
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
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
