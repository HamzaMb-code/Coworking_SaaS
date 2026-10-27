"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { ArrowLeft, ArrowRight, CalendarDays, Mail, Search, Users, X } from "lucide-react";
import {
  getWorkspaceCustomerDetails,
  getWorkspaceCustomersPage,
  type WorkspaceCustomer,
  type WorkspaceCustomerDetailsPage,
  type WorkspaceCustomerPagination,
} from "@/lib/bookings";

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function errorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "Something went wrong while loading customers.";
  return error.response?.data?.message ?? "Something went wrong while loading customers.";
}

export default function WorkspaceCustomersPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<WorkspaceCustomer[]>([]);
  const [pagination, setPagination] = useState<WorkspaceCustomerPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerDetails, setCustomerDetails] = useState<WorkspaceCustomerDetailsPage | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailReloadKey, setDetailReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      getWorkspaceCustomersPage(workspaceId, { search: search.trim(), page, perPage: 12 })
        .then((data) => {
          if (!active) return;
          setCustomers(data.customers);
          setPagination(data.pagination);
        })
        .catch((requestError: unknown) => { if (active) setError(errorMessage(requestError)); })
        .finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [workspaceId, search, page, reloadKey]);

  useEffect(() => {
    if (!selectedCustomerId) return;
    let active = true;
    setDetailLoading(true);
    setDetailError("");
    getWorkspaceCustomerDetails(workspaceId, selectedCustomerId, { page: detailPage, perPage: 8 })
      .then((data) => { if (active) setCustomerDetails(data); })
      .catch((requestError: unknown) => { if (active) setDetailError(errorMessage(requestError)); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [workspaceId, selectedCustomerId, detailPage, detailReloadKey]);

  const openCustomer = (customer: WorkspaceCustomer) => {
    setSelectedCustomerId(customer.id);
    setCustomerDetails(null);
    setDetailPage(1);
    setDetailReloadKey((value) => value + 1);
  };

  const closeDetails = () => {
    setSelectedCustomerId(null);
    setCustomerDetails(null);
    setDetailError("");
  };

  if (loading && !pagination) return <CustomersSkeleton />;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-[#176b4d]">Workspace directory</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Customers</h1><p className="mt-2 text-slate-500">View customers associated with this workspace and review their booking history.</p></div>
      <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#dce7de] bg-white px-4 py-3 text-sm font-semibold text-[#176b4d]"><Users className="size-4" />{pagination?.total ?? 0} {pagination?.total === 1 ? "customer" : "customers"}</div>
    </header>

    <section className="overflow-hidden rounded-2xl border border-[#e4ebe5] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#edf1ed] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><h2 className="font-semibold">Workspace customers</h2><p className="mt-1 text-sm text-slate-500">Search by customer name or email.</p></div>
        <div className="flex gap-2"><label className="relative block w-full sm:w-80"><span className="sr-only">Search customers by name or email</span><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search customers..." className="h-10 w-full rounded-xl border border-[#dce5df] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#176b4d] focus:ring-2 focus:ring-[#176b4d]/10" /></label>{search && <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="inline-flex h-10 items-center gap-1 rounded-xl border border-[#dce5df] px-3 text-sm font-semibold text-slate-600 hover:bg-[#f6f9f6]"><X className="size-4" /><span className="sr-only sm:not-sr-only">Clear</span></button>}</div>
      </div>

      {error ? <div role="alert" className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p className="font-semibold">Unable to load customers</p><p className="mt-1">{error}</p><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold hover:bg-red-100">Try again</button></div>
        : loading ? <div className="space-y-3 p-5" aria-label="Loading customers">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-[#f0f4f0]" />)}</div>
          : customers.length === 0 ? <div className="px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eaf3ed] text-[#176b4d]"><Users className="size-6" /></span><h3 className="mt-4 font-semibold">{search ? "No customers found" : "No customers yet"}</h3><p className="mt-1 text-sm text-slate-500">{search ? "Try another name or email, or clear your search." : "Customers will appear here after joining or booking in this workspace."}</p>{search && <button type="button" onClick={() => setSearch("")} className="mt-4 text-sm font-semibold text-[#176b4d] hover:underline">Clear search</button>}</div>
            : <>
              <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-[#f8faf8] text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">Customer</th><th className="px-5 py-3 font-semibold">Email</th><th className="px-5 py-3 font-semibold">Bookings</th><th className="px-5 py-3 font-semibold">Account created</th><th className="px-5 py-3 text-right font-semibold">Details</th></tr></thead><tbody className="divide-y divide-[#edf1ed]">{customers.map((customer) => <tr key={customer.id} className="hover:bg-[#fbfcfb]"><td className="px-5 py-4"><CustomerName customer={customer} onClick={() => openCustomer(customer)} /></td><td className="px-5 py-4 text-slate-600">{customer.email}</td><td className="px-5 py-4">{customer.workspace_bookings_count ?? 0}</td><td className="px-5 py-4 text-slate-600">{formatDate(customer.created_at)}</td><td className="px-5 py-4 text-right"><button type="button" onClick={() => openCustomer(customer)} className="rounded-lg px-3 py-2 text-sm font-semibold text-[#176b4d] hover:bg-[#eaf3ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]">View details</button></td></tr>)}</tbody></table></div>
              <div className="divide-y divide-[#edf1ed] md:hidden">{customers.map((customer) => <article key={customer.id} className="flex items-center gap-3 p-4"><CustomerAvatar name={customer.name} /><button type="button" onClick={() => openCustomer(customer)} className="min-w-0 flex-1 text-left"><span className="block truncate font-semibold">{customer.name}</span><span className="mt-1 block truncate text-sm text-slate-500">{customer.email}</span><span className="mt-1 block text-xs text-slate-500">{customer.workspace_bookings_count ?? 0} bookings · Account created {formatDate(customer.created_at)}</span></button><ArrowRight className="size-4 shrink-0 text-[#176b4d]" /></article>)}</div>
            </>}

      {!error && pagination && pagination.total > 0 && <Pagination page={pagination.current_page} lastPage={pagination.last_page} total={pagination.total} perPage={pagination.per_page} onChange={setPage} />}
    </section>

    {selectedCustomerId !== null && <CustomerDetailsDialog customerDetails={customerDetails} loading={detailLoading} error={detailError} page={detailPage} onClose={closeDetails} onRetry={() => setDetailReloadKey((value) => value + 1)} onPageChange={setDetailPage} />}
  </div>;
}

function CustomerName({ customer, onClick }: { customer: WorkspaceCustomer; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-3 text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]"><CustomerAvatar name={customer.name} /><span className="font-semibold text-[#26332e] hover:text-[#176b4d]">{customer.name}</span></button>;
}

function CustomerAvatar({ name }: { name: string }) {
  return <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#eaf3ed] text-sm font-bold text-[#176b4d]">{initials(name)}</span>;
}

function Pagination({ page, lastPage, total, perPage, onChange }: { page: number; lastPage: number; total: number; perPage: number; onChange: (page: number) => void }) {
  const first = total ? (page - 1) * perPage + 1 : 0;
  const last = Math.min(page * perPage, total);
  return <div className="flex flex-col gap-3 border-t border-[#edf1ed] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><p className="text-sm text-slate-500">Showing {first}–{last} of {total}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dce5df] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="size-4" />Previous</button><span className="px-2 text-sm text-slate-500">Page {page} of {lastPage}</span><button type="button" disabled={page >= lastPage} onClick={() => onChange(page + 1)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#dce5df] px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">Next<ArrowRight className="size-4" /></button></div></div>;
}

function CustomerDetailsDialog({ customerDetails, loading, error, page, onClose, onRetry, onPageChange }: { customerDetails: WorkspaceCustomerDetailsPage | null; loading: boolean; error: string; page: number; onClose: () => void; onRetry: () => void; onPageChange: (page: number) => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="customer-details-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#dce7de] bg-white shadow-2xl">
    <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[#edf1ed] bg-white p-5 sm:p-7"><div className="flex items-center gap-3">{customerDetails && <CustomerAvatar name={customerDetails.customer.name} />}<div><p className="text-sm font-semibold text-[#176b4d]">Workspace customer</p><h2 id="customer-details-title" className="mt-1 text-xl font-bold">{customerDetails?.customer.name ?? "Customer details"}</h2></div></div><button type="button" aria-label="Close customer details" onClick={onClose} className="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"><X className="size-4" /></button></header>
    <div className="p-5 sm:p-7">{loading ? <div className="space-y-3" aria-label="Loading customer details"><div className="h-20 animate-pulse rounded-xl bg-[#f0f4f0]" /><div className="h-40 animate-pulse rounded-xl bg-[#f0f4f0]" /></div> : error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p><button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold hover:bg-red-100">Try again</button></div> : customerDetails && <>
      <div className="grid gap-3 rounded-2xl bg-[#f8faf8] p-4 sm:grid-cols-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</p><a href={`mailto:${customerDetails.customer.email}`} className="mt-1 inline-flex items-center gap-1.5 break-all text-sm font-medium text-[#176b4d] hover:underline"><Mail className="size-3.5 shrink-0" />{customerDetails.customer.email}</a></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Account created</p><p className="mt-1 text-sm font-medium">{formatDate(customerDetails.customer.created_at)}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workspace bookings</p><p className="mt-1 text-sm font-medium">{customerDetails.customer.bookings_count}</p></div></div>
      <div className="mt-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Booking history</h3><p className="mt-1 text-sm text-slate-500">Bookings made at this workspace.</p></div><CalendarDays className="size-5 text-[#176b4d]" /></div>{customerDetails.bookings.length === 0 ? <p className="mt-4 rounded-xl bg-[#f8faf8] p-4 text-sm text-slate-500">No booking history is available.</p> : <div className="mt-3 divide-y divide-[#edf1ed]">{customerDetails.bookings.map((booking) => <article key={booking.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{booking.resource.name} <span className="font-normal text-slate-500">· Booking {booking.id}</span></p><p className="mt-1 text-xs text-slate-500">{formatDate(booking.start_at)} · {new Date(booking.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–{new Date(booking.end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${booking.status === "completed" ? "bg-emerald-50 text-emerald-800" : booking.status === "pending" ? "bg-amber-50 text-amber-800" : booking.status === "cancelled" || booking.status === "rejected" ? "bg-rose-50 text-rose-800" : "bg-[#eaf3ed] text-[#176b4d]"}`}>{booking.status.replaceAll("_", " ")}</span></article>)}</div>}
      </div>
      {customerDetails.pagination.total > customerDetails.pagination.per_page && <div className="mt-4 flex justify-end"><Pagination page={customerDetails.pagination.current_page} lastPage={customerDetails.pagination.last_page} total={customerDetails.pagination.total} perPage={customerDetails.pagination.per_page} onChange={onPageChange} /></div>}
    </>}</div>
  </section></div>;
}

function CustomersSkeleton() {
  return <div className="space-y-6" aria-label="Loading customers"><div className="h-24 animate-pulse rounded-2xl bg-[#eaf0eb]" /><div className="h-[30rem] animate-pulse rounded-2xl bg-[#eaf0eb]" /></div>;
}
