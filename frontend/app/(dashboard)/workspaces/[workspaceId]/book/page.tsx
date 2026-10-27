"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { createBooking } from "@/lib/bookings";
import { getResources, type Resource } from "@/lib/resources";
import { getWorkspace, getWorkspaceBankTransferSetupStatus, type Workspace } from "@/lib/workspaces";
import ResourceImage from "@/components/resources/ResourceImage";
import DateTimePicker from "@/components/bookings/DateTimePicker";

export default function BookWorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = Number(params.workspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceId, setResourceId] = useState(searchParams.get("resource") ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"" | "bank_transfer" | "cash">("");
  const [bankTransferSetup, setBankTransferSetup] = useState<{ workspaceId: number; configured: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const [workspaceData, resourceData] = await Promise.all([getWorkspace(workspaceId), getResources(workspaceId)]);
        if (!active) return;
        setWorkspace(workspaceData);
        setResources(resourceData.filter((resource) => resource.status === "active"));
        const configured = await getWorkspaceBankTransferSetupStatus(workspaceId).catch(() => false);
        if (active) {
          setBankTransferSetup({ workspaceId, configured });
          if (!configured) setPaymentMethod((current) => current === "bank_transfer" ? "" : current);
        }
      } catch (requestError: unknown) {
        if (active) setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load booking options." : "Could not load booking options.");
      } finally {
        if (active) setLoading(false);
      }
    };
    if (Number.isInteger(workspaceId) && workspaceId > 0) {
      void loadData();
    }
    return () => { active = false; };
  }, [workspaceId]);

  const selectedResource = resources.find((resource) => resource.id === Number(resourceId));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resourceId || !startAt || !endAt || !paymentMethod) { setError("Choose a space, booking period, and payment method."); return; }
    if (paymentMethod === "bank_transfer" && (bankTransferSetup?.workspaceId !== workspaceId || !bankTransferSetup.configured)) { setError("Bank transfer is unavailable until this workspace configures valid beneficiary details. Choose cash or contact the workspace."); return; }
    try {
      setSubmitting(true); setError(""); setSuccess("");
      await createBooking(workspaceId, { resource_id: Number(resourceId), start_at: startAt, end_at: endAt, payment_method: paymentMethod });
      setSuccess("Your reservation request has been submitted.");
    } catch (requestError: unknown) {
      const validationErrors = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined;
      const firstError = validationErrors ? Object.values(validationErrors).flat()[0] : undefined;
      setError(firstError ? String(firstError) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not create the reservation." : "Could not create the reservation.");
    } finally { setSubmitting(false); }
  };

  if (!Number.isInteger(workspaceId) || workspaceId <= 0) return <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">Invalid workspace.</div>;
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading booking options...</div>;
  if (error && !workspace) return <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>;

  return <div className="mx-auto max-w-2xl space-y-7">
    <Link href={`/workspaces/${workspaceId}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to availability</Link>
    {success && <div role="status" className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success} <Link href="/bookings" className="font-medium underline">View my bookings</Link></div>}
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
    <form onSubmit={handleSubmit} className="space-y-5 border p-5">
      <div><label htmlFor="resource" className="text-sm font-medium">Space</label><select id="resource" value={resourceId} onChange={(event) => setResourceId(event.target.value)} required className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select a space</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} - {Number(resource.price).toFixed(2)} MAD/{resource.pricing_unit}</option>)}</select></div>
      {selectedResource && <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3"><ResourceImage imageUrl={selectedResource.image_url} type={selectedResource.type} alt={`${selectedResource.name} preview`} className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-lg" sizes="80px" /><p className="text-sm leading-6 text-muted-foreground">Up to {selectedResource.capacity} people · {Number(selectedResource.price).toFixed(2)} MAD per {selectedResource.pricing_unit}. {selectedResource.pricing_unit === "hour" ? "Hourly bookings are charged for the exact time reserved." : selectedResource.pricing_unit === "day" ? "Daily bookings count each calendar day used; a short booking still costs one day." : "Monthly bookings are billed in whole months, with partial months rounded up."} The workspace confirms your reservation request.</p></div>}
      <div className="grid gap-5 sm:grid-cols-2"><DateTimePicker id="startAt" label="Start" value={startAt} onChange={setStartAt} required /><DateTimePicker id="endAt" label="End" value={endAt} onChange={setEndAt} required /></div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">How do you intend to pay? <span className="text-red-600">*</span></legend>
        <label className={`flex items-start gap-3 rounded-xl border p-3 ${bankTransferSetup?.workspaceId === workspaceId && bankTransferSetup.configured ? "cursor-pointer" : "cursor-not-allowed bg-slate-50 opacity-75"}`}><input type="radio" name="payment_method" value="bank_transfer" required disabled={bankTransferSetup?.workspaceId !== workspaceId || !bankTransferSetup.configured} checked={paymentMethod === "bank_transfer"} onChange={() => setPaymentMethod("bank_transfer")} className="mt-1 accent-[#176b4d]"/><span><span className="block text-sm font-semibold">Bank transfer</span><span className="mt-1 block text-xs text-slate-500">{bankTransferSetup?.workspaceId !== workspaceId ? "Checking whether this workspace accepts bank transfers…" : bankTransferSetup.configured ? "Transfer the full amount and submit your payment declaration with proof for workspace verification." : "Unavailable: this workspace has not configured valid beneficiary details yet. Choose cash or contact the workspace."}</span></span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3"><input type="radio" name="payment_method" value="cash" required checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} className="mt-1 accent-[#176b4d]"/><span><span className="block text-sm font-semibold">Cash</span><span className="mt-1 block text-xs text-slate-500">Pay the full amount in person to authorized staff, who will verify your booking before receiving cash.</span></span></label>
      </fieldset>
      <button type="submit" disabled={submitting || resources.length === 0} className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{submitting ? "Submitting..." : "Request reservation"}</button>
    </form>
  </div>;
}
