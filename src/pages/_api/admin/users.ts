/**
 * Admin REST API: Users management
 *
 * Protected by session JWT. Requires 'manage_users' permission.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { users, roles, userRoles, oauthSessions } from "@/lib/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { hashPassword } from "@/lib/idp/crypto";
import { rbacHasRole, sessionHasPermission, PERMISSION } from "@/lib/idp/rbac";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/users - List users
// ---------------------------------------------------------------------------

export async function GET({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  // Check permission: manage_users OR admin role
  if (
    !rbacHasRole(session.user.role, "admin") &&
    !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_USERS)
  ) {
    return jsonResponse({ error: "Forbidden - manage_users permission required" }, 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const db = await getDb();

  const userList = await db.query.users.findMany({
    orderBy: asc(users.id),
    limit,
    offset,
  });

  const userIds = userList.map((u) => u.id);

  const roleMappings = await db
    .select({
      userId: userRoles.userId,
      roleName: roles.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, userIds));

  const roleMap = new Map<number, string>();
  for (const r of roleMappings) {
    roleMap.set(r.userId, r.roleName);
  }

  const usersWithRole = userList.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    role: roleMap.get(user.id) ?? "user",
  }));

  return jsonResponse({
    users: usersWithRole,
    pagination: { limit, offset, total: userList.length },
  });
}

// ---------------------------------------------------------------------------
// POST /admin/users - Create user
// ---------------------------------------------------------------------------

export async function POST({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (
    !rbacHasRole(session.user.role, "admin") &&
    !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_USERS)
  ) {
    return jsonResponse({ error: "Forbidden - manage_users permission required" }, 403);
  }

  const body = (await req.json()) as {
    email: string;
    name?: string;
    password: string;
    role?: string;
  };
  const { email, name, password, role } = body;

  if (!email || !password) {
    return jsonResponse({ error: "Email and password are required" }, 400);
  }

  if (!/^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return jsonResponse({ error: "Invalid email format" }, 400);
  }

  if (password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters" }, 400);
  }

  const db = await getDb();

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    return jsonResponse({ error: "User already exists" }, 409);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  await db.insert(users).values({
    email,
    name: name ?? null,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  // Assign role if provided
  if (role) {
    const roleRow = await db.query.roles.findFirst({ where: eq(roles.name, role) });
    if (roleRow) {
      const newUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (newUser) {
        await db.insert(userRoles).values({
          userId: newUser.id,
          roleId: roleRow.id,
        });
      }
    }
  }

  const newUser = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: { userRoles: { with: { role: true } } },
  });

  // Extract role from the nested userRoles → role relationship
  const userRole = newUser?.userRoles?.[0]?.role?.name ?? "user";

  return jsonResponse(
    {
      id: newUser?.id,
      email: newUser?.email,
      name: newUser?.name,
      role: userRole,
      createdAt: newUser?.createdAt,
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// DELETE /admin/users - Delete user by id in query
// ---------------------------------------------------------------------------

export async function DELETE({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (
    !rbacHasRole(session.user.role, "admin") &&
    !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_USERS)
  ) {
    return jsonResponse({ error: "Forbidden - manage_users permission required" }, 403);
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("id");

  if (!userId) {
    return jsonResponse({ error: "User ID is required" }, 400);
  }

  const db = await getDb();
  const userIdNum = parseInt(userId, 10);

  await db.delete(oauthSessions).where(eq(oauthSessions.userId, userIdNum));
  await db.delete(userRoles).where(eq(userRoles.userId, userIdNum));
  await db.delete(users).where(eq(users.id, userIdNum));

  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// PUT /admin/users/role - Update user role
// ---------------------------------------------------------------------------

export async function PUT({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (
    !rbacHasRole(session.user.role, "admin") &&
    !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_USERS)
  ) {
    return jsonResponse({ error: "Forbidden - manage_users permission required" }, 403);
  }

  const body = (await req.json()) as { userId: string; role: string };
  const { userId, role } = body;

  if (!userId || !role) {
    return jsonResponse({ error: "userId and role are required" }, 400);
  }

  const db = await getDb();

  const roleRow = await db.query.roles.findFirst({ where: eq(roles.name, role) });
  if (!roleRow) {
    return jsonResponse({ error: "Role not found" }, 404);
  }

  const userIdNum = parseInt(userId, 10);

  const userExists = await db.query.users.findFirst({ where: eq(users.id, userIdNum) });
  if (!userExists) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  await db.delete(userRoles).where(eq(userRoles.userId, userIdNum));
  await db.insert(userRoles).values({
    userId: userIdNum,
    roleId: roleRow.id,
  });

  return jsonResponse({ success: true });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
