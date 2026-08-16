/**
 * Admin REST API: Roles management
 *
 * Protected by session JWT. Requires 'configure' permission.
 * Note: Role permission assignments are managed separately through /admin/permissions
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { roles } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rbacHasRole, sessionHasPermission, PERMISSION } from "@/lib/idp/rbac";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/roles - List roles
// ---------------------------------------------------------------------------

export async function GET({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (
    !rbacHasRole(session.user.role, "admin") &&
    !sessionHasPermission(session.user.permissions, PERMISSION.CONFIGURE)
  ) {
    return jsonResponse({ error: "Forbidden - configure permission required" }, 403);
  }

  const db = await getDb();
  const roleList = await db.query.roles.findMany();

  return jsonResponse({ roles: roleList });
}

// ---------------------------------------------------------------------------
// POST /admin/roles - Create role (without permission assignment)
// ---------------------------------------------------------------------------

export async function POST({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (
    !rbacHasRole(session.user.role, "admin") &&
    !sessionHasPermission(session.user.permissions, PERMISSION.CONFIGURE)
  ) {
    return jsonResponse({ error: "Forbidden - configure permission required" }, 403);
  }

  const body = (await req.json()) as {
    name: string;
    description?: string;
    weight?: number;
  };
  const { name, description, weight } = body;

  if (!name) {
    return jsonResponse({ error: "Role name is required" }, 400);
  }

  const db = await getDb();
  const existing = await db.query.roles.findFirst({ where: eq(roles.name, name) });
  if (existing) {
    return jsonResponse({ error: "Role already exists" }, 409);
  }

  const roleId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(roles).values({
    id: roleId,
    name,
    description: description ?? null,
    weight: weight ?? 0,
    createdAt: now,
  });

  const newRole = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });

  return jsonResponse(
    {
      id: newRole?.id,
      name: newRole?.name,
      description: newRole?.description,
      weight: newRole?.weight,
      createdAt: newRole?.createdAt,
    },
    201,
  );
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
