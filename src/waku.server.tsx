import { fsRouter } from "waku";
import adapter from "waku/adapters/cloudflare";

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

(
  baseWorker as {
    fetch: (req: Request, env?: unknown, ctx?: ExecutionContext) => Promise<Response>;
  }
).fetch = async (req: Request, env?: unknown, ctx?: ExecutionContext): Promise<Response> => {
  const response = await originalFetch(req, env, ctx);
  return withSecurityHeaders(response);
};

if (defaultExport && originalDefaultFetch) {
  defaultExport.fetch = async (req: Request, env?: unknown): Promise<Response> => {
    const response = await originalDefaultFetch(req, env);
    return withSecurityHeaders(response);
  };
}

export default baseWorker;
