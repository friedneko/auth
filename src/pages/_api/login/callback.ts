/**
 * Login callback — `POST /login/callback`
 *
 * Processes the login form: validates credentials, creates a session
 * (mixed DB + JWT), and redirects the user back to the authorize endpoint.
 */

import { verifyPassword } from "@/lib/idp/crypto";
import { getDb, getIssuer } from "@/lib/env";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/idp/session";
import { serializeSessionCookie } from "@/lib/idp/cookies";

export const POST = async (req: Request): Promise<Response> => {
  const formData = await req.formData();
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const redirectAfterLogin = formData.get("redirect_after_login")?.toString() ?? "/dash";

  // SECURITY: Validate redirect target is same-origin to prevent open redirect.
  // Only allow absolute URLs to our own issuer or relative paths.
  try {
    const target = new URL(redirectAfterLogin, getIssuer(req));
    if (target.origin !== getIssuer(req)) {
      return new Response("Invalid redirect URL.", {
        status: 400,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  } catch {
    // Not a valid URL — treat as relative path, which is safe
  }

  const db = await getDb();
  const rows = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email));

  if (rows.length === 0) {
    return new Response("Invalid email or password.", {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const user = rows[0]!;
  if (!user.passwordHash) {
    return new Response("Invalid email or password.", {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return new Response("Invalid email or password.", {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const issuer = getIssuer(req);
  const { token } = await createSession(user.id, issuer);

  const res = new Response(null, { status: 303, headers: { location: redirectAfterLogin } });
  res.headers.append("Set-Cookie", serializeSessionCookie(token));
  return res;
};

export const getConfig = async () => ({ render: "dynamic" }) as const;
