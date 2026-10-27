"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { X } from "lucide-react";

import {
  deleteMember,
  getMembers,
  updateMember,
  type WorkspaceMember,
} from "@/lib/members";
import { dismissWorkspaceInvitationResponse, getWorkspaceInvitationActivity, markWorkspaceInvitationResponsesRead, sendWorkspaceInvitation, type WorkspaceInvitation, type WorkspaceInvitationResponse } from "@/lib/invitations";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function MembersPage() {
  const params = useParams();
  const { confirm: confirmAction, dialog } = useConfirmDialog();

  const workspaceId = Number(params.workspaceId);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [responses, setResponses] = useState<WorkspaceInvitationResponse[]>([]);
  const [dismissingResponseId, setDismissingResponseId] = useState<number | null>(null);

  const [showForm, setShowForm] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRole, setSelectedRole] =
    useState<"staff" | "customer">("customer");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);

  const dismissResponse = async (responseId: number) => {
    try {
      setDismissingResponseId(responseId);
      await dismissWorkspaceInvitationResponse(workspaceId, responseId);
      setResponses((current) => current.filter((response) => response.id !== responseId));
    } catch (error: unknown) {
      setError(axios.isAxiosError(error)
        ? error.response?.data?.message ?? "Could not remove this invitation response."
        : "Could not remove this invitation response.");
    } finally {
      setDismissingResponseId(null);
    }
  };

  /*
   * Load members and users
   */
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
        setError("Invalid workspace.");
        if (active) setLoading(false);
        return;
      }

      try {
        setError("");

        const [membersData, invitationActivity] = await Promise.all([
          getMembers(workspaceId),
          getWorkspaceInvitationActivity(workspaceId),
        ]);

        if (!active) return;
        setMembers(membersData);
        setInvitations(invitationActivity.invitations);
        setResponses(invitationActivity.responses);
        const unreadResponses = invitationActivity.responses.filter((response) => !response.response_read_at);
        if (unreadResponses.length > 0) {
          void markWorkspaceInvitationResponsesRead(workspaceId).catch(() => undefined);
        }
        window.dispatchEvent(new CustomEvent("workspace-invitation-responses-viewed", {
          detail: unreadResponses.map((response) =>
            `invitation-response:${response.id}:${response.accepted_at ?? response.declined_at}`,
          ),
        }));
      } catch (error: unknown) {
        if (!active) return;
        if (axios.isAxiosError(error)) {
          setError(
            error.response?.data?.message ??
              "Failed to load members.",
          );
        } else {
          setError("Something went wrong.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadData();
    const interval = window.setInterval(() => void loadData(), 30_000);
    const onFocus = () => void loadData();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [workspaceId]);

  // Invite by email so the invited person can choose whether to join.
  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!inviteEmail.trim()) {
      setFormError("Enter the email address to invite.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setEmailDeliveryFailed(false);

      const invitation = await sendWorkspaceInvitation(workspaceId, {
        email: inviteEmail.trim(),
        role: selectedRole,
      });

      setInvitations((current) => [invitation, ...current]);
      setInviteEmail("");
      setSelectedRole("customer");
      setEmailDeliveryFailed(invitation.email_sent === false);
      setFormMessage(invitation.email_sent === false
        ? `Invitation created for ${invitation.email}, but the email could not be delivered. The invitee can find it in their Invitations page after signing in.`
        : `Invitation sent to ${invitation.email}. They can accept or decline from the email link.`);
      setShowForm(false);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        const errors = error.response?.data?.errors;

        if (errors) {
          const firstError =
            Object.values(errors).flat()[0];

          setFormError(String(firstError));
        } else {
          setFormError(
            error.response?.data?.message ??
              "Failed to add member.",
          );
        }
      } else {
        setFormError("Something went wrong.");
      }
    } finally {
      setSaving(false);
    }
  };

  /*
   * Update member role
   */
  const handleRoleChange = async (
    member: WorkspaceMember,
    role: "staff" | "customer",
  ) => {
    try {
      setError("");

      const updatedMember = await updateMember(
        workspaceId,
        member.id,
        { role },
      );

      setMembers((current) =>
        current.map((currentMember) =>
          currentMember.id === updatedMember.id
            ? updatedMember
            : currentMember,
        ),
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
            "Failed to update member.",
        );
      } else {
        setError("Something went wrong.");
      }
    }
  };

  /*
   * Delete member
   */
  const handleDelete = async (
    member: WorkspaceMember,
  ) => {
    const confirmed = await confirmAction(
      `Are you sure you want to remove ${member.user.name} from this workspace?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      await deleteMember(workspaceId, member.id);

      setMembers((current) =>
        current.filter(
          (currentMember) =>
            currentMember.id !== member.id,
        ),
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        setError(
          error.response?.data?.message ??
            "Failed to remove member.",
        );
      } else {
        setError("Something went wrong.");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Loading members...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {dialog}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Members
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Manage members and their roles in this workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current);
            setFormError("");
          }}
          className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 sm:w-auto ${showForm ? "border border-[#dce5df] bg-white text-[#425249] hover:border-[#bdcfc1] hover:bg-[#f4f7f4]" : "bg-[#176b4d] text-white shadow-[#176b4d]/15 hover:bg-[#125a40]"}`}
        >
          {showForm ? "Cancel" : "Invite member"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {formMessage && <div role="status" className={`rounded-lg border p-4 text-sm ${emailDeliveryFailed ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-700"}`}>{formMessage}</div>}

      {/* Add member form */}
      {showForm && (
        <div className="rounded-xl border p-5 sm:p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">
              Invite a member
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Send an invitation. The person joins only after accepting it.
            </p>
          </div>

          {formError && (
            <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="grid gap-5 sm:grid-cols-2"
          >
              <div className="space-y-2">
                <label htmlFor="inviteEmail" className="text-sm font-medium">Email address</label>
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  required
                  placeholder="colleague@example.com"
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2"
                />
              </div>

              {/* Role */}
              <div className="space-y-2">
                <label
                  htmlFor="role"
                  className="text-sm font-medium"
                >
                  Role
                </label>

                <select
                  id="role"
                  value={selectedRole}
                  onChange={(event) =>
                    setSelectedRole(
                      event.target.value as
                        | "staff"
                        | "customer",
                    )
                  }
                  className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2"
                >
                  <option value="customer">
                    Customer
                  </option>

                  <option value="staff">
                    Staff
                  </option>
                </select>
              </div>

              {/* Submit */}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 w-full rounded-xl bg-[#176b4d] px-4 text-sm font-semibold text-white shadow-md shadow-[#176b4d]/15 transition duration-200 hover:-translate-y-0.5 hover:bg-[#125a40] hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Sending invitation..." : "Send invitation"}
                </button>
              </div>
            </form>
        </div>
      )}

      {responses.length > 0 && <section>
        <div className="mb-4"><h2 className="text-lg font-semibold">Invitation responses</h2><p className="text-sm text-muted-foreground">See who accepted or declined your workspace invitation.</p></div>
        <div className="divide-y overflow-hidden rounded-xl border border-[#dce7de] bg-white">{responses.map((response) => {
          const accepted = Boolean(response.accepted_at);
          return <article key={`${response.id}-${response.accepted_at ?? response.declined_at}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-medium">{response.responder?.name ?? response.email}</p><p className="mt-1 text-sm text-muted-foreground">{response.responder?.email ?? response.email} · {response.role}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(response.accepted_at ?? response.declined_at ?? response.expires_at).toLocaleString()}</p></div>
            <div className="flex items-center gap-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${accepted ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{accepted ? "Accepted" : "Declined"}</span><button type="button" aria-label="Remove invitation response" title="Remove response" disabled={dismissingResponseId === response.id} onClick={() => void dismissResponse(response.id)} className="grid size-9 place-items-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-wait disabled:opacity-50"><X className="size-4" /></button></div>
          </article>;
        })}</div>
      </section>}

      <section>
        <div className="mb-4"><h2 className="text-lg font-semibold">Pending invitations</h2><p className="text-sm text-muted-foreground">Invitees need to accept before they become workspace members.</p></div>
        {invitations.length === 0 ? <div className="rounded-xl border p-5 text-sm text-muted-foreground">No pending invitations.</div> : <div className="divide-y rounded-xl border">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{invitation.email}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{invitation.role} · expires {new Date(invitation.expires_at).toLocaleDateString()}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">Awaiting response</span></div>)}</div>}
      </section>

      {/* Members */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Workspace Members
          </h2>

          <p className="text-sm text-muted-foreground">
            People who have access to this workspace.
          </p>
        </div>

        {members.length === 0 ? (
          <div className="rounded-xl border p-8 text-center">
            <p className="font-medium">
              No members yet.
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Add members to this workspace.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
              const isOwner = member.role === "owner";

              return (
                <div
                  key={member.id}
                  className="rounded-xl border p-5"
                >
                  {/* User information */}
                  <div>
                    <h3 className="font-semibold">
                      {member.user.name}
                    </h3>

                    <p className="mt-1 break-all text-sm text-muted-foreground">
                      {member.user.email}
                    </p>
                  </div>

                  {/* Role */}
                  <div className="mt-5">
                    <label
                      htmlFor={`role-${member.id}`}
                      className="mb-2 block text-sm font-medium"
                    >
                      Role
                    </label>

                    <select
                      id={`role-${member.id}`}
                      value={member.role}
                      disabled={isOwner}
                      onChange={(event) =>
                        handleRoleChange(
                          member,
                          event.target.value as
                            | "staff"
                            | "customer",
                        )
                      }
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="owner">
                        Owner
                      </option>

                      <option value="staff">
                        Staff
                      </option>

                      <option value="customer">
                        Customer
                      </option>
                    </select>
                  </div>

                  {/* Remove */}
                  <div className="mt-5 border-t pt-4">
                    {isOwner ? (
                      <p className="text-xs text-muted-foreground">
                        Workspace owner
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(member)
                        }
                        className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-600 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:ring-4 focus-visible:ring-red-500/20"
                      >
                        Remove member
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
