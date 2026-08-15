/**
 * Admin REST API: Assign role to user
 *
 * Protected by session JWT. User must have 'admin' role.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { users, roles, userRoles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rbacHasRole } from "@/lib/idp/rbac";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// POST /admin/role - Assign role to user
// ---------------------------------------------------------------------------

export async function POST({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin")) {
    return jsonResponse({ error: "Forbidden - admin required" }, 403);
  }

  const body = (await req.json()) as { userId: string; role: string };
  const { userId, role } = body;

  if (!userId || !role) {
    return jsonResponse({ error: "User ID and role are required" }, 400);
  }

  const db = await getDb();

  // Verify user exists
  const userExists = await db.query.users.findFirst({ where: eq(users.id, parseInt(userId, 10)) });
  if (!userExists) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  // Verify role exists
  const roleRow = await db.query.roles.findFirst({ where: eq(roles.name, role) });
  if (!roleRow) {
    return jsonResponse({ error: "Role not found" }, 404);
  }

  // Remove existing roles and assign new
  await db.delete(userRoles).where(eq(userRoles.userId, parseInt(userId, 10)));
  await db.insert(userRoles).values({
    userId: parseInt(userId, 10),
    roleId: roleRow.id,
  });

  return jsonResponse({ success: true });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
