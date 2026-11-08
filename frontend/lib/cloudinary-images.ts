const RESPONSIVE_WIDTHS = [64, 96, 128, 256, 384, 640, 960, 1280, 1920, 2560] as const;

/** Create width-based Cloudinary variants for the browser's native srcset selection. */
export function cloudinaryImageSrcSet(imageUrl?: string | null): string | undefined {
  if (!imageUrl) return undefined;

  try {
    const url = new URL(imageUrl.trim());
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return undefined;

    const marker = "/image/upload/";
    const uploadIndex = url.pathname.indexOf(marker);
    if (uploadIndex < 0) return undefined;

    const prefix = url.pathname.slice(0, uploadIndex + marker.length);
    const suffix = url.pathname.slice(uploadIndex + marker.length);
    if (!suffix) return undefined;

    return RESPONSIVE_WIDTHS.map((width) => {
      const candidate = new URL(url.toString());
      candidate.pathname = `${prefix}c_limit,w_${width}/${suffix}`;
      return `${candidate.toString()} ${width}w`;
    }).join(", ");
  } catch {
    return undefined;
  }
}
