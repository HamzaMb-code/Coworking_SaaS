import api from "@/lib/api";

export type WorkspaceMemberRole = "owner" | "staff" | "customer";

export interface MemberUser {
  id: number;
  name: string;
  email: string;
}

export interface WorkspaceMember {
  id: number;
  user_id: number;
  workspace_id: number;
  role: WorkspaceMemberRole;
  user: MemberUser;
}

export interface CreateMemberData {
  user_id: number;
  role: Exclude<WorkspaceMemberRole, "owner">;
}

export interface UpdateMemberData {
  role: Exclude<WorkspaceMemberRole, "owner">;
}

interface MembersResponse {
  members: WorkspaceMember[];
}

interface MemberResponse {
  message: string;
  member: WorkspaceMember;
}

export async function getMembers(
  workspaceId: number,
): Promise<WorkspaceMember[]> {
  const response = await api.get<MembersResponse>(
    `/workspaces/${workspaceId}/members`,
  );

  return response.data.members;
}

export async function createMember(
  workspaceId: number,
  data: CreateMemberData,
): Promise<WorkspaceMember> {
  const response = await api.post<MemberResponse>(
    `/workspaces/${workspaceId}/members`,
    data,
  );

  return response.data.member;
}

export async function updateMember(
  workspaceId: number,
  memberId: number,
  data: UpdateMemberData,
): Promise<WorkspaceMember> {
  const response = await api.put<MemberResponse>(
    `/workspaces/${workspaceId}/members/${memberId}`,
    data,
  );

  return response.data.member;
}

export async function deleteMember(
  workspaceId: number,
  memberId: number,
): Promise<void> {
  await api.delete(
    `/workspaces/${workspaceId}/members/${memberId}`,
  );
}