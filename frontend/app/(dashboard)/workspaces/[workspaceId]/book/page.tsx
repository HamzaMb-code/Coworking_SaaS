"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { createBooking } from "@/lib/bookings";
import { getResources, type Resource } from "@/lib/resources";
import { getWorkspace, type Workspace } from "@/lib/workspaces";

export default function BookWorkspacePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const workspaceId = Number(params.workspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceId, setResourceId] = useState(searchParams.get("resource") ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [workspaceData, resourceData] = await Promise.all([getWorkspace(workspaceId), getResources(workspaceId)]);
        setWorkspace(workspaceData);
        setResources(resourceData.filter((resource) => resource.status === "active"));
      } catch (requestError: unknown) {
        setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load booking options." : "Could not load booking options.");
      } finally {
        setLoading(false);
      }
    };
    if (Number.isInteger(workspaceId) && workspaceId > 0) {
      void loadData();
    }
  }, [workspaceId]);

  const selectedResource = resources.find((resource) => resource.id === Number(resourceId));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resourceId || !startAt || !endAt) { setError("Choose a space, start time, and end time."); return; }
    try {
      setSubmitting(true); setError(""); setSuccess("");
      await createBooking(workspaceId, { resource_id: Number(resourceId), start_at: startAt, end_at: endAt });
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
    <div><p className="text-sm text-muted-foreground">{workspace?.city}</p><h1 className="mt-1 text-3xl font-bold">Reserve at {workspace?.name}</h1><p className="mt-2 text-muted-foreground">Your reservation is held once the workspace confirms availability.</p></div>
    {success && <div role="status" className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">{success} <Link href="/bookings" className="font-medium underline">View my bookings</Link></div>}
    {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
    <form onSubmit={handleSubmit} className="space-y-5 border p-5">
      <div><label htmlFor="resource" className="text-sm font-medium">Space</label><select id="resource" value={resourceId} onChange={(event) => setResourceId(event.target.value)} required className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select a space</option>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} - {Number(resource.price).toFixed(2)} MAD/{resource.pricing_unit}</option>)}</select></div>
      {selectedResource && <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">Up to {selectedResource.capacity} people · {Number(selectedResource.price).toFixed(2)} MAD per {selectedResource.pricing_unit}. {selectedResource.pricing_unit === "hour" ? "Hourly bookings are charged for the exact time reserved." : selectedResource.pricing_unit === "day" ? "Daily bookings count each calendar day used; a short booking still costs one day." : "Monthly bookings are billed in whole months, with partial months rounded up."} The workspace confirms your reservation request.</p>}
      <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="startAt" className="text-sm font-medium">Start</label><input id="startAt" type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} required className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm" /></div><div><label htmlFor="endAt" className="text-sm font-medium">End</label><input id="endAt" type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} required className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm" /></div></div>
      <button type="submit" disabled={submitting || resources.length === 0} className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{submitting ? "Submitting..." : "Request reservation"}</button>
    </form>
  </div>;
}
