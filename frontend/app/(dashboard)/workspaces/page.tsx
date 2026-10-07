"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";
import { Building2, Heart, MapPin, Search, Users } from "lucide-react";
import { addFavorite, getMyFavorites, getWorkspaces, removeFavorite, type Workspace, type WorkspaceSearch } from "@/lib/workspaces";

const resourceTypes = ["desk", "meeting_room", "private_office"];
const readableType = (type: string) => type.replaceAll("_", " ");

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filters, setFilters] = useState<WorkspaceSearch>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);

  const loadWorkspaces = async (search: WorkspaceSearch = filters) => {
    try {
      setLoading(true);
      setError("");
      setWorkspaces(await getWorkspaces(search));
    } catch (requestError: unknown) {
      setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load workspaces." : "Could not load workspaces.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialWorkspaces = async () => {
      try {
      const data = await getWorkspaces({});
      setWorkspaces(data);
      const favorites = await getMyFavorites();
      setFavoriteIds(favorites.map((workspace) => workspace.id));
      } catch (requestError: unknown) {
        setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load workspaces." : "Could not load workspaces.");
      } finally {
        setLoading(false);
      }
    };

    void loadInitialWorkspaces();
  }, []);

  const toggleFavorite = async (workspaceId: number) => {
    try {
      if (favoriteIds.includes(workspaceId)) {
        await removeFavorite(workspaceId);
        setFavoriteIds((current) => current.filter((id) => id !== workspaceId));
      } else {
        await addFavorite(workspaceId);
        setFavoriteIds((current) => [...current, workspaceId]);
      }
    } catch {
      setError("Could not update favorites. Please try again.");
    }
  };

  const updateFilter = (field: keyof WorkspaceSearch, value: string) => {
    setFilters((current) => ({ ...current, [field]: value || undefined }));
  };

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadWorkspaces();
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-[#dce7de] bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-semibold text-[#176b4d]">On-demand workspaces</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Find space that works for you</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">Book a desk, meeting room, or private office by the hour, day, or month.</p>
        <form onSubmit={handleSearch} className="mt-6 grid gap-3 rounded-xl border border-[#dce7de] bg-[#f4f8f4] p-4 md:grid-cols-[1.5fr_1fr_1fr_auto]">
          <label className="sr-only" htmlFor="workspace-search">Search workspaces</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <input id="workspace-search" value={filters.search ?? ""} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search by location or workspace" className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm" />
          </div>
          <input value={filters.city ?? ""} onChange={(event) => updateFilter("city", event.target.value)} placeholder="City" className="h-10 rounded-md border bg-background px-3 text-sm" />
          <select value={filters.resource_type ?? ""} onChange={(event) => updateFilter("resource_type", event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm">
            <option value="">Any space type</option>
            {resourceTypes.map((type) => <option key={type} value={type}>{readableType(type)}</option>)}
          </select>
          <button type="submit" className="h-10 rounded-md bg-[#176b4d] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a40] hover:shadow-md">Search</button>
        </form>
      </section>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-semibold">Available locations</h2>
          {!loading && <p className="text-sm text-muted-foreground">{workspaces.length} found</p>}
        </div>
        {loading ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Finding workspaces...</div> : workspaces.length === 0 ? (
          <div className="border border-dashed p-10 text-center"><h2 className="font-semibold">No workspaces match those filters</h2><p className="mt-2 text-sm text-muted-foreground">Try a different city, workspace name, or space type.</p></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((workspace) => (
              <article key={workspace.id} className="flex min-h-64 flex-col rounded-2xl border border-[#dce7de] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#b9d3c0] hover:shadow-md">
                <div className="flex items-start justify-between gap-3"><Building2 className="h-5 w-5 text-[#176b4d]" aria-hidden="true" /><button type="button" onClick={() => void toggleFavorite(workspace.id)} aria-label={favoriteIds.includes(workspace.id) ? `Remove ${workspace.name} from favorites` : `Save ${workspace.name} to favorites`} className="grid size-9 place-items-center rounded-full border border-[#d6e5da] text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#eaf3ed]"><Heart className={`size-4 ${favoriteIds.includes(workspace.id) ? "fill-current" : ""}`} /></button></div>
                <h3 className="mt-6 text-lg font-semibold">{workspace.name}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{workspace.city}, {workspace.address}</p>
                {workspace.description && <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{workspace.description}</p>}
                <p className="mt-auto flex items-center gap-2 pt-5 text-sm text-muted-foreground"><Users className="h-4 w-4" />{workspace.available_resources_count ?? 0} bookable spaces</p>
                <Link href={`/workspaces/${workspace.id}`} className="mt-5 block rounded-md border border-[#cbdccf] px-4 py-2 text-center text-sm font-semibold text-[#176b4d] transition hover:border-[#176b4d] hover:bg-[#176b4d] hover:text-white">View availability</Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
