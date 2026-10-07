"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ArrowRight, Building2, Check, Clock3, X } from "lucide-react";
import { acceptInvitation, declineInvitation, getMyInvitations, type WorkspaceInvitation } from "@/lib/invitations";

export default function InvitationsPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyToken, setBusyToken] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try { setError(""); setInvitations(await getMyInvitations()); }
    catch (requestError: unknown) { setError(axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not load invitations." : "Could not load invitations."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const answer = async (invitation: WorkspaceInvitation, accept: boolean) => {
    try {
      setBusyToken(invitation.token); setError(""); setMessage("");
      if (accept) await acceptInvitation(invitation.token); else await declineInvitation(invitation.token);
      setInvitations((current) => current.filter((item) => item.id !== invitation.id));
      setMessage(accept ? `You joined ${invitation.workspace?.name ?? "the workspace"}.` : `You declined the invitation to ${invitation.workspace?.name ?? "the workspace"}.`);
      if (accept) {
        window.dispatchEvent(new Event("workspace-memberships-changed"));
        router.refresh();
      }
    } catch (requestError: unknown) {
      const validation = axios.isAxiosError(requestError) ? requestError.response?.data?.errors : undefined;
      const first = validation ? Object.values(validation).flat()[0] : undefined;
      setError(first ? String(first) : axios.isAxiosError(requestError) ? requestError.response?.data?.message ?? "Could not respond to this invitation." : "Could not respond to this invitation.");
    } finally { setBusyToken(""); }
  };

  if (loading) return <p className="py-20 text-center text-sm text-muted-foreground">Loading invitations...</p>;
  return <div className="mx-auto max-w-4xl space-y-7"><div><p className="text-sm font-semibold text-[#4e5ff7]">Your workspace messages</p><h1 className="mt-1 text-3xl font-bold">Invitations</h1><p className="mt-2 text-slate-500">Review invitations sent to your account and choose whether to join.</p></div>{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}{invitations.length === 0 ? <section className="rounded-2xl border border-dashed bg-white p-12 text-center"><Building2 className="mx-auto size-8 text-[#4e5ff7]" /><h2 className="mt-4 font-semibold">You’re all caught up</h2><p className="mt-2 text-sm text-slate-500">New workspace invitations will appear here.</p><Link href="/dashboard" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#4e5ff7]">Back to overview <ArrowRight className="size-4" /></Link></section> : <div className="space-y-4">{invitations.map((invitation) => <article key={invitation.id} className="rounded-2xl border border-[#e8ebf3] bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-[#4e5ff7]"><Building2 className="size-5" /></span><div><h2 className="font-semibold">{invitation.workspace?.name ?? "Workspace invitation"}</h2><p className="mt-1 text-sm text-slate-500">You’re invited to join as <span className="font-medium capitalize text-slate-700">{invitation.role}</span>.</p><p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Clock3 className="size-3.5" />Respond by {new Date(invitation.expires_at).toLocaleDateString()}</p></div></div><div className="flex gap-2 sm:shrink-0"><button type="button" disabled={busyToken === invitation.token} onClick={() => void answer(invitation, false)} className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold text-slate-600 disabled:opacity-50"><X className="size-4" />Decline</button><button type="button" disabled={busyToken === invitation.token} onClick={() => void answer(invitation, true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#4e5ff7] px-4 text-sm font-semibold text-white disabled:opacity-50"><Check className="size-4" />{busyToken === invitation.token ? "Saving..." : "Accept invitation"}</button></div></div></article>)}</div>}</div>;
}
