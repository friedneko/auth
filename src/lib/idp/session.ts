/**
 * Session management — the "mixed DB + JWT" approach.
 *
 * A session has two parts:
 * 1. A row in the `oauth_sessions` D1 table (server-side state: revocation,
 *    expiry, user binding).
 * 2. A signed JWT in an httpOnly cookie that contains the session id (`sid`)
 *    and user id (`uid`). The JWT provides tamper-proof transport of the
 *    session id; the DB row provides server-side revocation and introspection.
 *
 * When verifying a request we:
 *   1. Check the session cookie for a JWT.
 *   2. Verify the JWT signature.
 *   3. Extract the `sid` from the JWT payload.
 *   4. Look up the `sid` in D1 to check `revoked` / `expired`.
 */

import { createId } from "@/lib/utils";
import { getSigningKey, createSessionJwt, verifySessionJwt } from "./crypto";
import { getDb } from "./env";
import { getSessionToken } from "./cookies";
import { oauthSessions, users } from "@/lib/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { SESSION_TTL } from "./constants";

/** The authenticated user info. */
export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string | null;
}

/** Full session info returned by getSession. */
export interface SessionInfo {
  session: {
    id: string;
    userId: number;
    expiresAt: Date;
    revoked: number;
  };
  user: AuthenticatedUser;
}

/**
 * Create a new session for a user and return the session JWT to store in a
 * cookie.
 */
export async function createSession(
  userId: number,
  issuer: string,
): Promise<{ token: string; sessionId: string }> {
  const db = await getDb();
  const signingKey = await getSigningKey();
  const sessionId = createId();
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);

  await db.insert(oauthSessions).values({
    id: sessionId,
    userId,
    expiresAt,
    revoked: 0,
  });

  const token = await createSessionJwt(sessionId, userId, issuer, signingKey);

  return { token, sessionId };
}

/**
 * Verify the session JWT from the request cookies, then validate the session
 * against the DB. Returns the authenticated user + session info, or null.
 */
export async function getSession(req: Request): Promise<SessionInfo | null> {
  const token = getSessionToken(req);
  if (!token) return null;

  const signingKey = await getSigningKey();
  const payload = await verifySessionJwt(token, signingKey);
  if (!payload) return null;

  const sid = payload.sid as string;
  const uid = Number(payload.uid);

  // Look up the session in DB for revocation / expiry check
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select()
    .from(oauthSessions)
    .where(
      and(
        eq(oauthSessions.id, sid),
        eq(oauthSessions.userId, uid),
        eq(oauthSessions.revoked, 0),
        gt(oauthSessions.expiresAt, now),
      ),
    );

  if (rows.length === 0) return null;
  const session = rows[0]!;

  // Load user data
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, uid));

  if (userRows.length === 0) return null;
  const userRow = userRows[0]!;

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      revoked: session.revoked,
    },
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
    },
  };
}

/**
 * Destroy a session: revoke it in D1.
 */
export async function destroySession(token: string): Promise<void> {
  const signingKey = await getSigningKey();
  const payload = await verifySessionJwt(token, signingKey);
  if (payload) {
    const db = await getDb();
    await db
      .update(oauthSessions)
      .set({ revoked: 1 })
      .where(eq(oauthSessions.id, payload.sid as string));
  }
}
