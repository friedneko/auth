/**
 * Admin REST API: User permissions management
 * 
 * Allows granting/revoking direct permissions to users (bypassing roles).
 * Protected by session JWT. Requires 'configure' permission.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { userPermissions, permissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { rbacHasRole, sessionHasPermission, PERMISSION } from "@/lib/idp/rbac";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/user-permissions - List user's direct permissions
// ---------------------------------------------------------------------------

export async function GET({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin") && 
      !sessionHasPermission(session.user.permissions, PERMISSION.CONFIGURE)) {
    return jsonResponse({ error: "Forbidden - configure permission required" }, 403);
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  const db = await getDb();

  if (userId) {
    // Get direct permissions for a specific user
    const userPerms = await db
      .select({
        id: permissions.id,
        name: permissions.name,
        description: permissions.description,
        createdAt: permissions.createdAt,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, parseInt(userId, 10)));

    return jsonResponse({ permissions: userPerms });
  }

  // List all user-permission mappings (admin view)
  const allMappings = await db
    .select({
      userId: userPermissions.userId,
      permissionId: permissions.id,
      permissionName: permissions.name,
      description: permissions.description,
      createdAt: permissions.createdAt,
    })
    .from(userPermissions)
    .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id));

  return jsonResponse({ mappings: allMappings });
}

// ---------------------------------------------------------------------------
// POST /admin/user-permissions - Grant permission to user
// ---------------------------------------------------------------------------

export async function POST({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin") && 
      !sessionHasPermission(session.user.permissions, PERMISSION.CONFIGURE)) {
    return jsonResponse({ error: "Forbidden - configure permission required" }, 403);
  }

  const body = (await req.json()) as {
    userId: number;
    permissionId: string;
  };
  const { userId, permissionId } = body;

  if (!userId || !permissionId) {
    return jsonResponse({ error: "userId and permissionId are required" }, 400);
  }

  const db = await getDb();

  // Verify permission exists
  const perm = await db.query.permissions.findFirst({
    where: eq(permissions.id, permissionId),
  });

  if (!perm) {
    return jsonResponse({ error: "Permission not found" }, 404);
  }

  // Check if already has this permission
  const existing = await db.query.userPermissions.findFirst({
    where: and(eq(userPermissions.userId, userId), eq(userPermissions.permissionId, permissionId)),
  });

  if (existing) {
    return jsonResponse({ error: "User already has this permission" }, 409);
  }

  await db.insert(userPermissions).values({
    userId,
    permissionId,
    createdAt: Math.floor(Date.now() / 1000),
  });

  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// DELETE /admin/user-permissions - Revoke permission from user
// ---------------------------------------------------------------------------

export async function DELETE({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin") && 
      !sessionHasPermission(session.user.permissions, PERMISSION.CONFIGURE)) {
    return jsonResponse({ error: "Forbidden - configure permission required" }, 403);
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const permissionId = url.searchParams.get("permissionId");

  if (!userId || !permissionId) {
    return jsonResponse({ error: "userId and permissionId are required" }, 400);
  }

  const db = await getDb();

  await db.delete(userPermissions).where(
    and(eq(userPermissions.userId, parseInt(userId, 10)), eq(userPermissions.permissionId, permissionId))
  );

  return jsonResponse({ success: true });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;