import { fsRouter } from "waku";
import adapter from "waku/adapters/cloudflare";
import { getSession } from "@/lib/idp/session";
import { signSessionId } from "@/lib/idp/crypto";
import type { SessionInfo } from "@/lib/idp/session";

const baseWorker = adapter(
  fsRouter(import.meta.glob("./pages/**/*.{tsx,ts}", { exhaustive: true })),
  { static: true },
);

// Security headers applied to every response.
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

// Wraps a Response with security headers.
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Wrap both the top-level fetch and the defaultExport fetch (the one
// Cloudflare Workers actually calls for production deployments).
type WorkerExport = {
  fetch: (req: Request, env?: unknown, ctx?: ExecutionContext) => Promise<Response>;
};

const originalFetch = (
  baseWorker as {
    fetch: (req: Request, env?: unknown, ctx?: ExecutionContext) => Promise<Response>;
  }
).fetch;
const defaultExport = baseWorker.defaultExport as WorkerExport | undefined;
const originalDefaultFetch = defaultExport?.fetch;

/**
 * Pre-request session check for routes that need authentication.
 *
 * Waku v1.0.0-beta.9 does not pass the `headers` prop to page components
 * when using the Cloudflare adapter (the route object only contains
 * { path, query, hash }). So we verify the session here — in the fetch
 * wrapper where we have direct access to the Request — and either:
 *
 *  - Return a redirect Response (for unauthenticated /dash, or
 *    authenticated /login), or
 *  - Return a modified Request with a signed session id added as
 *    ?sid=...&sig=... query params (for authenticated /dash and /consent), or
 *  - Return null to let the request pass through unchanged.
 *
 * The signing key is only known to the server, so the signed session id
 * cannot be forged by a client. Page components verify the signature with
 * `verifySignedSessionId()` before using the session id.
 */
async function checkSession(req: Request): Promise<Response | Request | null> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Only intercept specific page routes
  if (pathname !== "/dash" && pathname !== "/login" && pathname !== "/consent") {
    return null;
  }

  let session: SessionInfo | null = null;
  try {
    session = await getSession(req);
  } catch {
    // If session check fails (e.g. DB error), redirect to login
    const origin = new URL(req.url).origin;
    if (pathname === "/dash" || pathname === "/consent") {
      return Response.redirect(
        `${origin}/login?redirect_after_login=${encodeURIComponent(pathname)}`,
        302,
      );
    }
    // For /login, fall through (let the page render)
  }

  if (pathname === "/dash") {
    if (!session) {
      // Unauthenticated — redirect to login
      const origin = new URL(req.url).origin;
      return Response.redirect(`${origin}/login?redirect_after_login=/dash`, 302);
    }
    // Authenticated — add signed session id to URL and proceed
    const sig = await signSessionId(session.session.id);
    url.searchParams.set("sid", session.session.id);
    url.searchParams.set("sig", sig);
    return new Request(url.toString(), req);
  }

  if (pathname === "/login") {
    if (session) {
      // Already logged in — redirect to dashboard
      const origin = new URL(req.url).origin;
      return Response.redirect(`${origin}/dash`, 302);
    }
    // Not authenticated — let the login page render
    return null;
  }

  if (pathname === "/consent") {
    if (!session) {
      // Not authenticated — redirect to login, pointing back to authorize
      const loginUrl = new URL("/login", url);
      loginUrl.searchParams.set(
        "redirect_after_login",
        `/authorize?${url.searchParams.toString()}`,
      );
      return Response.redirect(loginUrl.toString(), 302);
    }
    // Authenticated — add signed session id to URL and proceed
    const sig = await signSessionId(session.session.id);
    url.searchParams.set("sid", session.session.id);
    url.searchParams.set("sig", sig);
    return new Request(url.toString(), req);
  }

  return null;
}

// Wrap the top-level fetch
(
  baseWorker as {
    fetch: (req: Request, env?: unknown, ctx?: ExecutionContext) => Promise<Response>;
  }
).fetch = async (req: Request, env?: unknown, ctx?: ExecutionContext): Promise<Response> => {
  const sessionResult = await checkSession(req);
  if (sessionResult instanceof Response) {
    return withSecurityHeaders(sessionResult);
  }
  const request = sessionResult ?? req;
  const response = await originalFetch(request, env, ctx);
  return withSecurityHeaders(response);
};

// Wrap the defaultExport fetch (what Cloudflare Workers actually calls)
if (defaultExport && originalDefaultFetch) {
  defaultExport.fetch = async (req: Request, env?: unknown): Promise<Response> => {
    const sessionResult = await checkSession(req);
    if (sessionResult instanceof Response) {
      return withSecurityHeaders(sessionResult);
    }
    const request = sessionResult ?? req;
    const response = await originalDefaultFetch(request, env);
    return withSecurityHeaders(response);
  };
}

export default baseWorker;
