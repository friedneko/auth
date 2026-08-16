/**
 * Admin REST API: Permissions management
 *
 * Protected by session JWT. Requires 'configure' permission.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { permissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rbacHasRole, sessionHasPermission, PERMISSION } from "@/lib/idp/rbac";
import * as crypto from "crypto";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/permissions - List permissions
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

  const db = await getDb();
  const permList = await db.select().from(permissions);

  return jsonResponse({ permissions: permList });
}

// ---------------------------------------------------------------------------
// POST /admin/permissions - Create permission
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
    id?: string;
    name: string;
    description?: string;
  };
  const { id, name, description } = body;

  if (!name) {
    return jsonResponse({ error: "Permission name is required" }, 400);
  }

  const db = await getDb();
  
  // Generate ID from name if not provided
  const permId = id ?? crypto.randomUUID();
  
  // Check if permission already exists
  const existing = await db.query.permissions.findFirst({ where: eq(permissions.id, permId) });
  if (existing) {
    return jsonResponse({ error: "Permission already exists" }, 409);
  }

  const now = Math.floor(Date.now() / 1000);
  
  await db.insert(permissions).values({
    id: permId,
    name,
    description: description ?? null,
    createdAt: now,
  });

  const newPerm = await db.query.permissions.findFirst({ where: eq(permissions.id, permId) });

  return jsonResponse({
    id: newPerm?.id,
    name: newPerm?.name,
    description: newPerm?.description,
    createdAt: newPerm?.createdAt,
  }, 201);
}

// ---------------------------------------------------------------------------
// DELETE /admin/permissions - Delete permission
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
  const permId = url.searchParams.get("id");

  if (!permId) {
    return jsonResponse({ error: "Permission ID is required" }, 400);
  }

  const db = await getDb();

  const perm = await db.query.permissions.findFirst({
    where: eq(permissions.id, permId),
  });

  if (!perm) {
    return jsonResponse({ error: "Permission not found" }, 404);
  }

  await db.delete(permissions).where(eq(permissions.id, permId));

  return jsonResponse({ success: true });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;