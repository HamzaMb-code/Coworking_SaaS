"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { register } from "@/lib/auth";

export default function RegisterPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-[#f2f1ec] text-sm text-[#66736b]">Loading registration...</main>}><RegisterForm /></Suspense>;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestedPath = searchParams.get("next");
  const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/dashboard";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setLoading(true);
    try { const response = await register({ name, email, password, password_confirmation: passwordConfirmation }); localStorage.setItem("token", response.token); router.replace(nextPath); }
    catch (requestError: unknown) { const errors = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined; const firstError = errors ? Object.values(errors).flat()[0] : undefined; setError(firstError ? String(firstError) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Registration failed. Please try again." : "Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#eef0ed] px-3 py-4 text-[#18231d] sm:px-6 sm:py-8 lg:px-8">
    <div className="grid w-full max-w-[1360px] gap-3 rounded-[32px] bg-white p-2.5 shadow-[0_24px_80px_rgba(44,53,42,.12)] sm:rounded-[38px] sm:p-3 lg:min-h-[min(820px,calc(100svh-4rem))] lg:grid-cols-[.94fr_1.06fr]">
      <section className="flex min-w-0 flex-col rounded-[26px] bg-[linear-gradient(145deg,#edf6ef_0%,#e8f2e9_63%,#f3edcf_100%)] px-6 py-7 sm:rounded-[30px] sm:px-10 sm:py-9 lg:px-12 xl:px-16" aria-labelledby="register-title">
        <Link href="/" className="flex w-fit items-center gap-2.5 rounded-lg text-lg font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5d45] focus-visible:ring-offset-4"><span className="grid size-9 place-items-center rounded-xl bg-[#1f5d45] text-white"><Building2 className="size-5" /></span><span>Workplace</span></Link>
        <div className="mx-auto my-auto w-full max-w-md py-9 lg:py-6">
          <div className="mb-6 text-center"><h1 id="register-title" className="text-[2rem] font-medium leading-tight tracking-[-.04em] sm:text-[2.35rem]">Create an account</h1><p className="mt-2 text-sm leading-6 text-[#606a62] sm:text-[15px]">Join Workplace and find a space that fits your day.</p></div>
          {error && <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-800">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-3">
            <RegistrationField id="name" label="Full name" icon={<UserRound aria-hidden="true" className="size-4" />} value={name} onChange={setName} placeholder="Your name" autoComplete="name" />
            <RegistrationField id="email" label="Email address" icon={<Mail aria-hidden="true" className="size-4" />} value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
            <RegistrationField id="password" label="Password" icon={<LockKeyhole aria-hidden="true" className="size-4" />} value={password} onChange={setPassword} placeholder="At least 8 characters" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} onToggleVisibility={() => setShowPassword((visible) => !visible)} isVisible={showPassword} />
            <RegistrationField id="password_confirmation" label="Confirm password" icon={<LockKeyhole aria-hidden="true" className="size-4" />} value={passwordConfirmation} onChange={setPasswordConfirmation} placeholder="Repeat your password" type={showPasswordConfirmation ? "text" : "password"} autoComplete="new-password" minLength={8} onToggleVisibility={() => setShowPasswordConfirmation((visible) => !visible)} isVisible={showPasswordConfirmation} />
            <p className="px-1 pt-0.5 text-xs text-[#69746c]">Use at least 8 characters for your password.</p>
            <Button type="submit" disabled={loading} className="mt-1 h-[50px] w-full rounded-full bg-[#1f5d45] text-sm font-semibold text-white shadow-sm transition hover:bg-[#174634] focus-visible:ring-[#1f5d45]/40 disabled:opacity-60">{loading ? "Creating account..." : <>Create account <ArrowRight className="ml-1 size-4" /></>}</Button>
          </form>
          <p className="mt-5 text-center text-sm text-[#646b64]">Already have an account? <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#1f5d45] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5d45]">Sign in</Link></p>
        </div>
      </section>
      <section className="relative min-h-[300px] overflow-hidden rounded-[26px] bg-[#30483b] sm:min-h-[390px] lg:min-h-0 lg:rounded-[30px]" aria-label="A welcoming coworking space"><Image src="/images/register_Image.webp" alt="A welcoming coworking lounge with a shared table and city views" fill priority sizes="(max-width: 1023px) 100vw, 55vw" className="object-cover object-center" /><div className="absolute inset-0 bg-gradient-to-t from-[#14251c]/65 via-[#14251c]/5 to-black/5" /><div className="absolute inset-x-4 bottom-4 rounded-[22px] border border-white/40 bg-white/25 p-4 text-white shadow-lg backdrop-blur-xl sm:inset-x-6 sm:bottom-6 sm:p-6 xl:inset-x-8 xl:bottom-8 xl:p-7"><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/85">Make room for good work</p><h2 className="mt-2 max-w-lg text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">A space for your next great idea.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-white/90 sm:text-[15px]">Discover welcoming places to focus, meet, and move your work forward.</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-medium sm:mt-5 sm:gap-2.5 sm:text-sm"><span className="rounded-full border border-white/50 bg-white/10 px-3 py-2 backdrop-blur">Desks & offices</span><span className="rounded-full border border-white/50 bg-white/10 px-3 py-2 backdrop-blur">Meeting rooms</span><span className="rounded-full border border-white/50 bg-white/10 px-3 py-2 backdrop-blur">Flexible bookings</span></div></div></section>
    </div>
  </main>;
}

function RegistrationField({ id, label, icon, value, onChange, placeholder, type = "text", minLength, autoComplete, onToggleVisibility, isVisible }: { id: string; label: string; icon: React.ReactNode; value: string; onChange: (value: string) => void; placeholder: string; type?: string; minLength?: number; autoComplete?: string; onToggleVisibility?: () => void; isVisible?: boolean }) {
  const isPassword = id === "password" || id === "password_confirmation";
  return <div><label className="mb-1.5 block text-xs font-medium text-[#66716a]" htmlFor={id}>{label}</label><div className="relative"><span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#778078]">{icon}</span><input id={id} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} minLength={minLength} required className={`h-11 w-full rounded-full border border-white bg-white/90 pl-11 ${isPassword ? "pr-12" : "pr-4"} text-sm text-[#20251f] shadow-sm outline-none transition placeholder:text-[#858b85] hover:border-[#d8ded7] focus-visible:border-[#1f5d45] focus-visible:ring-4 focus-visible:ring-[#1f5d45]/15`} />{isPassword && onToggleVisibility && <button type="button" onClick={onToggleVisibility} aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} aria-pressed={isVisible} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[#68736b] transition hover:bg-[#eef2ed] hover:text-[#1f5d45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5d45]">{isVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}</div></div>;
}
