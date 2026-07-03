import type { TokenPair } from "@/types";

const BASE = "/api/v1";
const ACCESS_KEY = "gsb_access";
const REFRESH_KEY = "gsb_refresh";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// Single-flight: várias requests 401 simultâneas disparam um único refresh.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshPromise ??= (async () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return false;
    try {
      const resp = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!resp.ok) return false;
      setTokens((await resp.json()) as TokenPair);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    }
  })();
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  json?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.json !== undefined) headers["Content-Type"] = "application/json";
  return fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.json !== undefined ? JSON.stringify(options.json) : undefined,
  });
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  let resp = await rawRequest(path, options);

  if (resp.status === 401 && !path.startsWith("/auth/")) {
    if (await tryRefresh()) {
      resp = await rawRequest(path, options);
    } else {
      clearTokens();
      window.location.assign("/login");
      throw new ApiError(401, "Sessão expirada");
    }
  }

  if (!resp.ok) {
    let detail = `Erro ${resp.status}`;
    try {
      const body = (await resp.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) {
        detail = body.detail
          .map((d: { msg?: string }) => d.msg ?? "")
          .filter(Boolean)
          .join("; ");
      }
    } catch {
      /* corpo não-JSON */
    }
    throw new ApiError(resp.status, detail);
  }

  if (resp.status === 204) return undefined as T;
  return (await resp.json()) as T;
}
