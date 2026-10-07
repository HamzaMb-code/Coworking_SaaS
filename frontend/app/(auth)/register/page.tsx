"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowRight, Building2, Check, LockKeyhole, Mail, UserRound } from "lucide-react";
import { register } from "@/lib/auth";

export default function RegisterPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#eaf3eb] text-sm text-[#66736b]">Loading registration...</main>}><RegisterForm /></Suspense>;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const requestedPath = searchParams.get("next");
  const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try { const response = await register({ name, email, password, password_confirmation: passwordConfirmation }); localStorage.setItem("token", response.token); router.replace(nextPath); }
    catch (requestError: unknown) { const errors = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined; const firstError = errors ? Object.values(errors).flat()[0] : undefined; setError(firstError ? String(firstError) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Registration failed. Please try again." : "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-[#eaf3eb] px-3 py-4 text-[#18231d] sm:px-6 sm:py-8">
    <div className="relative grid min-h-[min(820px,calc(100vh-2rem))] w-full max-w-6xl overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_rgba(28,67,47,.14)] sm:rounded-[36px] lg:grid-cols-[.94fr_1.06fr]">
      <section className="flex flex-col px-6 py-7 sm:px-10 sm:py-9 lg:px-12 xl:px-16">
        <Link href="/" className="flex w-fit items-center gap-2.5 text-lg font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#1f5d45] text-white"><Building2 className="size-5" /></span><span>Workplace</span></Link>
        <div className="my-auto w-full max-w-md self-center py-8 lg:py-10">
          <p className="text-sm font-semibold text-[#1f5d45]">Start exploring</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-[2.1rem]">Create your account</h1><p className="mt-3 text-sm leading-6 text-[#66736b]">Book the space your work needs, whenever you need it.</p>
          {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5"><Field id="name" label="Full name" icon={<UserRound />} value={name} onChange={setName} placeholder="Your name" autoComplete="name" /><Field id="email" label="Email address" icon={<Mail />} value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" /><Field id="password" label="Password" icon={<LockKeyhole />} value={password} onChange={setPassword} placeholder="At least 8 characters" type="password" autoComplete="new-password" minLength={8} /><Field id="password_confirmation" label="Confirm password" icon={<LockKeyhole />} value={passwordConfirmation} onChange={setPasswordConfirmation} placeholder="Repeat your password" type="password" autoComplete="new-password" minLength={8} /><button type="submit" disabled={loading} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1f5d45] px-5 text-sm font-semibold text-white shadow-lg shadow-[#1f5d45]/15 transition hover:bg-[#174634] disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Creating account..." : <>Create account <ArrowRight className="size-4" /></>}</button></form>
          <p className="mt-6 text-center text-sm text-[#66736b]">Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#1f5d45] hover:underline">Sign in</Link></p>
        </div>
      </section>
      <section className="relative m-3 hidden overflow-hidden rounded-[28px] bg-[#1f5d45] lg:block" aria-label="About Workplace"><Image src="/images/register_Image.webp" alt="A bright shared workspace for productive teams" fill priority sizes="(max-width: 1024px) 0px, 55vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#102c24]/90 via-[#102c24]/20 to-[#102c24]/5" /><div className="absolute inset-x-6 bottom-6 rounded-[24px] border border-white/25 bg-[#173a30]/50 p-6 text-white shadow-xl backdrop-blur-md xl:inset-x-8 xl:bottom-8 xl:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/75">One account, many spaces</p><h2 className="mt-3 max-w-lg text-3xl font-semibold leading-tight xl:text-4xl">Make room for your best work.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/85 xl:text-base">Your account gives you a simple way to discover and reserve the right space for the day.</p><ul className="mt-5 grid gap-3 text-sm font-medium sm:grid-cols-2">{["Explore active workspaces", "Book rooms and desks online", "Keep reservations in one place"].map((item) => <li key={item} className="flex items-center gap-2"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/20 text-white"><Check className="size-3.5" /></span>{item}</li>)}</ul><p className="mt-5 border-t border-white/20 pt-4 text-sm text-white/75">No membership commitment required.</p></div></section>
    </div>
  </main>;
}

function Field({ id, label, icon, value, onChange, placeholder, type = "text", minLength, autoComplete }: { id: string; label: string; icon: React.ReactNode; value: string; onChange: (value: string) => void; placeholder: string; type?: string; minLength?: number; autoComplete?: string }) {
  return <label className="block text-sm font-medium" htmlFor={id}>{label}<div className="relative mt-1.5"><span className="pointer-events-none absolute left-4 top-3.5 text-[#829087]">{icon}</span><input id={id} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} minLength={minLength} required className="h-11 w-full rounded-full border border-[#e2e9e3] bg-[#f6f8f6] pl-11 pr-4 text-sm outline-none transition placeholder:text-[#9aa59e] focus:border-[#1f5d45] focus:bg-white focus:ring-4 focus:ring-[#1f5d45]/10" /></div></label>;
}
