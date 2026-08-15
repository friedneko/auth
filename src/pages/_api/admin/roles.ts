/**
 * Admin REST API: Roles management
 *
 * Protected by session JWT. User must have 'admin' role.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { roles } from "@/lib/db/schema";
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
// GET /admin/roles - List roles
// ---------------------------------------------------------------------------

export async function GET({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin")) {
    return jsonResponse({ error: "Forbidden - admin required" }, 403);
  }

  const db = await getDb();
  const roleList = await db.select().from(roles);

  return jsonResponse({ roles: roleList });
}

// ---------------------------------------------------------------------------
// POST /admin/roles - Create role
// ---------------------------------------------------------------------------

export async function POST({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin")) {
    return jsonResponse({ error: "Forbidden - admin required" }, 403);
  }

  const body = (await req.json()) as {
    name: string;
    description?: string;
    permissions?: Record<string, boolean>;
  };
  const { name, description, permissions } = body;

  if (!name) {
    return jsonResponse({ error: "Role name is required" }, 400);
  }

  const db = await getDb();
  const existing = await db.query.roles.findFirst({ where: eq(roles.name, name) });
  if (existing) {
    return jsonResponse({ error: "Role already exists" }, 409);
  }

  const roleId = crypto.randomUUID();
  await db.insert(roles).values({
    id: roleId,
    name,
    description: description ?? null,
    permissions: JSON.stringify(permissions ?? {}),
    createdAt: Math.floor(Date.now() / 1000),
  });

  const newRole = await db.query.roles.findFirst({ where: eq(roles.name, name) });

  return jsonResponse(newRole, 201);
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
