/**
 * Session management — the "mixed DB + JWT" approach.
 *
 * A session has two parts:
 * 1. A row in the `oauth_sessions` D1 table (server-side state: revocation,
 *    expiry, user binding).
 * 2. A signed JWT in an httpOnly cookie that contains only the session id (`sid`)
 *    and user id (`uid`). Role is fetched from DB on each request for security.
 *    The JWT provides tamper-proof transport; the DB row provides server-side
 *    revocation and introspection.
 *
 * When verifying a request we:
 *   1. Check the session cookie for a JWT.
 *   2. Verify the JWT signature.
 *   3. Extract the `sid` from the JWT payload.
 *   4. Look up the `sid` in D1 to check `revoked` / `expired`.
 *   5. Fetch user's role and ALL permissions from DB (role-based + direct).
 */

import { createId } from "@/lib/utils";
import { getSigningKey, createSessionJwt, verifySessionJwt } from "./crypto";
import { getDb } from "../env";
import { getSessionToken } from "./cookies";
import {
  oauthSessions,
  users,
  userRoles,
  roles,
  permissions,
  rolePermissions,
  userPermissions,
} from "@/lib/db/schema";
import { and, eq, gt, desc } from "drizzle-orm";
import { SESSION_TTL } from "./constants";

/** User role info with weight for hierarchy comparisons. */
export interface UserRoleInfo {
  name: string;
  weight: number;
}

/** The authenticated user info. */
export interface AuthenticatedUser {
  id: number;
  email: string;
  name: string | null;
  role?: string | undefined;
  roleWeight?: number | undefined;
  permissions?: string[] | undefined;
}

/** Full session info returned by getSession. */
export interface SessionInfo {
  session: {
    id: string;
    userId: number;
    expiresAt: Date;
    revoked: number;
    role?: string | undefined;
    roleWeight?: number | undefined;
    permissions?: string[] | undefined;
  };
  user: AuthenticatedUser;
}

/**
 * Get the user's primary role (highest weight assigned role).
 * Returns the role name, weight, and role-based permission IDs.
 * Admin automatically gets all permissions.
 */
async function getUserPrimaryRole(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
): Promise<{ name: string | undefined; weight: number; permissionIds: string[] } | undefined> {
  // Get user's roles with weights
  const userRoleRows = await db
    .select({
      name: roles.name,
      weight: roles.weight,
      id: roles.id,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .orderBy(desc(roles.weight))
    .limit(1);

  if (!userRoleRows[0]) return undefined;

  const roleRow = userRoleRows[0];

  // Admin role gets all permissions via wildcard check
  if (roleRow.name === "admin") {
    const allPerms = await db.select({ id: permissions.id }).from(permissions);
    return {
      name: roleRow.name,
      weight: roleRow.weight,
      permissionIds: allPerms.map((p) => p.id),
    };
  }

  // Get permissions for this role
  const permRows = await db
    .select({ permId: permissions.id })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .innerJoin(roles, eq(rolePermissions.roleId, roles.id))
    .where(eq(roles.id, roleRow.id));

  return {
    name: roleRow.name,
    weight: roleRow.weight,
    permissionIds: permRows.map((p) => p.permId),
  };
}

/**
 * Get all direct user permissions (not role-based).
 */
async function getUserDirectPermissions(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
): Promise<string[]> {
  const directPerms = await db
    .select({ permId: permissions.id })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
    .where(eq(userPermissions.userId, userId));

  return directPerms.map((p) => p.permId);
}

/**
 * Get all permissions for a user (role-based + direct).
 */
async function getAllUserPermissions(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: number,
): Promise<{ roleInfo: { name: string; weight: number } | undefined; allPermissions: string[] }> {
  const roleInfo = await getUserPrimaryRole(db, userId);
  const directPerms = await getUserDirectPermissions(db, userId);

  // Combine role-based and direct permissions (union)
  const allPermsSet = new Set<string>();
  if (roleInfo?.permissionIds) {
    roleInfo.permissionIds.forEach((p) => allPermsSet.add(p));
  }
  directPerms.forEach((p) => allPermsSet.add(p));

  return {
    roleInfo:
      roleInfo && roleInfo.name ? { name: roleInfo.name, weight: roleInfo.weight } : undefined,
    allPermissions: Array.from(allPermsSet),
  };
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
 * Loads role and ALL permissions (role-based + direct) from DB.
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

  // Get all user permissions (role-based + direct)
  const { roleInfo, allPermissions } = await getAllUserPermissions(db, uid);

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
      revoked: session.revoked,
      role: roleInfo?.name,
      roleWeight: roleInfo?.weight,
      permissions: allPermissions,
    },
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      role: roleInfo?.name,
      roleWeight: roleInfo?.weight,
      permissions: allPermissions,
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
