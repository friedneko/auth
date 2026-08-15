/**
 * Admin REST API: Statistics and health checks
 *
 * Protected by session JWT. User must have 'admin' role.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { users, roles, oauthSessions, oauthGrants, oauthClients } from "@/lib/db/schema";
import { rbacHasRole } from "@/lib/idp/rbac";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/stats - Get admin statistics
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

  const [usersCount, rolesCount, sessionsCount, grantsCount, clientsCount] = await Promise.all([
    db.$count(users),
    db.$count(roles),
    db.$count(oauthSessions),
    db.$count(oauthGrants),
    db.$count(oauthClients),
  ]);

  return jsonResponse({
    stats: {
      users: usersCount,
      roles: rolesCount,
      activeSessions: sessionsCount,
      totalGrants: grantsCount,
      clients: clientsCount,
    },
  });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
