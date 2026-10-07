"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowRight, Building2, LockKeyhole, Mail } from "lucide-react";
import { login } from "@/lib/auth";

export default function LoginPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#eaf3eb] text-sm text-[#66736b]">Loading sign in...</main>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  return <main className="flex min-h-screen items-center justify-center bg-[#eaf3eb] px-3 py-4 text-[#18231d] sm:px-6 sm:py-8">
    <div className="relative grid min-h-[min(760px,calc(100vh-2rem))] w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(28,67,47,.14)] sm:rounded-[36px] lg:grid-cols-[.94fr_1.06fr]">
      <section className="flex flex-col px-6 py-7 sm:px-10 sm:py-9 lg:px-12 xl:px-16">
        <Link href="/" className="flex w-fit items-center gap-2.5 text-lg font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#1f5d45] text-white"><Building2 className="size-5" /></span><span>Workplace</span></Link>
        <div className="my-auto w-full max-w-md self-center py-10 lg:py-12">
          <p className="text-sm font-semibold text-[#1f5d45]">Welcome back</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.1rem]">Sign in to your account</h1><p className="mt-3 text-sm leading-6 text-[#66736b]">Continue to explore and manage your bookings.</p>
          {error && <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="mt-7 space-y-4.5">
            <label className="block text-sm font-medium" htmlFor="email">Email address<div className="relative mt-2"><Mail className="pointer-events-none absolute left-4 top-3.5 size-4 text-[#829087]" /><input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required className="h-12 w-full rounded-full border border-[#e2e9e3] bg-[#f6f8f6] pl-11 pr-4 text-sm outline-none transition placeholder:text-[#9aa59e] focus:border-[#1f5d45] focus:bg-white focus:ring-4 focus:ring-[#1f5d45]/10" /></div></label>
            <label className="block text-sm font-medium" htmlFor="password">Password<div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-4 top-3.5 size-4 text-[#829087]" /><input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required className="h-12 w-full rounded-full border border-[#e2e9e3] bg-[#f6f8f6] pl-11 pr-4 text-sm outline-none transition placeholder:text-[#9aa59e] focus:border-[#1f5d45] focus:bg-white focus:ring-4 focus:ring-[#1f5d45]/10" /></div></label>
            <button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1f5d45] px-5 text-sm font-semibold text-white shadow-lg shadow-[#1f5d45]/15 transition hover:bg-[#174634] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Signing in..." : <>Sign in <ArrowRight className="size-4" /></>}</button>
          </form>
          <p className="mt-7 text-center text-sm text-[#66736b]">New to Workplace? <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#1f5d45] hover:underline">Create an account</Link></p>
        </div>
      </section>
      <section className="relative m-3 hidden overflow-hidden rounded-[28px] bg-[#1f5d45] lg:block" aria-label="Workplace welcome"><Image src="/images/login_image.webp" alt="A bright coworking space ready for focused work" fill priority sizes="(max-width: 1024px) 0px, 55vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#102c24]/85 via-[#102c24]/15 to-[#102c24]/5" /><div className="absolute inset-x-6 bottom-6 rounded-[24px] border border-white/25 bg-[#173a30]/45 p-6 text-white shadow-xl backdrop-blur-md xl:inset-x-8 xl:bottom-8 xl:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/75">Your workday, your way</p><h2 className="mt-3 max-w-lg text-3xl font-semibold leading-tight xl:text-4xl">A great space is just the start.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/85 xl:text-base">Find a place to focus, meet, and move your work forward.</p><p className="mt-6 border-t border-white/20 pt-4 text-sm text-white/75">Flexible spaces for modern work.</p></div></section>
    </div>
  </main>;
}
