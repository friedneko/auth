/**
 * Cookie helpers built on the `cookie` npm package.
 *
 * Handles:
 * - Parsing the Cookie header from a Request
 * - Serializing cookies for Set-Cookie response headers
 * - Session cookie get / set / clear
 * - Error cookie (for flashing OIDC errors to the UI)
 */

import * as cookie from "cookie";
import { SESSION_COOKIE_NAME, ERROR_COOKIE_NAME, SESSION_JWT_TTL } from "./constants";

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
  domain?: string;
}

export interface SessionCookieData {
  token: string;
}

const DEFAULT_COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_JWT_TTL,
};

/**
 * Parse all cookies from a Request's Cookie header.
 */
export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie");
  if (!header) return {};
  return cookie.parse(header);
}

/**
 * Get the session token from the request cookies.
 */
export function getSessionToken(req: Request): string | null {
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE_NAME] ?? null;
}

/**
 * Serialize a Set-Cookie header value for the session cookie.
 */
export function serializeSessionCookie(
  token: string,
  options: Partial<CookieOptions> = {},
): string {
  const opts = { ...DEFAULT_COOKIE_OPTS, ...options };
  const serializeOpts: cookie.CookieSerializeOptions = {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    ...(opts.maxAge !== undefined && { maxAge: opts.maxAge }),
    ...(opts.domain && { domain: opts.domain }),
  };
  return cookie.serialize(SESSION_COOKIE_NAME, token, serializeOpts);
}

/**
 * Serialize a Set-Cookie header value that clears the session cookie.
 */
export function clearSessionCookie(): string {
  return cookie.serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

/**
 * Set the session cookie on a Response.
 */
export function setSessionCookie(
  res: Response,
  token: string,
  options: Partial<CookieOptions> = {},
): Response {
  const setCookie = serializeSessionCookie(token, options);
  const newHeaders = new Headers(res.headers);
  appendSetCookie(newHeaders, setCookie);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

/**
 * Append a Set-Cookie header (handles multiple cookies).
 */
function appendSetCookie(headers: Headers, value: string): void {
  const existing = headers.get("Set-Cookie");
  if (existing) {
    headers.set("Set-Cookie", `${existing}, ${value}`);
  } else {
    headers.set("Set-Cookie", value);
  }
}

/**
 * Clear the session cookie on a Response (used for logout).
 */
export function clearSessionCookieOnResponse(res: Response): Response {
  const clearCookie = clearSessionCookie();
  const newHeaders = new Headers(res.headers);
  appendSetCookie(newHeaders, clearCookie);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

/**
 * Set an error cookie (for OIDC error info passed to UI).
 * The cookie is short-lived and httpOnly.
 */
export function setErrorCookie(err: string, description?: string): string {
  const payload = encodeURIComponent(
    JSON.stringify({ error: err, error_description: description }),
  );
  return cookie.serialize(ERROR_COOKIE_NAME, payload, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 minutes
  });
}

/**
 * Parse the error cookie from a request.
 */
export function getErrorCookie(req: Request): {
  error: string;
  error_description?: string;
} | null {
  const cookies = parseCookies(req);
  const raw = cookies[ERROR_COOKIE_NAME];
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
}
