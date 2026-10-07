import api from "@/lib/api";

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  platform_role: string;
}

export interface AuthResponse {
  message?: string;
  token: string;
  user: AuthUser;
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/login", data);

  return response.data;
}

export async function register(
  data: RegisterData,
): Promise<AuthResponse> {
  const response = await api.post<AuthResponse>("/register", data);

  return response.data;
}


export function getToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("token");
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await api.get<{ user: AuthUser }>("/me");

  return response.data.user;
}

export async function logout(): Promise<void> {
  await api.post("/logout");
}

export async function updateProfile(data: Pick<AuthUser, "name" | "email">): Promise<AuthUser> {
  const response = await api.put<{ user: AuthUser }>("/me", data);
  return response.data.user;
}
