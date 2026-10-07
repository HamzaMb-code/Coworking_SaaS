"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, MapPin, Search, Star } from "lucide-react";
import { getWorkspaces, type Workspace, type WorkspaceSearch } from "@/lib/workspaces";

const types = [
  ["", "Any workspace type"],
  ["coworking", "Coworking spaces"],
  ["private_office", "Private offices"],
  ["meeting_room", "Meeting rooms"],
  ["hot_desk", "Hot desks"],
];
const fallbackImage = "/images/heroImage.webp";

export default function DiscoverPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f1f2ef] text-sm text-[#718078]">Loading workspaces...</main>}><DiscoverContent /></Suspense>;
}

function DiscoverContent() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return <DiscoverResults key={query} query={query} />;
}

function DiscoverResults({ query }: { query: string }) {
  const router = useRouter();
  const [filters, setFilters] = useState<WorkspaceSearch>(() => filtersFromQuery(query));
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getWorkspaces(filtersFromQuery(query))
      .then(setWorkspaces)
      .catch(() => { setWorkspaces([]); setError("Workspaces could not be loaded right now. Please try again."); })
      .finally(() => setLoading(false));
  }, [query]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value?.trim()) params.set(key, value.trim()); });
    const queryString = params.toString();
    router.push(`/discover${queryString ? `?${queryString}` : ""}`);
  };

  return <main className="min-h-screen bg-[#f1f2ef] text-[#172441]">
    <header className="border-b border-[#e5e9e4] bg-white/90 backdrop-blur"><div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8"><Link href="/" className="flex items-center gap-2.5 text-lg font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#176b4d] text-white"><Building2 className="size-5" /></span>WorkSpace</Link><Link href="/" className="text-sm font-semibold text-[#53645a] hover:text-[#176b4d]">Back to home</Link></div></header>
    <div className="mx-auto max-w-7xl space-y-10 px-5 py-10 sm:px-8 sm:py-14">
      <section className="rounded-[28px] bg-[#163e37] px-6 py-8 text-white shadow-xl shadow-[#163e37]/10 sm:px-9 sm:py-10"><p className="text-xs font-bold uppercase tracking-[.2em] text-white/65">A place to do your best work</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Find a workspace that fits.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">Explore flexible coworking spaces, private offices, and meeting rooms across Morocco.</p>
        <form onSubmit={submit} className="mt-7 grid gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur sm:grid-cols-2 lg:grid-cols-6">
          <label className="sr-only" htmlFor="discover-city">City</label><input id="discover-city" value={filters.city ?? ""} onChange={(event) => setFilters((old) => ({ ...old, city: event.target.value }))} placeholder="City" className="h-11 min-w-0 rounded-xl border border-white/25 bg-white px-3 text-sm text-[#253b30] placeholder:text-[#8b978e] outline-none focus:ring-2 focus:ring-white/50" />
          <label className="sr-only" htmlFor="discover-type">Workspace type</label><select id="discover-type" value={filters.resource_type ?? ""} onChange={(event) => setFilters((old) => ({ ...old, resource_type: event.target.value }))} className="h-11 min-w-0 rounded-xl border border-white/25 bg-white px-3 text-sm text-[#253b30] outline-none focus:ring-2 focus:ring-white/50">{types.map(([value, label], index) => <option key={`${value}-${index}`} value={value}>{label}</option>)}</select>
          <label className="sr-only" htmlFor="discover-date">Date</label><input id="discover-date" type="date" value={filters.date ?? ""} onChange={(event) => setFilters((old) => ({ ...old, date: event.target.value }))} className="h-11 min-w-0 rounded-xl border border-white/25 bg-white px-3 text-sm text-[#253b30] outline-none focus:ring-2 focus:ring-white/50" />
          <label className="sr-only" htmlFor="discover-price">Maximum price</label><input id="discover-price" type="number" min="0" step="1" value={filters.price ?? ""} onChange={(event) => setFilters((old) => ({ ...old, price: event.target.value }))} placeholder="Max price (MAD)" className="h-11 min-w-0 rounded-xl border border-white/25 bg-white px-3 text-sm text-[#253b30] placeholder:text-[#8b978e] outline-none focus:ring-2 focus:ring-white/50" />
          <label className="sr-only" htmlFor="discover-capacity">Minimum capacity</label><input id="discover-capacity" type="number" min="1" step="1" value={filters.capacity ?? ""} onChange={(event) => setFilters((old) => ({ ...old, capacity: event.target.value }))} placeholder="People" className="h-11 min-w-0 rounded-xl border border-white/25 bg-white px-3 text-sm text-[#253b30] placeholder:text-[#8b978e] outline-none focus:ring-2 focus:ring-white/50" />
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#174b3c] transition hover:bg-[#e9f1eb]"><Search className="size-4" />Explore</button>
        </form>
      </section>

      <section><div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#176b4d]">Thoughtfully chosen</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Available workspaces</h2></div><span className="text-sm text-[#718078]">{!loading && `${workspaces.length} places`}</span></div>
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {loading ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-[370px] animate-pulse rounded-2xl bg-white" />)}</div> : workspaces.length === 0 ? <div className="rounded-2xl border border-dashed border-[#cbd7ce] bg-white/70 p-10 text-center"><MapPin className="mx-auto size-8 text-[#659076]" /><h3 className="mt-3 font-semibold">No workspaces match those filters</h3><p className="mt-2 text-sm text-[#718078]">Try a different city, date, or price range.</p><button type="button" onClick={() => router.push("/discover")} className="mt-5 rounded-xl bg-[#176b4d] px-5 py-2.5 text-sm font-semibold text-white">Clear filters</button></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{workspaces.map((workspace) => <article key={workspace.id} className="group overflow-hidden rounded-2xl border border-[#e1e8e2] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#133c2a]/10"><div className="relative h-56 overflow-hidden rounded-t-2xl bg-[#e8eee8]"><Image unoptimized src={workspace.image_url || fallbackImage} alt={`${workspace.name} workspace`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold capitalize text-[#315b43]">{workspace.available_resources_count ?? 0} spaces</span></div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{workspace.name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-[#68766e]"><MapPin className="size-4" />{workspace.city}</p><p className="mt-2 text-xs capitalize text-[#89938d]">{workspace.resources?.[0]?.type.replaceAll("_", " ") ?? "Coworking space"}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-[#f6f5ed] px-2.5 py-1 text-xs font-semibold text-[#765d22]"><Star className="size-3.5 fill-current" />4.9</span></div><div className="mt-5 flex items-end justify-between gap-3 border-t border-[#edf0ed] pt-4"><div><p className="text-xs text-[#89938d]">Starting from</p><p className="mt-1 font-semibold">{workspace.starting_price ? `${Number(workspace.starting_price).toLocaleString()} MAD` : "See available rates"}<span className="font-normal text-[#7b8981]">{workspace.starting_price && workspace.resources?.[0] ? ` / ${workspace.resources[0].pricing_unit}` : ""}</span></p></div><Link href={`/workspaces/${workspace.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[#176b4d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#125a40]">View space <ArrowRight className="size-4" /></Link></div></div></article>)}</div>}
      </section>
    </div>
    <footer className="border-t border-[#e3e8e3] bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-[#718078] sm:flex-row sm:items-center sm:justify-between sm:px-8"><Link href="/" className="font-semibold text-[#20392d]">WorkSpace</Link><p>Find the right place for your next great workday.</p><Link href="/register" className="font-semibold text-[#176b4d]">List your workspace <ArrowRight className="inline size-4" /></Link></div></footer>
  </main>;
}

function filtersFromQuery(query: string): WorkspaceSearch {
  const params = new URLSearchParams(query);
  return {
    city: params.get("city") ?? "",
    resource_type: params.get("resource_type") ?? "",
    date: params.get("date") ?? "",
    price: params.get("price") ?? "",
    capacity: params.get("capacity") ?? "",
  };
}
