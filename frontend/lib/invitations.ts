import api from "@/lib/api";

export interface WorkspaceInvitation {
  id: number;
  token: string;
  email: string;
  role: "staff" | "customer";
  expires_at: string;
  email_sent?: boolean;
  workspace?: { id: number; name: string; city?: string; address?: string };
}

interface InvitationsResponse { invitations: WorkspaceInvitation[]; }
interface InvitationResponse { message?: string; invitation: WorkspaceInvitation; }
export interface InvitationPreview { workspace: string; workspace_id: number; email: string; role: "staff" | "customer"; expires_at: string; }
interface PreviewResponse { invitation: InvitationPreview; }

export async function sendWorkspaceInvitation(workspaceId: number, data: Pick<WorkspaceInvitation, "email" | "role">): Promise<WorkspaceInvitation> {
  const response = await api.post<InvitationResponse>(`/workspaces/${workspaceId}/invitations`, data);
  return response.data.invitation;
}

export async function getWorkspaceInvitations(workspaceId: number): Promise<WorkspaceInvitation[]> {
  const response = await api.get<InvitationsResponse>(`/workspaces/${workspaceId}/invitations`);
  return response.data.invitations;
}

export async function getMyInvitations(): Promise<WorkspaceInvitation[]> {
  const response = await api.get<InvitationsResponse>("/my-invitations");
  return response.data.invitations;
}

export async function getInvitation(token: string): Promise<InvitationPreview> {
  const response = await api.get<PreviewResponse>(`/invitations/${token}`);
  return response.data.invitation;
}

export async function acceptInvitation(token: string): Promise<void> {
  await api.post(`/invitations/${token}/accept`);
}

export async function declineInvitation(token: string): Promise<void> {
  await api.post(`/invitations/${token}/decline`);
}
