import api from "@/lib/api";

export interface Workspace {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  image_path: string | null;
  image_url: string | null;
  status: string;
  available_resources_count?: number;
  starting_price?: number | string | null;
  resources?: Array<{ id: number; type: string; price: number | string; pricing_unit: string }>;
  bookings_count?: number;
  pivot?: { role: "owner" | "staff" | "customer" };
}

export interface CreateWorkspaceData {
  name: string;
  slug: string;
  description?: string;
  address: string;
  city: string;
  phone?: string;
  email?: string;
  image?: File | null;
  remove_image?: boolean;
}

interface WorkspacesResponse {
  workspaces: Workspace[];
}

interface WorkspaceResponse {
  message: string;
  workspace: Workspace;
}

export interface WorkspaceSearch {
  search?: string;
  city?: string;
  resource_type?: string;
  date?: string;
  price?: string;
  capacity?: string;
}

export async function getWorkspaces(
  search: WorkspaceSearch = {},
): Promise<Workspace[]> {
  const response = await api.get<WorkspacesResponse>("/workspaces", {
    params: search,
  });

  return response.data.workspaces;
}

export async function getMyWorkspaces(): Promise<Workspace[]> {
  const response = await api.get<WorkspacesResponse>("/my-workspaces");

  return response.data.workspaces;
}

export async function getOwnedWorkspaces(): Promise<Workspace[]> {
  const response = await api.get<WorkspacesResponse>("/owner/workspaces");

  return response.data.workspaces;
}

export async function createWorkspace(
  data: CreateWorkspaceData,
): Promise<Workspace> {
  const body = workspaceFormData(data);
  const response = await api.post<WorkspaceResponse>(
    "/workspaces",
    body,
    { headers: { "Content-Type": "multipart/form-data" } },
  );

  return response.data.workspace;
}

export async function getWorkspace(
  workspaceId: number,
): Promise<Workspace> {
  const response = await api.get<WorkspaceResponse>(
    `/workspaces/${workspaceId}`,
  );

  return response.data.workspace;
}

export async function updateWorkspace(
  workspaceId: number,
  data: Partial<CreateWorkspaceData>,
): Promise<Workspace> {
  const body = workspaceFormData(data);
  body.append("_method", "PUT");
  const response = await api.post<WorkspaceResponse>(`/workspaces/${workspaceId}`, body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.workspace;
}

export async function deleteWorkspace(workspaceId: number): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}`);
}

function workspaceFormData(data: Partial<CreateWorkspaceData>): FormData {
  const body = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value instanceof File) body.append(key, value);
    else if (typeof value === "boolean") body.append(key, value ? "1" : "0");
    else if (typeof value === "string") body.append(key, value);
  });
  return body;
}

export async function getMyFavorites(): Promise<Workspace[]> {
  const response = await api.get<WorkspacesResponse>("/my-favorites");
  return response.data.workspaces;
}

export async function addFavorite(workspaceId: number): Promise<void> {
  await api.put(`/workspaces/${workspaceId}/favorite`);
}

export async function removeFavorite(workspaceId: number): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/favorite`);
}
