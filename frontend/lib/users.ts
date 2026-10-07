import api from "@/lib/api";

export interface User {
  id: number;
  name: string;
  email: string;
}

interface UsersResponse {
  users: User[];
}

export async function getUsers(): Promise<User[]> {
  const response = await api.get<UsersResponse>("/users");

  return response.data.users;
}