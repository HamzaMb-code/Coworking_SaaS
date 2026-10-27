"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";

export default function HomeNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className={`fixed inset-x-[4.5%] top-[7%] z-50 rounded-t-[32px] border-x border-t backdrop-blur-xl transition-colors duration-300 ${scrolled ? "border-black/10 bg-white/95 shadow-lg shadow-black/10" : "border-white/30 bg-[#102c31]/15"}`}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className={`flex items-center gap-2.5 text-lg font-bold tracking-tight transition-colors ${scrolled ? "text-[#102d34]" : "text-white"}`}>
          <span className={`grid size-9 place-items-center rounded-xl transition-colors ${scrolled ? "bg-[#176b4d]/10 text-[#176b4d]" : "bg-white/15 text-white"}`}><Building2 className="size-5" /></span>WorkSpace
        </Link>
        <nav className={`hidden items-center gap-9 text-sm font-medium transition-colors md:flex ${scrolled ? "text-[#26332e]" : "text-white/85"}`}>
          <Link href="#home" className={scrolled ? "text-[#102d34]" : "text-white"}>Home</Link>
          <Link href="/discover" className="transition hover:text-[#176b4d]">Workspaces</Link>
          <Link href="#about" className="transition hover:text-[#176b4d]">About</Link>
          <Link href="#how-it-works" className="transition hover:text-[#176b4d]">How it works</Link>
        </nav>
        <div className={`flex items-center gap-4 text-sm font-medium transition-colors ${scrolled ? "text-[#102d34]" : "text-white"}`}>
          <Link href="/login" className="hidden transition hover:opacity-70 sm:inline">Log in</Link>
          <Link href="/register" className={`rounded-xl px-5 py-3 font-semibold shadow-sm transition ${scrolled ? "bg-[#176b4d] text-white hover:bg-[#125a40]" : "bg-white text-[#153b3a] hover:bg-white/85"}`}>Get started</Link>
        </div>
      </div>
    </header>
  );
}
