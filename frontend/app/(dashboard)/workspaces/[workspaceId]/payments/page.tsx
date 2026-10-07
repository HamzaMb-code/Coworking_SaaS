"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";

import {
  createPayment,
  getPayments,
  refundPayment,
  type Payment,
} from "@/lib/payments";

import { getBookings, type Booking } from "@/lib/bookings";
import { getMyWorkspaces } from "@/lib/workspaces";
import { Button } from "@/components/ui/button";

export default function PaymentsPage() {
  const params = useParams();

  const workspaceId = Number(params.workspaceId);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [selectedBookingId, setSelectedBookingId] = useState("");

  const [canRefund, setCanRefund] = useState(false);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [actionId, setActionId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [paymentsData, bookingsData, memberships] = await Promise.all([
        getPayments(workspaceId),
        getBookings(workspaceId),
        getMyWorkspaces(),
      ]);

      setPayments(paymentsData);
      setBookings(bookingsData);
      setCanRefund(memberships.some((workspace) => workspace.id === workspaceId && workspace.pivot?.role === "owner"));
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
            "Failed to load payments.",
        );
      } else {
        setError("Failed to load payments.");
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || Number.isNaN(workspaceId)) {
      return;
    }

    void Promise.resolve().then(() => loadData());
  }, [workspaceId, loadData]);

  const paymentsByBooking = useMemo(() => {
    return new Map(payments.map((payment) => [payment.booking_id, payment]));
  }, [payments]);

  const availableBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.status === "confirmed" &&
        !["paid", "refunded"].includes(paymentsByBooking.get(booking.id)?.status ?? "none"),
    );
  }, [bookings, paymentsByBooking]);

  const handleCreatePayment = async () => {
    if (!selectedBookingId) {
      setError("Please select a booking.");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const payment = await createPayment(
        workspaceId,
        Number(selectedBookingId),
        { payment_method: "cash" },
      );

      setPayments((current) => [payment, ...current.filter((existing) => existing.booking_id !== payment.booking_id)]);

      setSelectedBookingId("");
      setSuccess("Cash payment recorded and marked paid.");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
            "Failed to create payment.",
        );
      } else {
        setError("Failed to create payment.");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRefund = async (paymentId: number) => {
    try {
      setActionId(paymentId);
      setError("");
      setSuccess("");

      const updatedPayment = await refundPayment(
        workspaceId,
        paymentId,
      );

      setPayments((current) =>
        current.map((payment) =>
          payment.id === paymentId
            ? updatedPayment
            : payment,
        ),
      );

      setSuccess("Payment refunded successfully.");
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
            "Failed to refund payment.",
        );
      } else {
        setError("Failed to refund payment.");
      }
    } finally {
      setActionId(null);
    }
  };

  const formatAmount = (amount: string | number) => {
    return `${Number(amount).toFixed(2)} MAD`;
  };

  const formatDate = (date: string | null) => {
    if (!date) {
      return "—";
    }

    return new Date(date).toLocaleString();
  };

  const getStatusClasses = (status: Payment["status"]) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";

      case "failed":
        return "bg-red-100 text-red-700";

      case "refunded":
        return "bg-blue-100 text-blue-700";

      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#176b4d]">
            Payments
          </h1>
          <p className="text-muted-foreground">
            Manage payments for this workspace.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          Loading payments...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#176b4d]">
          Payments
        </h1>

        <p className="text-muted-foreground">
          Manage payments for this workspace.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Create Payment */}
      <section className="rounded-2xl border border-[#dce7de] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-[#176b4d]">
            Create Payment
          </h2>

          <p className="text-sm text-muted-foreground">
            Create a payment for an unpaid booking.
          </p>
        </div>

        {availableBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There are no unpaid bookings available.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="booking"
                className="text-sm font-medium"
              >
                Booking
              </label>

              <select
                id="booking"
                value={selectedBookingId}
                onChange={(event) =>
                  setSelectedBookingId(event.target.value)
                }
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">
                  Select a booking
                </option>

                {availableBookings.map((booking) => (
                  <option
                    key={booking.id}
                    value={booking.id}
                  >
                    Booking #{booking.id} —{" "}
                    {booking.resource.name} —{" "}
                    {formatAmount(booking.total_price)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2"><p className="text-sm font-medium">Payment method</p><div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm">Cash received at reception</div></div>

            <div className="flex items-end">
              <Button
                type="button"
                onClick={handleCreatePayment}
                disabled={creating || !selectedBookingId}
                className="w-full bg-[#176b4d] text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md"
              >
                {creating
                  ? "Creating..."
                  : "Create Payment"}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Payments List */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">
            Payment History
          </h2>

          <p className="text-sm text-muted-foreground">
            {payments.length} payment
            {payments.length !== 1 ? "s" : ""}
          </p>
        </div>

        {payments.length === 0 ? (
          <div className="rounded-xl border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No payments found.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-[#dce7de] bg-white md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-[#dce7de] bg-[#edf5ef]">
                  <tr className="text-left">
                    <th className="px-4 py-3 font-medium">
                      Payment
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Booking
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Customer
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Amount
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Method
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Status
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Paid At
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b last:border-0"
                    >
                      <td className="px-4 py-4 font-medium">
                        #{payment.id}
                      </td>

                      <td className="px-4 py-4">
                        #{payment.booking_id}
                      </td>

                      <td className="px-4 py-4">
                        {payment.booking?.customer?.name ?? "—"}
                      </td>

                      <td className="px-4 py-4">
                        {formatAmount(payment.amount)}
                      </td>

                      <td className="px-4 py-4">
                        {payment.payment_method ?? "—"}
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                            payment.status,
                          )}`}
                        >
                          {payment.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-muted-foreground">
                        {formatDate(payment.paid_at)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {payment.status === "pending" && <span className="text-xs text-muted-foreground">Awaiting verification</span>}

                          {canRefund && payment.status === "paid" && (
                            <Button
                              size="sm"
                              variant="outline"
                              type="button"
                              className="border-[#b9d3c0] text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#eaf3ed] hover:text-[#125a40]"
                              disabled={
                                actionId === payment.id
                              }
                              onClick={() =>
                                handleRefund(payment.id)
                              }
                            >
                              {actionId === payment.id
                                ? "..."
                                : "Refund"}
                            </Button>
                          )}

                          {payment.status === "failed" && (
                            <span className="text-xs text-muted-foreground">
                              No actions
                            </span>
                          )}

                          {payment.status === "refunded" && (
                            <span className="text-xs text-muted-foreground">
                              Refunded
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-4 md:hidden">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-xl border border-[#dce7de] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        Payment #{payment.id}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        Booking #{payment.booking_id}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {payment.booking?.customer?.name ?? "Customer"} · {payment.booking?.resource?.name ?? "Resource"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${getStatusClasses(
                        payment.status,
                      )}`}
                    >
                      {payment.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">
                        Amount
                      </p>

                      <p className="font-medium">
                        {formatAmount(payment.amount)}
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground">
                        Method
                      </p>

                      <p className="font-medium">
                        {payment.payment_method ?? "—"}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <p className="text-muted-foreground">
                        Paid At
                      </p>

                      <p className="font-medium">
                        {formatDate(payment.paid_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {payment.status === "pending" && <span className="text-xs text-muted-foreground">Awaiting verification</span>}

                    {canRefund && payment.status === "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={
                          actionId === payment.id
                        }
                        onClick={() =>
                          handleRefund(payment.id)
                        }
                      >
                        {actionId === payment.id
                          ? "..."
                          : "Refund"}
                      </Button>
                    )}

                    {payment.status === "failed" && (
                      <span className="text-xs text-muted-foreground">
                        No actions
                      </span>
                    )}

                    {payment.status === "refunded" && (
                      <span className="text-xs text-muted-foreground">
                        Refunded
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
