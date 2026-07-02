// API client for the platform auth surface. Request/response only — no business
// logic. Endpoints documented in docs/api.md under "Auth".

export interface AuthPreferences {
  enabled_apps: string[];
  onboarding_completed: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  is_owner: boolean;
  preferences: AuthPreferences;
}

export interface RegistrationStatus {
  registration_open: boolean;
  owner_exists: boolean;
}

export interface LoginAttempt {
  id: number;
  username: string;
  ip_address: string | null;
  user_agent: string;
  successful: boolean;
  created_at: string;
}

export interface Lockout {
  ip_address: string;
  failed: number;
  retry_after_seconds: number;
}

interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

const UNREACHABLE =
  "Cannot reach the server. Start the backend with `uv run manage.py runserver`.";

/** Error carrying the stable backend `code` so callers can branch on it. */
export class AuthApiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(message: string, code: string, status: number, details: unknown) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new AuthApiError(UNREACHABLE, "unreachable", 0, null);
  }
  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = { code: "internal_error", message: response.statusText || "Request failed" };
    }
    throw new AuthApiError(
      body.message || body.code,
      body.code || "internal_error",
      response.status,
      body.details ?? null,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Prime the CSRF cookie so subsequent unsafe requests carry a valid token. */
export function ensureCsrf(): Promise<{ csrftoken: string }> {
  return request<{ csrftoken: string }>("/api/auth/csrf/");
}

export function getRegistrationStatus(): Promise<RegistrationStatus> {
  return request<RegistrationStatus>("/api/auth/registration-status/");
}

export function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me/");
}

export function signup(username: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/signup/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/api/auth/logout/", { method: "POST" });
}

export function getPreferences(): Promise<AuthPreferences> {
  return request<AuthPreferences>("/api/auth/preferences/");
}

export function updatePreferences(patch: Partial<AuthPreferences>): Promise<AuthPreferences> {
  return request<AuthPreferences>("/api/auth/preferences/", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function getSecurityAttempts(): Promise<{ attempts: LoginAttempt[] }> {
  return request<{ attempts: LoginAttempt[] }>("/api/auth/security/attempts/");
}

export function getSecurityLockouts(): Promise<{ lockouts: Lockout[] }> {
  return request<{ lockouts: Lockout[] }>("/api/auth/security/lockouts/");
}

export function unlockIp(ipAddress: string): Promise<{ ip_address: string; cleared: number }> {
  return request<{ ip_address: string; cleared: number }>("/api/auth/security/unlock/", {
    method: "POST",
    body: JSON.stringify({ ip_address: ipAddress }),
  });
}
