"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const updateVisibility = (event?: Event) => {
      const target = event?.target;
      const targetTop = target instanceof HTMLElement ? target.scrollTop : 0;
      const scrollTop = Math.max(
        window.scrollY,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        targetTop,
      );
      setVisible(scrollTop > 2);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    document.addEventListener("scroll", updateVisibility, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", updateVisibility);
      document.removeEventListener("scroll", updateVisibility, true);
    };
  }, []);

  if (!visible) return null;

  return (
    <a
      href="#home"
      aria-label="Back to top"
      className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full bg-[#102d34] text-white shadow-xl transition hover:-translate-y-1 hover:bg-[#176b4d] focus:outline-none focus:ring-4 focus:ring-[#176b4d]/30"
    >
      <ArrowUp className="size-5" />
    </a>
  );
}
