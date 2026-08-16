import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a cryptographically-random URL-safe ID (21 chars ≈ 128 bits).
 */
export function createId(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]!);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Internal prefix used by Waku for custom error digests (redirects, 404s, etc.).
 * This lets us throw Waku-compatible redirect errors from page components.
 */
const WAKU_ERROR_PREFIX = "__WAKU_CUSTOM_ERROR__;";

/**
 * Throw a Waku redirect error from a server component.
 *
 * Waku's request handler catches errors whose `digest` property starts with
 * `__WAKU_CUSTOM_ERROR__;` and decodes the embedded JSON to determine the
 * redirect location and status. This is the only way to redirect from a
 * React Server Component in Waku v1.0.0-beta.9 — returning a `Response`
 * object causes an RSC serialization error.
 *
 * @param location Absolute path or URL to redirect to.
 * @param status   HTTP redirect status (default 307).
 */
export function wakuRedirect(location: string, status: 303 | 307 | 308 = 307): never {
  const err = new Error(`Redirect to ${location}`);
  (err as Error & { digest: string }).digest =
    WAKU_ERROR_PREFIX + JSON.stringify({ status, location });
  throw err;
}
