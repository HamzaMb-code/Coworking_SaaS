"use client";

import Image from "next/image";
import { useState } from "react";
import { Building2 } from "lucide-react";

const FALLBACK_IMAGE = "/images/workspace-placeholder.webp";

type WorkspaceImageProps = {
  imageUrl?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
};

/** Displays an uploaded workspace image, the local placeholder, then a safe neutral visual. */
export default function WorkspaceImage({
  imageUrl,
  alt,
  className = "relative aspect-[16/9] w-full overflow-hidden rounded-xl",
  imageClassName = "object-cover",
  sizes = "(max-width: 768px) 100vw, 33vw",
}: WorkspaceImageProps) {
  const [errorState, setErrorState] = useState({ source: null as string | null, uploadedFailed: false, fallbackFailed: false });
  const source = imageUrl?.trim() || null;
  const usableSource = source && /^(https?:\/\/|blob:|\/)/i.test(source) ? source : null;
  const currentError = errorState.source === source ? errorState : null;
  const showingUploadedImage = Boolean(usableSource && !currentError?.uploadedFailed);
  const src: string = showingUploadedImage ? usableSource! : FALLBACK_IMAGE;

  return (
    <div className={`${className} bg-[#eaf3ed]`}>
      {!currentError?.fallbackFailed ? (
        <Image
          unoptimized
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className={imageClassName}
          onError={() => {
            setErrorState({
              source,
              uploadedFailed: showingUploadedImage,
              fallbackFailed: !showingUploadedImage,
            });
          }}
        />
      ) : (
        <div role="img" aria-label={alt} className="absolute inset-0 grid place-items-center text-[#176b4d]">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/80 ring-1 ring-[#176b4d]/10">
            <Building2 aria-hidden="true" className="size-7" strokeWidth={1.6} />
          </span>
        </div>
      )}
    </div>
  );
}
