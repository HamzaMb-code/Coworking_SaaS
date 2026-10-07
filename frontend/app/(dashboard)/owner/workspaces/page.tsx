"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowRight, Building2, CalendarDays, MapPin, Plus, Users } from "lucide-react";
import { createWorkspace, deleteWorkspace, getOwnedWorkspaces, type Workspace } from "@/lib/workspaces";
import { getOwnerNotifications, type Booking } from "@/lib/bookings";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function OwnerWorkspacesPage() {
  const router = useRouter();
  const { confirm: confirmAction, dialog } = useConfirmDialog();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [notifications, setNotifications] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createError, setCreateError] = useState("");
  const [error, setError] = useState("");
  const [deletingWorkspaceId, setDeletingWorkspaceId] = useState<number | null>(null);

  useEffect(() => {
    const loadOwnerData = async () => {
      try {
        const [workspaceData, notificationData] = await Promise.all([getOwnedWorkspaces(), getOwnerNotifications()]);
        setWorkspaces(workspaceData);
        setNotifications(notificationData.notifications);
      } catch (requestError: unknown) {
        setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load your workspaces." : "Could not load your workspaces.");
      } finally {
        setLoading(false);
      }
    };
    void loadOwnerData();
  }, []);

  const handleCreateWorkspace = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const slug = name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    try {
      setCreating(true);
      setCreateError("");
      await createWorkspace({
        name,
        slug,
        address: String(form.get("address") ?? "").trim(),
        city: String(form.get("city") ?? "").trim(),
        description: String(form.get("description") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim() || undefined,
        email: String(form.get("email") ?? "").trim() || undefined,
        image: form.get("image") instanceof File && (form.get("image") as File).size > 0 ? form.get("image") as File : undefined,
      });
      const [workspaceData, notificationData] = await Promise.all([getOwnedWorkspaces(), getOwnerNotifications()]);
      setWorkspaces(workspaceData);
      setNotifications(notificationData.notifications);
      setShowCreateForm(false);
      formElement.reset();
      window.dispatchEvent(new Event("workspace-memberships-changed"));
      router.refresh();
    } catch (requestError: unknown) {
      const validationErrors = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined;
      const firstError = validationErrors ? Object.values(validationErrors).flat()[0] : undefined;
      setCreateError(firstError ? String(firstError) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not create your workspace." : "Could not create your workspace.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteWorkspace = async (workspace: Workspace) => {
    if (!(await confirmAction(`Delete “${workspace.name}”? It will disappear from discovery and new bookings. Existing booking and payment history will be retained.`))) return;
    try {
      setDeletingWorkspaceId(workspace.id);
      await deleteWorkspace(workspace.id);
      setWorkspaces((current) => current.filter((item) => item.id !== workspace.id));
      window.dispatchEvent(new Event("workspace-memberships-changed"));
      router.refresh();
    } catch (requestError: unknown) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not delete the workspace." : "Could not delete the workspace.");
    } finally {
      setDeletingWorkspaceId(null);
    }
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading your workspaces...</div>;

  return <div className="space-y-8">{dialog}
    <section className="flex flex-col gap-4 border-b border-[#dce7de] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-[#176b4d]">Owner tools</p><h1 className="mt-1 text-3xl font-bold">My workspaces</h1><p className="mt-2 text-muted-foreground">Manage your locations, resources, and incoming reservations.</p></div><div className="flex flex-wrap gap-2"><Link href="/workspaces" className="inline-flex h-10 items-center justify-center rounded-md border border-[#cbdccf] px-4 text-sm font-semibold text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#eaf3ed]">Browse locations</Link><button type="button" onClick={() => setShowCreateForm((open) => !open)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#176b4d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md"><Plus className="size-4" />Add workspace</button></div></section>
    {showCreateForm && <form onSubmit={handleCreateWorkspace} className="space-y-4 rounded-2xl border border-[#dce7de] bg-white p-5 shadow-sm"><div><h2 className="font-semibold">List a workspace</h2><p className="mt-1 text-sm text-muted-foreground">Add a location first, then create bookable desks, offices, or meeting rooms.</p></div>{createError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{String(createError)}</p>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Workspace name<input name="name" required maxLength={255} placeholder="e.g. Atlas Work Club" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium">City<input name="city" required maxLength={255} placeholder="Casablanca" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium sm:col-span-2">Street address<input name="address" required maxLength={255} placeholder="Address and neighborhood" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium sm:col-span-2">Description<textarea name="description" rows={3} placeholder="What makes your space a great place to work?" className="mt-2 w-full rounded-md border bg-background p-3 font-normal" /></label><label className="text-sm font-medium">Contact email<input name="email" type="email" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium">Phone<input name="phone" type="tel" className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-normal" /></label><label className="text-sm font-medium sm:col-span-2">Workspace image <span className="font-normal text-muted-foreground">(optional, JPG/PNG/WebP, up to 5 MB)</span><input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full rounded-md border bg-background p-2 text-sm font-normal" /></label></div><button disabled={creating} className="h-10 rounded-md bg-[#176b4d] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50">{creating ? "Creating..." : "Create workspace"}</button></form>}
    {error && <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>}
    {notifications.length > 0 && <section className="border border-amber-200 bg-amber-50 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-amber-900">{notifications.length} new booking {notifications.length === 1 ? "request" : "requests"}</p><p className="mt-1 text-sm text-amber-800">Review incoming reservations before they are confirmed.</p></div><Link href={`/workspaces/${notifications[0].workspace?.id}/bookings`} className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900 hover:underline">Review requests <ArrowRight className="size-4" /></Link></div><div className="mt-4 divide-y divide-amber-200 border-y border-amber-200">{notifications.slice(0, 3).map((booking) => <Link key={booking.id} href={`/workspaces/${booking.workspace?.id}/bookings`} className="flex items-center justify-between gap-4 py-3 text-sm hover:opacity-70"><span><strong>{booking.user.name}</strong> requested {booking.resource.name} at {booking.workspace?.name}</span><span className="shrink-0 text-amber-900">View</span></Link>)}</div></section>}
    {workspaces.length === 0 ? <section className="border border-dashed p-10 text-center"><Building2 className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 font-semibold">You do not own a workspace yet</h2><p className="mt-2 text-sm text-muted-foreground">List your space to manage resources and receive reservation requests from customers.</p><Link href="/workspaces" className="mt-5 inline-flex rounded-md bg-[#176b4d] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md">Explore workspaces</Link></section> : <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{workspaces.map((workspace) => <article key={workspace.id} className="flex min-h-64 flex-col overflow-hidden rounded-2xl border border-[#dce7de] bg-card shadow-sm transition hover:border-[#b9d3c0] hover:shadow-md"><div className="relative h-40 bg-[#e8eee8]"><Image unoptimized src={workspace.image_url || "/images/heroImage.webp"} alt={`${workspace.name} workspace`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" /><span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium capitalize text-foreground">{workspace.status}</span></div><div className="flex flex-1 flex-col p-5"><h2 className="text-lg font-semibold">{workspace.name}</h2><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{workspace.city}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-2"><Users className="size-4" />{workspace.available_resources_count ?? 0} active spaces</span><span className="flex items-center gap-2"><CalendarDays className="size-4" />{workspace.bookings_count ?? 0} bookings</span></div><div className="mt-auto grid grid-cols-2 gap-2 pt-6"><Link href={`/workspaces/${workspace.id}/bookings`} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#176b4d] text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md"><CalendarDays className="size-4" />Bookings</Link><Link href={`/workspaces/${workspace.id}/resources`} className="inline-flex h-10 items-center justify-center rounded-md border border-[#dce7de] text-sm font-semibold text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#eaf3ed]">Resources</Link><Link href={`/workspaces/${workspace.id}/settings`} className="inline-flex h-10 items-center justify-center rounded-md border border-[#dce7de] text-sm font-semibold text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#eaf3ed]">Edit workspace</Link><button type="button" disabled={deletingWorkspaceId === workspace.id} onClick={() => void handleDeleteWorkspace(workspace)} className="h-10 rounded-md border border-red-200 text-sm font-semibold text-red-700 transition hover:bg-red-600 hover:text-white disabled:opacity-50">{deletingWorkspaceId === workspace.id ? "Deleting..." : "Delete workspace"}</button></div></div></article>)}</section>}
  </div>;
}
