import api from "@/lib/api";

export interface Resource {
  id: number;
  name: string;
  type: ResourceType;
  image_url: string | null;
  capacity: number;
  price: number;
  pricing_unit: string;
  status: string;
}

export type ResourceType = "desk" | "meeting_room" | "private_office" | "event_space";

export interface CreateResourceData {
  name: string;
  type: string;
  capacity: number;
  price: number;
  pricing_unit: string;
  status?: string;
  image?: File | null;
  remove_image?: boolean;
}

interface ResourcesResponse {
  resources: Resource[];
}

interface ResourceResponse {
  message: string;
  resource: Resource;
}

export async function getResources(
  workspaceId: number,
): Promise<Resource[]> {
  const response = await api.get<ResourcesResponse>(
    `/workspaces/${workspaceId}/resources`,
  );

  return response.data.resources;
}

export async function createResource(
  workspaceId: number,
  data: CreateResourceData,
): Promise<Resource> {
  const response = await api.post<ResourceResponse>(
    `/workspaces/${workspaceId}/resources`,
    resourceFormData(data),
    { headers: { "Content-Type": "multipart/form-data" } },
  );

  return response.data.resource;
}

export async function updateResource(
  workspaceId: number,
  resourceId: number,
  data: Partial<CreateResourceData>,
): Promise<Resource> {
  const body = resourceFormData(data);
  body.append("_method", "PUT");
  const response = await api.post<ResourceResponse>(
    `/workspaces/${workspaceId}/resources/${resourceId}`,
    body,
    { headers: { "Content-Type": "multipart/form-data" } },
  );

  return response.data.resource;
}

function resourceFormData(data: Partial<CreateResourceData>): FormData {
  const body = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (key === "image" && !(value instanceof File)) return;
    body.append(key, value instanceof File ? value : typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  });
  return body;
}

export async function deleteResource(
  workspaceId: number,
  resourceId: number,
): Promise<void> {
  await api.delete(
    `/workspaces/${workspaceId}/resources/${resourceId}`,
  );
}
