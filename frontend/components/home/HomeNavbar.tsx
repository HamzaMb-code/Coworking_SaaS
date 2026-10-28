"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Menu, X } from "lucide-react";

export default function HomeNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 40);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("keydown", closeOnEscape); };
  }, []);

  return (
    <header className={`fixed inset-x-[4.5%] top-[7%] z-50 rounded-t-[32px] border-x border-t backdrop-blur-xl transition-colors duration-300 ${scrolled ? "border-black/10 bg-white/95 shadow-lg shadow-black/10" : "border-white/30 bg-[#102c31]/15"}`}>
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className={`flex items-center gap-2.5 text-lg font-bold tracking-tight transition-colors ${scrolled ? "text-[#102d34]" : "text-white"}`}>
          <span className={`grid size-9 place-items-center rounded-xl transition-colors ${scrolled ? "bg-[#176b4d]/10 text-[#176b4d]" : "bg-white/15 text-white"}`}><Building2 className="size-5" /></span>WorkSpace
        </Link>
        <nav className={`hidden items-center gap-9 text-sm font-medium transition-colors md:flex ${scrolled ? "text-[#26332e]" : "text-white/85"}`}>
          <Link href="#home" onClick={() => setMenuOpen(false)} className={scrolled ? "text-[#102d34]" : "text-white"}>Home</Link>
          <Link href="/discover" onClick={() => setMenuOpen(false)} className="transition hover:text-[#176b4d]">Workspaces</Link>
          <Link href="#about" onClick={() => setMenuOpen(false)} className="transition hover:text-[#176b4d]">About</Link>
          <Link href="#how-it-works" onClick={() => setMenuOpen(false)} className="transition hover:text-[#176b4d]">How it works</Link>
        </nav>
        <div className={`flex items-center gap-4 text-sm font-medium transition-colors ${scrolled ? "text-[#102d34]" : "text-white"}`}>
          <Link href="/login" className="hidden transition hover:opacity-70 md:inline">Log in</Link>
          <Link href="/register" className={`hidden rounded-xl px-5 py-3 font-semibold shadow-sm transition md:inline-flex ${scrolled ? "bg-[#176b4d] text-white hover:bg-[#125a40]" : "bg-white text-[#153b3a] hover:bg-white/85"}`}>Get started</Link>
          <button type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} aria-controls="home-mobile-navigation" onClick={() => setMenuOpen((open) => !open)} className={`grid size-10 place-items-center rounded-xl transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b4d] md:hidden ${scrolled ? "text-[#102d34]" : "text-white"}`}><span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>{menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
      </div>
      {menuOpen && <nav id="home-mobile-navigation" aria-label="Main navigation" className={`absolute inset-x-0 top-full grid gap-1 rounded-b-2xl border border-t-0 p-3 text-sm font-medium shadow-xl md:hidden ${scrolled ? "border-black/10 bg-white text-[#26332e]" : "border-white/20 bg-[#153b3a]/95 text-white backdrop-blur-xl"}`}>
        <Link href="#home" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 hover:bg-black/5">Home</Link>
        <Link href="/discover" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 hover:bg-black/5">Workspaces</Link>
        <Link href="#about" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 hover:bg-black/5">About</Link>
        <Link href="#how-it-works" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-3 hover:bg-black/5">How it works</Link>
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-current/15 pt-3">
          <Link href="/login" onClick={() => setMenuOpen(false)} className="rounded-lg border border-current/20 px-3 py-3 text-center">Log in</Link>
          <Link href="/register" onClick={() => setMenuOpen(false)} className="rounded-lg bg-[#176b4d] px-3 py-3 text-center font-semibold text-white">Get started</Link>
        </div>
      </nav>}
    </header>
  );
}
