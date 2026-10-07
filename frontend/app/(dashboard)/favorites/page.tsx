"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, MapPin, Users } from "lucide-react";
import { getMyFavorites, removeFavorite, type Workspace } from "@/lib/workspaces";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getMyFavorites().then(setFavorites).catch(() => setError("Could not load your favorites.")).finally(() => setLoading(false));
  }, []);

  const remove = async (workspaceId: number) => {
    try {
      await removeFavorite(workspaceId);
      setFavorites((current) => current.filter((workspace) => workspace.id !== workspaceId));
    } catch { setError("Could not update your favorites."); }
  };

  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading favorites...</p>;
  return <div className="mx-auto max-w-6xl space-y-7">
    <div><p className="text-sm font-semibold text-[#4e5ff7]">Saved for later</p><h1 className="mt-1 text-3xl font-bold">Favorite workspaces</h1><p className="mt-2 text-slate-500">Keep your go-to places close by.</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {favorites.length === 0 ? <section className="rounded-2xl border border-dashed bg-white p-12 text-center"><Heart className="mx-auto size-8 text-[#4e5ff7]" /><h2 className="mt-4 font-semibold">No favorites yet</h2><p className="mt-2 text-sm text-slate-500">Save a workspace from Explore Workspaces to find it here.</p><Link href="/workspaces" className="mt-5 inline-flex rounded-lg bg-[#4e5ff7] px-4 py-2.5 text-sm font-semibold text-white">Explore workspaces</Link></section> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{favorites.map((workspace) => <article key={workspace.id} className="rounded-2xl border border-[#e8ebf3] bg-white p-5"><div className="flex justify-between"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-[#4e5ff7]"><Heart className="size-5 fill-current" /></span><button onClick={() => void remove(workspace.id)} className="text-sm text-slate-500 hover:text-red-600">Remove</button></div><h2 className="mt-5 font-semibold">{workspace.name}</h2><p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><MapPin className="size-4" />{workspace.city}, {workspace.address}</p><p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Users className="size-4" />{workspace.available_resources_count ?? 0} bookable spaces</p><Link href={`/workspaces/${workspace.id}`} className="mt-5 block rounded-lg border px-4 py-2.5 text-center text-sm font-semibold hover:bg-slate-50">View availability</Link></article>)}</div>}
  </div>;
}
