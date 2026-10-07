"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { getWorkspaces, type Workspace } from "@/lib/workspaces";

const previews = [
  { name: "The Greenhouse", city: "Casablanca", type: "Coworking space", price: "120 MAD / day", rating: "4.9", image: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1000&q=85" },
  { name: "Studio Atlas", city: "Rabat", type: "Private office", price: "250 MAD / day", rating: "4.8", image: "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1000&q=85" },
  { name: "The Meeting House", city: "Marrakech", type: "Meeting room", price: "180 MAD / hour", rating: "4.9", image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=85" },
];

export default function PopularWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    let active = true;
    getWorkspaces()
      .then((results) => { if (active) setWorkspaces(results.slice(0, 3)); })
      .catch(() => { if (active) setWorkspaces([]); });
    return () => { active = false; };
  }, []);

  const hasListings = workspaces.length > 0;

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {hasListings ? workspaces.map((workspace, index) => (
        <article key={workspace.id} className="group overflow-hidden rounded-2xl border border-[#e1e8e2] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#133c2a]/10">
          <div className="relative h-56 overflow-hidden bg-[#e8eee8]">
            <Image src={previews[index % previews.length].image} alt="Bright modern coworking interior" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-xs font-semibold capitalize text-[#315b43] backdrop-blur">{workspace.available_resources_count ?? 0} spaces</span>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold tracking-tight">{workspace.name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-[#68766e]"><MapPin className="size-4" />{workspace.city}</p><p className="mt-2 text-xs capitalize text-[#89938d]">{workspace.resources?.[0]?.type.replaceAll("_", " ") ?? "Coworking space"}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-[#f6f5ed] px-2.5 py-1 text-xs font-semibold text-[#765d22]"><Star className="size-3.5 fill-current" />{previews[index % previews.length].rating}</span></div>
            <div className="mt-5 flex items-end justify-between gap-3 border-t border-[#edf0ed] pt-4"><div><p className="text-xs text-[#89938d]">Starting from</p><p className="mt-1 font-semibold">{workspace.starting_price ? `${Number(workspace.starting_price).toLocaleString()} MAD` : "See available rates"}<span className="font-normal text-[#7b8981]">{workspace.starting_price && workspace.resources?.[0] ? ` / ${workspace.resources[0].pricing_unit}` : ""}</span></p></div><Link href={`/discover?city=${encodeURIComponent(workspace.city)}`} className="inline-flex items-center gap-2 rounded-xl bg-[#edf4ef] px-4 py-2.5 text-sm font-semibold text-[#176b4d] transition hover:bg-[#dfebe2]">Explore <ArrowRight className="size-4" /></Link></div>
          </div>
        </article>
      )) : previews.map((space) => (
        <article key={space.name} className="group overflow-hidden rounded-2xl border border-[#e1e8e2] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#133c2a]/10">
          <div className="relative h-56 overflow-hidden bg-[#e8eee8]"><Image src={space.image} alt={`${space.type} interior`} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /><span className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-xs font-semibold text-[#315b43] backdrop-blur">Featured space</span></div>
          <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold tracking-tight">{space.name}</h3><p className="mt-1 flex items-center gap-1.5 text-sm text-[#68766e]"><MapPin className="size-4" />{space.city} <span>·</span> {space.type}</p></div><span className="inline-flex items-center gap-1 rounded-full bg-[#f6f5ed] px-2.5 py-1 text-xs font-semibold text-[#765d22]"><Star className="size-3.5 fill-current" />{space.rating}</span></div><div className="mt-5 flex items-end justify-between gap-3 border-t border-[#edf0ed] pt-4"><div><p className="text-xs text-[#89938d]">Starting from</p><p className="mt-1 font-semibold">{space.price}</p></div><Link href={`/discover?city=${encodeURIComponent(space.city)}`} className="inline-flex items-center gap-2 rounded-xl bg-[#edf4ef] px-4 py-2.5 text-sm font-semibold text-[#176b4d] transition hover:bg-[#dfebe2]">Explore <ArrowRight className="size-4" /></Link></div></div>
        </article>
      ))}
    </div>
  );
}
