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

export interface WorkspaceInvitationResponse extends WorkspaceInvitation {
  accepted_at: string | null;
  declined_at: string | null;
  response_read_at: string | null;
  responder?: { id: number; name: string; email: string } | null;
}

interface InvitationsResponse { invitations: WorkspaceInvitation[]; }
interface WorkspaceInvitationActivityResponse {
  invitations: WorkspaceInvitation[];
  responses: WorkspaceInvitationResponse[];
}
interface InvitationResponse { message?: string; invitation: WorkspaceInvitation; }
export interface InvitationPreview { workspace: string; workspace_id: number; email: string; role: "staff" | "customer"; expires_at: string; }
interface PreviewResponse { invitation: InvitationPreview; }

export async function sendWorkspaceInvitation(workspaceId: number, data: Pick<WorkspaceInvitation, "email" | "role">): Promise<WorkspaceInvitation> {
  const response = await api.post<InvitationResponse>(`/workspaces/${workspaceId}/invitations`, data);
  return response.data.invitation;
}

export async function getWorkspaceInvitations(workspaceId: number): Promise<WorkspaceInvitation[]> {
  const response = await api.get<WorkspaceInvitationActivityResponse>(`/workspaces/${workspaceId}/invitations`);
  return response.data.invitations;
}

export async function getWorkspaceInvitationActivity(workspaceId: number): Promise<WorkspaceInvitationActivityResponse> {
  const response = await api.get<WorkspaceInvitationActivityResponse>(`/workspaces/${workspaceId}/invitations`);
  return response.data;
}

export async function markWorkspaceInvitationResponsesRead(workspaceId: number): Promise<void> {
  await api.post(`/workspaces/${workspaceId}/invitations/responses/read`);
}

export async function dismissWorkspaceInvitationResponse(workspaceId: number, invitationId: number): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/invitations/${invitationId}/response`);
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
