/**
 * Signup callback — `POST /signup/callback`
 *
 * Processes the signup form: creates a new user with a hashed password,
 * then logs them in automatically (creates a session and redirects).
 */

import { hashPassword } from "@/lib/idp/crypto";
import { getDb, getIssuer } from "@/lib/idp/env";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/idp/session";
import { serializeSessionCookie } from "@/lib/idp/cookies";

export const POST = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await req.formData();
  const name = formData.get("name")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("password_confirm")?.toString() ?? "";
  const redirectAfterLogin = formData.get("redirect_after_login")?.toString() ?? "/";

  // Validate inputs
  if (!email || !password) {
    return new Response(
      `<script>window.location.href = "/signup?error=${encodeURIComponent("Email and password are required")}";</script>`,
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  if (password !== passwordConfirm) {
    return new Response(
      `<script>window.location.href = "/signup?error=${encodeURIComponent("Passwords don't match")}";</script>`,
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  if (password.length < 8) {
    return new Response(
      `<script>window.location.href = "/signup?error=${encodeURIComponent("Password must be at least 8 characters")}";</script>`,
      { status: 400, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  // Check if user already exists
  const db = await getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));

  if (existing.length > 0) {
    return new Response(
      `<script>window.location.href = "/signup?error=${encodeURIComponent("An account with this email already exists")}";</script>`,
      { status: 409, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  // Create the user
  const passwordHash = await hashPassword(password);
  const result = await db
    .insert(users)
    .values({ email, name, passwordHash })
    .returning({ id: users.id });

  const userId = result[0]!.id;

  // Auto-login: create session and redirect
  const issuer = getIssuer(req);
  const { token } = await createSession(userId, issuer);

  const res = new Response(null, {
    status: 303,
    headers: { location: redirectAfterLogin },
  });

  res.headers.append("Set-Cookie", serializeSessionCookie(token));
  return res;
};

export const getConfig = async () =>
  ({
    render: "dynamic",
  }) as const;
