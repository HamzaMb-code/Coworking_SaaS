"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/auth";

export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f2f1ec] text-sm text-[#66736b]">Loading sign in...</main>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestedPath = searchParams.get("next");
  const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try { const response = await login({ email, password }); localStorage.setItem("token", response.token); router.replace(nextPath); }
    catch (requestError: unknown) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Invalid credentials. Please try again." : "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#f2f1ec] px-3 py-4 text-[#18231d] sm:px-6 sm:py-8 lg:px-8">
    <div className="grid min-h-[min(760px,calc(100svh-2rem))] w-full max-w-[1360px] gap-3 rounded-[32px] bg-white p-2.5 shadow-[0_24px_80px_rgba(44,53,42,.12)] sm:rounded-[38px] sm:p-3 lg:grid-cols-[.98fr_1.02fr]">
      <div className="flex min-w-0 flex-col gap-3">
        <section className="flex min-h-[590px] flex-1 flex-col rounded-[26px] bg-[linear-gradient(145deg,#edf6ef_0%,#e8f2e9_65%,#dcebdd_100%)] px-6 py-7 sm:rounded-[30px] sm:px-10 sm:py-9 lg:min-h-0 lg:px-12 xl:px-16">
          <Link href="/" className="flex w-fit items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5d45] focus-visible:ring-offset-4"><span className="grid size-9 place-items-center rounded-xl bg-[#1f5d45] text-white"><Building2 className="size-5" /></span><span>Workplace</span></Link>
          <div className="my-auto w-full max-w-md self-center py-12 lg:py-8">
            <div className="mb-7 text-center"><span className="mx-auto grid size-10 place-items-center rounded-full bg-white/80 text-[#1f5d45] shadow-sm"><Sparkles className="size-5" /></span><h1 className="mt-4 text-[2rem] font-medium leading-tight tracking-[-.04em] sm:text-[2.5rem]">Welcome back</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#60665f] sm:text-[15px]">Sign in to find your space and pick up where your workday left off.</p></div>
            {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <label className="sr-only" htmlFor="email">Email address</label><div className="relative"><Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#778078]" /><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required aria-label="Email address" className="h-[52px] w-full rounded-full border border-white bg-white pl-12 pr-5 text-sm text-[#20251f] shadow-sm outline-none transition placeholder:text-[#858b85] hover:border-[#d8ded7] focus-visible:border-[#1f5d45] focus-visible:ring-4 focus-visible:ring-[#1f5d45]/15" /></div>
              <label className="sr-only" htmlFor="password">Password</label><div className="relative"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#778078]" /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required aria-label="Password" className="h-[52px] w-full rounded-full border border-white bg-white pl-12 pr-12 text-sm text-[#20251f] shadow-sm outline-none transition placeholder:text-[#858b85] hover:border-[#d8ded7] focus-visible:border-[#1f5d45] focus-visible:ring-4 focus-visible:ring-[#1f5d45]/15" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[#68736b] transition hover:bg-[#f0f2ee] hover:text-[#1f5d45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5d45]">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
              <Button type="submit" disabled={loading} className="mt-1 h-[52px] w-full rounded-full bg-[#1f5d45] text-sm font-semibold text-white shadow-sm transition hover:bg-[#174634] focus-visible:ring-[#1f5d45]/40 disabled:opacity-60">{loading ? "Signing in..." : <>Sign in <ArrowRight className="ml-1 size-4" /></>}</Button>
            </form>
            <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-black/10" /><span className="text-[11px] font-medium uppercase tracking-[.16em] text-[#858b85]">Your workspace awaits</span><span className="h-px flex-1 bg-black/10" /></div>
            <p className="text-center text-sm text-[#646b64]">New to Workplace? <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#1f5d45] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5d45]">Create an account</Link></p>
          </div>
        </section>
        <aside className="flex items-center gap-3 rounded-full bg-[#f1f1ef] px-5 py-3.5 sm:px-7 sm:py-4" aria-label="Workplace community"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-[#1f5d45] shadow-sm"><Building2 className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#252b26]">Find a place to do your best work.</span><span className="mt-0.5 block text-xs text-[#737a73]">Desks, rooms, and welcoming workspaces.</span></span><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-[#606a61]" /></aside>
      </div>
      <section className="relative min-h-[280px] overflow-hidden rounded-[26px] bg-[#30483b] sm:min-h-[360px] lg:min-h-0 lg:rounded-[30px]" aria-label="A bright coworking space"><Image src="/images/login_image.webp" alt="Sunlit coworking space with a shared table, desks, and city views" fill priority sizes="(max-width: 1023px) 100vw, 55vw" className="object-cover object-center" /><div className="absolute inset-0 bg-gradient-to-t from-[#14251c]/55 via-transparent to-black/5" /><div className="absolute inset-x-4 bottom-4 rounded-[22px] border border-white/35 bg-white/25 p-4 text-white shadow-lg backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-6 xl:inset-x-8 xl:bottom-8 xl:p-7"><div className="flex flex-wrap gap-2 sm:gap-3"><span className="flex min-h-10 flex-1 items-center justify-center rounded-full border border-white/70 bg-white/10 px-4 text-sm font-medium backdrop-blur-md">Spaces for focused work</span><span className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/70 bg-white/10 px-4 text-sm font-medium backdrop-blur-md"><Building2 aria-hidden="true" className="size-4" />Made for teams</span></div><p className="mt-4 text-sm leading-6 text-white/95 sm:mt-5 sm:text-[15px]">A brighter place to focus, connect, and get things done.</p></div></section>
    </div>
  </main>;
}
