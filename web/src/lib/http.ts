// Session-cookie auth plumbing for every same-origin `/api` request.
//
// The backend authenticates via an httpOnly session cookie and enforces CSRF on
// unsafe methods for logged-in users. The browser already sends the session
// cookie on same-origin requests, so all we add here is:
//   1. the `X-CSRFToken` header (read from the readable `csrftoken` cookie) on
//      POST/PUT/PATCH/DELETE, and
//   2. a hook that reports a lost session (401/403 on a non-auth endpoint) so
//      the router can bounce the user back to the login screen.
//
// Installing a single fetch wrapper keeps every per-app client (which each own a
// tiny `fetch` helper) covered without touching them.

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfToken(): string | null {
  return getCookie("csrftoken");
}

let unauthorizedHandler: (() => void) | null = null;

/** Register the callback invoked when the session is rejected mid-flight. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.pathname;
  if (input instanceof Request) return input.url;
  return String(input);
}

function isApiRequest(url: string): boolean {
  return url.startsWith("/api/") || url.startsWith("api/");
}

function isAuthEndpoint(url: string): boolean {
  return url.includes("/api/auth/");
}

/** Wrap the global fetch once, at boot, before any request is issued. */
export function installApiInterceptor(): void {
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = requestUrl(input);

    if (!isApiRequest(url)) {
      return original(input, init);
    }

    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    if (UNSAFE_METHODS.has(method)) {
      const token = getCsrfToken();
      if (token && !headers.has("X-CSRFToken")) {
        headers.set("X-CSRFToken", token);
      }
    }

    const response = await original(input, {
      credentials: "same-origin",
      ...init,
      headers,
    });

    // A rejected session on a gated (non-auth) endpoint means the cookie is gone
    // or expired: surface it so the app can re-gate.
    if (!isAuthEndpoint(url) && (response.status === 401 || response.status === 403)) {
      unauthorizedHandler?.();
    }
    return response;
  };
}
