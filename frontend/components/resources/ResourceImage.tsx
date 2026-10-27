"use client";

import Image from "next/image";
import { useState } from "react";
import { Armchair, BriefcaseBusiness, CalendarDays, LayoutGrid, Monitor, UsersRound } from "lucide-react";
import type { ResourceType } from "@/lib/resources";

type ResourceImageProps = {
  imageUrl?: string | null;
  type: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
};

const fallbackByType: Record<ResourceType, { icon: typeof Monitor; title: string; colors: string }> = {
  desk: { icon: Monitor, title: "Desk", colors: "bg-[#eaf3ed] text-[#176b4d]" },
  meeting_room: { icon: UsersRound, title: "Meeting room", colors: "bg-[#edf2f4] text-[#345b5a]" },
  private_office: { icon: BriefcaseBusiness, title: "Private office", colors: "bg-[#f1f0e9] text-[#6c6545]" },
  event_space: { icon: CalendarDays, title: "Event space", colors: "bg-[#f2edf5] text-[#70547c]" },
};

export default function ResourceImage({
  imageUrl,
  type,
  alt,
  className = "relative aspect-[16/10] w-full overflow-hidden rounded-xl",
  imageClassName = "object-cover",
  sizes = "(max-width: 768px) 100vw, 33vw",
}: ResourceImageProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const isSupportedUrl = Boolean(imageUrl && /^(https?:\/\/|blob:|\/)/i.test(imageUrl.trim()));
  const hasImage = Boolean(isSupportedUrl && imageUrl && failedUrl !== imageUrl);
  const fallback = Object.prototype.hasOwnProperty.call(fallbackByType, type)
    ? fallbackByType[type as ResourceType]
    : { icon: LayoutGrid, title: "Workspace resource", colors: "bg-[#f1f4f1] text-[#617068]" };
  const Icon = type === "desk" ? Armchair : fallback.icon;
  const label = alt?.trim() || `${fallback.title} image`;

  return (
    <div className={`${className} ${hasImage ? "bg-[#e8eee8]" : fallback.colors}`}>
      {hasImage ? (
        <Image
          unoptimized
          src={imageUrl!}
          alt={label}
          fill
          sizes={sizes}
          className={imageClassName}
          onError={() => setFailedUrl(imageUrl ?? "")}
        />
      ) : (
        <div role={alt ? "img" : undefined} aria-label={alt ? label : undefined} aria-hidden={alt ? undefined : true} className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-xl bg-white/75 shadow-sm ring-1 ring-black/[.04] sm:size-16">
            <Icon aria-hidden="true" className="size-7 sm:size-8" strokeWidth={1.6} />
          </span>
          {alt && <span className="sr-only">{label}</span>}
        </div>
      )}
    </div>
  );
}
