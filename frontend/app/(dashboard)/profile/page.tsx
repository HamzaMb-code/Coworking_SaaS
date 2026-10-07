"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { getCurrentUser, updateProfile, type AuthUser } from "@/lib/auth";

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser().then((profile) => { setUser(profile); setName(profile.name); setEmail(profile.email); }).catch(() => setError("Could not load your profile.")).finally(() => setLoading(false));
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try { setSaving(true); setError(""); setMessage(""); const updated = await updateProfile({ name, email }); setUser(updated); setMessage("Your profile has been updated."); }
    catch (requestError: unknown) { const errors = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined; const first = errors ? Object.values(errors).flat()[0] : undefined; setError(first ? String(first) : "Could not update your profile."); }
    finally { setSaving(false); }
  };

  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading profile...</p>;
  return <div className="mx-auto max-w-3xl space-y-7"><div><p className="text-sm font-semibold text-[#4e5ff7]">Account</p><h1 className="mt-1 text-3xl font-bold">Profile &amp; settings</h1><p className="mt-2 text-slate-500">Keep your account details up to date.</p></div><form onSubmit={save} className="space-y-5 rounded-2xl border border-[#e8ebf3] bg-white p-6"><div><label htmlFor="profile-name" className="text-sm font-medium">Name</label><input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} className="mt-2 h-11 w-full rounded-lg border px-3" /></div><div><label htmlFor="profile-email" className="text-sm font-medium">Email</label><input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={255} className="mt-2 h-11 w-full rounded-lg border px-3" /></div>{user && <p className="text-xs capitalize text-slate-400">Account type: {user.platform_role}</p>}{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}<button disabled={saving} className="rounded-lg bg-[#4e5ff7] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save changes"}</button></form></div>;
}
