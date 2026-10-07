"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { acceptInvitation, declineInvitation, getInvitation, type InvitationPreview } from "@/lib/invitations";
import { getToken } from "@/lib/auth";

export default function InvitationLinkPage() {
  const params = useParams();
  const token = String(params.token);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setHasSession(Boolean(getToken()));
    getInvitation(token).then(setInvitation).catch((requestError: unknown) => setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "This invitation is no longer available." : "This invitation is no longer available.")).finally(() => setLoading(false));
  }, [token]);

  const answer = async (accept: boolean) => {
    if (!invitation) return;
    try {
      setBusy(true); setError("");
      if (accept) { await acceptInvitation(token); setMessage("Invitation accepted. Welcome to the workspace."); window.dispatchEvent(new Event("workspace-memberships-changed")); }
      else { await declineInvitation(token); setMessage("Invitation declined."); }
    } catch (requestError: unknown) {
      const validation = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined;
      const first = validation ? Object.values(validation).flat()[0] : undefined;
      setError(first ? String(first) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not respond to this invitation." : "Could not respond to this invitation.");
    } finally { setBusy(false); }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f6f7fb] text-sm text-slate-500">Loading invitation...</main>;
  return <main className="grid min-h-screen place-items-center bg-[#f6f7fb] px-5 py-12"><section className="w-full max-w-lg rounded-3xl border border-[#e8ebf3] bg-white p-7 text-center shadow-sm sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-50 text-2xl text-[#4e5ff7]">⌂</span><p className="mt-5 text-sm font-semibold text-[#4e5ff7]">Workspace invitation</p>{invitation ? <><h1 className="mt-2 text-2xl font-bold">Join {invitation.workspace}</h1><p className="mt-3 text-slate-500">You’ve been invited as <span className="font-semibold capitalize text-slate-700">{invitation.role}</span> using <span className="font-medium text-slate-700">{invitation.email}</span>.</p><p className="mt-2 text-xs text-slate-400">This invitation expires {new Date(invitation.expires_at).toLocaleString()}.</p></> : <><h1 className="mt-2 text-2xl font-bold">Invitation unavailable</h1><p className="mt-3 text-slate-500">{error || "This invitation has expired or has already been answered."}</p></>}{error && invitation && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-left text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}{invitation && !message && (hasSession ? <div className="mt-7 flex justify-center gap-3"><button type="button" disabled={busy} onClick={() => void answer(false)} className="rounded-lg border px-5 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Decline</button><button type="button" disabled={busy} onClick={() => void answer(true)} className="rounded-lg bg-[#4e5ff7] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Please wait..." : "Accept invitation"}</button></div> : <div className="mt-7 flex flex-wrap justify-center gap-3"><Link href={`/login?next=${encodeURIComponent(`/invitations/${token}`)}`} className="rounded-lg bg-[#4e5ff7] px-5 py-2.5 text-sm font-semibold text-white">Sign in to respond</Link><Link href={`/register?next=${encodeURIComponent(`/invitations/${token}`)}`} className="rounded-lg border px-5 py-2.5 text-sm font-semibold">Create account</Link></div>)}{message && <Link href={`/dashboard?workspace=${invitation?.workspace_id ?? ""}`} className="mt-6 inline-block text-sm font-semibold text-[#4e5ff7]">Continue to WorkSpace</Link>}</section></main>;
}
