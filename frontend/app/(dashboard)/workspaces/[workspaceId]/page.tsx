"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { ArrowLeft, MapPin, Users } from "lucide-react";
import { getWorkspace, type Workspace } from "@/lib/workspaces";
import { getResources, type Resource } from "@/lib/resources";

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
      <section className="border-b pb-8">
        <div className="relative mb-7 h-56 overflow-hidden rounded-2xl bg-[#e8eee8] sm:h-72"><Image unoptimized src={workspace.image_url || "/images/heroImage.webp"} alt={`${workspace.name} workspace`} fill sizes="(max-width: 640px) 100vw, 80vw" className="object-cover" /></div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{workspace.city}, {workspace.address}</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{workspace.name}</h1>
        {workspace.description && <p className="mt-4 max-w-3xl text-muted-foreground">{workspace.description}</p>}
        {(workspace.phone || workspace.email) && <p className="mt-4 text-sm text-muted-foreground">{workspace.phone}{workspace.phone && workspace.email ? " | " : ""}{workspace.email}</p>}
      </section>
      <section>
        <div className="mb-5"><h2 className="text-xl font-semibold">Bookable spaces</h2><p className="mt-1 text-sm text-muted-foreground">Choose a space, then select the time that suits you.</p></div>
        {resources.length === 0 ? <div className="border border-dashed p-8 text-sm text-muted-foreground">There are no bookable spaces at this location right now.</div> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource) => <article key={resource.id} className="flex min-h-52 flex-col border p-5">
              <p className="text-sm capitalize text-muted-foreground">{displayType(resource.type)}</p>
              <h3 className="mt-2 text-lg font-semibold">{resource.name}</h3>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Up to {resource.capacity} people</p>
              <p className="mt-auto pt-5 text-lg font-semibold">{Number(resource.price).toFixed(2)} MAD <span className="text-sm font-normal text-muted-foreground">per {resource.pricing_unit}</span></p>
              <Link href={`/workspaces/${workspace.id}/book?resource=${resource.id}`} className="mt-4 block rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90">Book this space</Link>
            </article>)}
          </div>
        )}
      </section>
    </div>
  );
}
