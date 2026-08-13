// Auth client for the FastAPI backend's /auth/* endpoints.
// Token is kept in localStorage and a tiny pub/sub lets components
// (ProfileMenu, HistorySheet, Index) react to login/logout without a
// full context provider.

import { API_BASE_URL } from "@/lib/research-stream";

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

const TOKEN_KEY = "orbit_token";
const USER_KEY = "orbit_user";

type Listener = (user: User | null) => void;
const listeners = new Set<Listener>();

function notify() {
  const user = getUser();
  listeners.forEach((l) => l(user));
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notify();
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notify();
}

async function parseErrorDetail(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return body.detail ?? fallback;
  } catch {
    return fallback;
  }
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Registration failed"));
  }
  const data = await res.json();
  setSession(data.access_token, data.user);
  return data.user;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, "Login failed"));
  }
  const data = await res.json();
  setSession(data.access_token, data.user);
  return data.user;
}

/** Authenticated fetch helper - adds the bearer token if present. */
export function authFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}
