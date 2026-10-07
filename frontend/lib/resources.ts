import api from "@/lib/api";

export interface Resource {
  id: number;
  name: string;
  type: string;
  capacity: number;
  price: number;
  pricing_unit: string;
  status: string;
}

export interface CreateResourceData {
  name: string;
  type: string;
  capacity: number;
  price: number;
  pricing_unit: string;
  status?: string;
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
    data,
  );

  return response.data.resource;
}

export async function updateResource(
  workspaceId: number,
  resourceId: number,
  data: Partial<CreateResourceData>,
): Promise<Resource> {
  const response = await api.put<ResourceResponse>(
    `/workspaces/${workspaceId}/resources/${resourceId}`,
    data,
  );

  return response.data.resource;
}

export async function deleteResource(
  workspaceId: number,
  resourceId: number,
): Promise<void> {
  await api.delete(
    `/workspaces/${workspaceId}/resources/${resourceId}`,
  );
}