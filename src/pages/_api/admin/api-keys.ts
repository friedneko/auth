/**
 * Admin REST API: API Keys management
 *
 * API keys for programmatic access to the IDP.
 * Keys are prefixed with 'meow_' and hashed for security.
 * Protected by session JWT. Requires 'configure' permission.
 *
 * API keys can have their own permissions for fine-grained access control.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { apiKeys, users, permissions, apiKeyPermissions } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { rbacHasRole, sessionHasPermission, PERMISSION } from "@/lib/idp/rbac";
import { sha256Hex } from "@/lib/idp/crypto";

const API_KEY_PREFIX = "meow_";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Generate a new API key (UUID with meow_ prefix)
 * Returns the plain-text key (only shown once)
 */
async function generateApiKey(): Promise<{ key: string; keyHash: string }> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(randomBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const fullKey = `${API_KEY_PREFIX}${uuid}`;
  const keyHash = await sha256Hex(fullKey);
  return { key: fullKey, keyHash };
}

// ---------------------------------------------------------------------------
// GET /admin/api-keys - List API keys for a user
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

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");

  const db = await getDb();

  if (userId) {
    // Get keys for specific user
    const userExists = await db.query.users.findFirst({
      where: eq(users.id, parseInt(userId, 10)),
    });
    if (!userExists) {
      return jsonResponse({ error: "User not found" }, 404);
    }

    const keys = await db.query.apiKeys.findMany({
      where: eq(apiKeys.userId, parseInt(userId, 10)),
    });

    // For each key, get its permissions
    const keysWithPerms = await Promise.all(
      keys.map(async (key) => {
        const keyPerms = await db
          .select({
            id: permissions.id,
            name: permissions.name,
          })
          .from(apiKeyPermissions)
          .innerJoin(permissions, eq(apiKeyPermissions.permissionId, permissions.id))
          .where(eq(apiKeyPermissions.apiKeyId, key.id));

        return {
          id: key.id,
          name: key.name,
          keyPermissions: keyPerms.map((p) => ({ id: p.id, name: p.name })),
          createdAt: key.createdAt,
          updatedAt: key.updatedAt,
        };
      }),
    );

    return jsonResponse({ keys: keysWithPerms });
  }

  return jsonResponse({ error: "userId is required" }, 400);
}

// ---------------------------------------------------------------------------
// POST /admin/api-keys - Create API key with permissions
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
    userId: number;
    name?: string;
    permissionIds?: string[]; // Array of permission IDs
  };
  const { userId, name, permissionIds = [] } = body;

  if (!userId) {
    return jsonResponse({ error: "userId is required" }, 400);
  }

  const db = await getDb();

  // Verify user exists
  const userExists = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!userExists) {
    return jsonResponse({ error: "User not found" }, 404);
  }

  // Verify all permission IDs exist
  if (permissionIds.length > 0) {
    const existingPerms = await db.query.permissions.findMany({
      where: inArray(permissions.id, permissionIds),
    });
    const validIds = existingPerms.map((p) => p.id);
    if (validIds.length !== permissionIds.length) {
      return jsonResponse({ error: "Invalid permission ID provided" }, 400);
    }
  }

  // Generate new API key
  const { key, keyHash } = await generateApiKey();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(apiKeys).values({
    id: crypto.randomUUID(),
    keyHash,
    name: name ?? null,
    userId,
    createdAt: now,
    updatedAt: now,
  });

  // Get the newly created key's ID
  const newKey = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });

  // Assign permissions if any
  if (newKey && permissionIds.length > 0) {
    await db.insert(apiKeyPermissions).values(
      permissionIds.map((permId) => ({
        apiKeyId: newKey.id,
        permissionId: permId,
        createdAt: now,
      })),
    );
  }

  // Get permission names for response
  const permsById = (await db.select().from(permissions)).reduce((map, p) => {
    map.set(p.id, p.name);
    return map;
  }, new Map<string, string>());

  const permNames = permissionIds.map((id) => permsById.get(id)).filter(Boolean);

  // Return the plain-text key (only time it's shown)
  return jsonResponse(
    {
      success: true,
      key,
      keyPermissions: permNames,
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// PUT /admin/api-keys - Update API key permissions
// ---------------------------------------------------------------------------

export async function PUT({ req }: { req: Request }): Promise<Response> {
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
    id: string;
    permissionIds: string[];
  };
  const { id, permissionIds } = body;

  if (!id) {
    return jsonResponse({ error: "Key ID is required" }, 400);
  }

  const db = await getDb();

  const key = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, id),
  });

  if (!key) {
    return jsonResponse({ error: "API key not found" }, 404);
  }

  // Clear existing permissions
  await db.delete(apiKeyPermissions).where(eq(apiKeyPermissions.apiKeyId, id));

  // Add new permissions
  if (permissionIds.length > 0) {
    const now = Math.floor(Date.now() / 1000);
    await db.insert(apiKeyPermissions).values(
      permissionIds.map((permId) => ({
        apiKeyId: id,
        permissionId: permId,
        createdAt: now,
      })),
    );
  }

  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// DELETE /admin/api-keys - Delete API key
// ---------------------------------------------------------------------------

export async function DELETE({ req }: { req: Request }): Promise<Response> {
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

  const url = new URL(req.url);
  const keyId = url.searchParams.get("id");

  if (!keyId) {
    return jsonResponse({ error: "Key ID is required" }, 400);
  }

  const db = await getDb();

  const key = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, keyId),
  });

  if (!key) {
    return jsonResponse({ error: "API key not found" }, 404);
  }

  await db.delete(apiKeys).where(eq(apiKeys.id, keyId));

  return jsonResponse({ success: true });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
