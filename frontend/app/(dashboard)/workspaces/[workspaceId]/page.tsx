"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { ArrowLeft, Mail, MapPin, Phone, Users } from "lucide-react";
import { getWorkspace, type Workspace } from "@/lib/workspaces";
import { getResources, type Resource } from "@/lib/resources";
import ResourceImage from "@/components/resources/ResourceImage";
import WorkspaceImage from "@/components/workspaces/WorkspaceImage";

const displayType = (type: string) => type.replaceAll("_", " ");

export default function WorkspaceDetailsPage() {
  const params = useParams();
  const workspaceId = Number(params.workspaceId);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadWorkspace = async () => {
      if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
        setError("Invalid workspace.");
        setLoading(false);
        return;
      }
      try {
        const [workspaceData, resourceData] = await Promise.all([getWorkspace(workspaceId), getResources(workspaceId)]);
        setWorkspace(workspaceData);
        setResources(resourceData.filter((resource) => resource.status === "active"));
      } catch (requestError: unknown) {
        setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load this workspace." : "Could not load this workspace.");
      } finally {
        setLoading(false);
      }
    };
    void loadWorkspace();
  }, [workspaceId]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">Loading availability...</div>;
  if (error || !workspace) return <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error || "Workspace not found."}</div>;

  return (
    <div className="space-y-8">
      <Link href="/workspaces" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All workspaces</Link>
      <section className="overflow-hidden rounded-3xl border border-[#e3eae3] bg-white shadow-sm">
        <WorkspaceImage imageUrl={workspace.image_url} alt={`${workspace.name} workspace`} className="relative mb-7 h-56 w-full overflow-hidden rounded-2xl border border-[#e3eae3] bg-[#f1f5f1] sm:h-72" imageClassName="object-contain" sizes="(max-width: 640px) 100vw, 80vw" />
        <div className="px-5 pb-6 sm:px-8 sm:pb-8">
          <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-[#eaf3ed] px-3.5 py-2 text-sm font-medium text-[#176b4d]"><MapPin aria-hidden="true" className="size-4 shrink-0" />{workspace.city}</span><span className="text-sm text-slate-500">{workspace.address}</span></div>
          <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-[#172a21] sm:text-4xl">{workspace.name}</h1>
          {workspace.description && <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{workspace.description}</p>}
          {(workspace.phone || workspace.email) && <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {workspace.phone && <a href={`tel:${workspace.phone.replace(/[^\d+]/g, "")}`} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#e4ebe5] bg-[#fbfcfb] p-4 transition hover:border-[#b8d0be] hover:bg-[#f4f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] focus-visible:ring-offset-2"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]"><Phone aria-hidden="true" className="size-4" /></span><span className="min-w-0"><span className="block text-xs font-medium text-slate-500">Call the workspace</span><span className="mt-0.5 block truncate text-sm font-semibold text-[#24352b] group-hover:text-[#176b4d]">{workspace.phone}</span></span></a>}
            {workspace.email && <a href={`mailto:${workspace.email}`} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#e4ebe5] bg-[#fbfcfb] p-4 transition hover:border-[#b8d0be] hover:bg-[#f4f8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] focus-visible:ring-offset-2"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf3ed] text-[#176b4d]"><Mail aria-hidden="true" className="size-4" /></span><span className="min-w-0"><span className="block text-xs font-medium text-slate-500">Email the workspace</span><span className="mt-0.5 block truncate text-sm font-semibold text-[#24352b] group-hover:text-[#176b4d]">{workspace.email}</span></span></a>}
          </div>}
        </div>
      </section>
      <section>
        <div className="mb-5"><h2 className="text-xl font-semibold">Bookable spaces</h2><p className="mt-1 text-sm text-muted-foreground">Choose a space, then select the time that suits you.</p></div>
        {resources.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">There are no bookable spaces at this location right now.</div> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource) => <article key={resource.id} className="card-surface flex min-h-52 flex-col overflow-hidden">
              <ResourceImage imageUrl={resource.image_url} type={resource.type} alt={`${resource.name} at ${workspace.name}`} className="relative aspect-[16/10] w-full overflow-hidden" />
              <div className="flex flex-1 flex-col p-4 sm:p-5"><p className="text-sm capitalize text-muted-foreground">{displayType(resource.type)}</p>
              <h3 className="mt-1.5 text-lg font-semibold">{resource.name}</h3>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Up to {resource.capacity} people</p>
              <p className="mt-auto pt-5 text-lg font-semibold">{Number(resource.price).toFixed(2)} MAD <span className="text-sm font-normal text-muted-foreground">per {resource.pricing_unit}</span></p>
              <Link href={`/workspaces/${workspace.id}/book?resource=${resource.id}`} className="mt-4 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d]">Book this space</Link></div>
            </article>)}
          </div>
        )}
      </section>
    </div>
  );
}
