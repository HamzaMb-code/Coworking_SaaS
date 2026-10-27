"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, RefreshCw } from "lucide-react";
import { getWorkspaces, type Workspace } from "@/lib/workspaces";
import WorkspaceImage from "@/components/workspaces/WorkspaceImage";

type LoadStatus = "loading" | "success" | "error";

export default function PopularWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    getWorkspaces({}, controller.signal)
      .then((results) => {
        setWorkspaces(results.slice(0, 3));
        setStatus("success");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setErrorMessage("We couldn’t load workspaces right now. Check your connection and try again.");
        setStatus("error");
      });

    return () => controller.abort();
  }, [retryKey]);

  const retry = () => {
    setErrorMessage("");
    setStatus("loading");
    setRetryKey((current) => current + 1);
  };

  if (status === "loading") {
    return (
      <div aria-label="Loading popular workspaces" aria-busy="true" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <article key={item} aria-hidden="true" className="card-surface overflow-hidden">
            <div className="aspect-[16/10] animate-pulse bg-[#e8eee8]" />
            <div className="space-y-4 p-5">
              <div className="h-6 w-3/5 animate-pulse rounded-md bg-[#e8eee8]" />
              <div className="h-4 w-2/5 animate-pulse rounded-md bg-[#edf1ed]" />
              <div className="h-3 w-1/3 animate-pulse rounded-md bg-[#edf1ed]" />
              <div className="mt-5 flex items-center justify-between border-t border-[#edf0ed] pt-4">
                <div className="h-9 w-28 animate-pulse rounded-md bg-[#edf1ed]" />
                <div className="h-10 w-24 animate-pulse rounded-xl bg-[#e5efe8]" />
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div role="alert" className="card-surface flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center">
        <h3 className="text-lg font-semibold">Workspaces are temporarily unavailable</h3>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{errorMessage}</p>
        <button type="button" onClick={retry} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#176b4d] px-4 text-sm font-semibold text-white transition hover:bg-[#125a40] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] focus-visible:ring-offset-2">
          <RefreshCw className="size-4" /> Try again
        </button>
      </div>
    );
  }

  if (workspaces.length === 0) {
    return (
      <div className="card-surface grid items-center gap-6 overflow-hidden p-6 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#176b4d]">Coming soon</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#172441]">Your next workspace awaits</h3>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[#687591]">We’re preparing great places for you to work, meet, and create. Check back soon!</p>
          <Link href="/discover" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#176b4d] transition hover:text-[#125a40]">Browse workspaces <ArrowRight className="size-4" /></Link>
        </div>
        <WorkspaceImage alt="Illustration for the empty workspace listings state" className="relative mx-auto aspect-[16/10] w-full max-w-sm overflow-hidden rounded-xl" sizes="(max-width: 640px) 100vw, 384px" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {workspaces.map((workspace) => {
        const resourceType = workspace.resources?.[0]?.type.replaceAll("_", " ");
        return (
          <article key={workspace.id} className="card-surface group overflow-hidden">
            <div className="relative aspect-[16/10] overflow-hidden bg-[#e8eee8]">
              <WorkspaceImage imageUrl={workspace.image_url} alt={`${workspace.name} workspace`} className="relative h-full w-full" imageClassName="object-cover transition duration-300 group-hover:scale-[1.02]" sizes="(max-width: 768px) 100vw, 33vw" />
              <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-xs font-semibold capitalize text-[#315b43] backdrop-blur">{workspace.available_resources_count ?? 0} spaces</span>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold tracking-tight">{workspace.name}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-[#68766e]"><MapPin className="size-4" />{workspace.city}</p>
              {resourceType && <p className="mt-2 text-xs capitalize text-[#89938d]">{resourceType}</p>}
              {workspace.starting_price != null && <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#edf0ed] pt-4"><div><p className="text-xs text-[#89938d]">Starting from</p><p className="mt-1 font-semibold">{Number(workspace.starting_price).toLocaleString()} MAD<span className="font-normal text-[#7b8981]">{workspace.resources?.[0] ? ` / ${workspace.resources[0].pricing_unit}` : ""}</span></p></div><Link href={`/workspaces/${workspace.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#edf4ef] px-4 py-2.5 text-sm font-semibold text-[#176b4d] transition hover:bg-[#dfebe2]">Explore <ArrowRight className="size-4" /></Link></div>}
              {workspace.starting_price == null && <Link href={`/workspaces/${workspace.id}`} className="mt-5 inline-flex items-center gap-2 border-t border-[#edf0ed] pt-4 text-sm font-semibold text-[#176b4d] transition hover:text-[#125a40]">Explore workspace <ArrowRight className="size-4" /></Link>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
