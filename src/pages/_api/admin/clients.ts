/**
 * Admin REST API: OAuth Clients management
 *
 * Protected by session JWT. Requires 'manage_clients' permission.
 */

import { getSession } from "@/lib/idp/session";
import { getDb } from "@/lib/env";
import { oauthClients } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { hashSecret } from "@/lib/idp/crypto";
import { rbacHasRole, sessionHasPermission, PERMISSION } from "@/lib/idp/rbac";

/** Helper to return JSON response */
function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// GET /admin/clients - List OAuth clients
// ---------------------------------------------------------------------------

export async function GET({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  // Check permission: manage_clients OR admin role
  if (!rbacHasRole(session.user.role, "admin") && 
      !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_CLIENTS)) {
    return jsonResponse({ error: "Forbidden - manage_clients permission required" }, 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const db = await getDb();

  const clients = await db.query.oauthClients.findMany({
    orderBy: asc(oauthClients.name),
    limit,
    offset,
  });

  // Deserialize JSON columns
  const clientsWithParsedData = clients.map((c) => ({
    id: c.id,
    name: c.name,
    redirectUris: JSON.parse(c.redirectUris),
    grantTypes: JSON.parse(c.grantTypes),
    responseTypes: JSON.parse(c.responseTypes),
    tokenEndpointAuthMethod: c.tokenEndpointAuthMethod,
    hasSecret: c.secretHash !== null && c.secretHash !== undefined,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  return jsonResponse({
    clients: clientsWithParsedData,
    pagination: { limit, offset, total: clients.length },
  });
}

// ---------------------------------------------------------------------------
// POST /admin/clients - Create OAuth client
// ---------------------------------------------------------------------------

export async function POST({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin") && 
      !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_CLIENTS)) {
    return jsonResponse({ error: "Forbidden - manage_clients permission required" }, 403);
  }

  const body = (await req.json()) as {
    client_id: string;
    client_secret?: string;
    name: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
  };
  const {
    client_id,
    client_secret,
    name,
    redirect_uris,
    grant_types,
    response_types,
    token_endpoint_auth_method,
  } = body;

  // Validation
  if (!client_id) {
    return jsonResponse({ error: "client_id is required" }, 400);
  }

  if (!name) {
    return jsonResponse({ error: "name is required" }, 400);
  }

  if (!redirect_uris || redirect_uris.length === 0) {
    return jsonResponse({ error: "redirect_uris is required" }, 400);
  }

  // Validate redirect URIs
  for (const uri of redirect_uris) {
    if (!URL.canParse(uri)) {
      return jsonResponse({ error: `Invalid redirect_uri: ${uri}` }, 400);
    }
  }

  const db = await getDb();

  // Check if client already exists
  const existing = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, client_id),
  });
  if (existing) {
    return jsonResponse({ error: "Client already exists" }, 409);
  }

  // Hash client secret if provided
  const secretHash = client_secret ? await hashSecret(client_secret) : null;

  await db.insert(oauthClients).values({
    id: client_id,
    secretHash,
    name,
    redirectUris: JSON.stringify(redirect_uris),
    grantTypes: JSON.stringify(grant_types ?? ["authorization_code", "refresh_token"]),
    responseTypes: JSON.stringify(response_types ?? ["code"]),
    tokenEndpointAuthMethod: token_endpoint_auth_method ?? "client_secret_post",
  });

  const newClient = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, client_id),
  });

  return jsonResponse(
    {
      id: newClient?.id,
      name: newClient?.name,
      redirectUris: JSON.parse(newClient?.redirectUris ?? "[]"),
      grantTypes: JSON.parse(newClient?.grantTypes ?? "[]"),
      responseTypes: JSON.parse(newClient?.responseTypes ?? "[]"),
      tokenEndpointAuthMethod: newClient?.tokenEndpointAuthMethod,
      createdAt: newClient?.createdAt,
      updatedAt: newClient?.updatedAt,
    },
    201,
  );
}

// ---------------------------------------------------------------------------
// DELETE /admin/clients - Delete OAuth client by id
// ---------------------------------------------------------------------------

export async function DELETE({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin") && 
      !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_CLIENTS)) {
    return jsonResponse({ error: "Forbidden - manage_clients permission required" }, 403);
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("id");

  if (!clientId) {
    return jsonResponse({ error: "Client ID is required" }, 400);
  }

  const db = await getDb();

  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, clientId),
  });

  if (!client) {
    return jsonResponse({ error: "Client not found" }, 404);
  }

  await db.delete(oauthClients).where(eq(oauthClients.id, clientId));

  return jsonResponse({ success: true });
}

// ---------------------------------------------------------------------------
// PUT /admin/clients - Update OAuth client
// ---------------------------------------------------------------------------

export async function PUT({ req }: { req: Request }): Promise<Response> {
  const session = await getSession(req);
  if (!session) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!rbacHasRole(session.user.role, "admin") && 
      !sessionHasPermission(session.user.permissions, PERMISSION.MANAGE_CLIENTS)) {
    return jsonResponse({ error: "Forbidden - manage_clients permission required" }, 403);
  }

  const body = (await req.json()) as {
    id: string;
    name?: string;
    redirect_uris?: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
    client_secret?: string;
  };

  const {
    id,
    name,
    redirect_uris,
    grant_types,
    response_types,
    token_endpoint_auth_method,
    client_secret,
  } = body;

  if (!id) {
    return jsonResponse({ error: "Client ID is required" }, 400);
  }

  const db = await getDb();

  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, id),
  });

  if (!client) {
    return jsonResponse({ error: "Client not found" }, 404);
  }

  // Validate redirect URIs if provided
  if (redirect_uris && redirect_uris.length > 0) {
    for (const uri of redirect_uris) {
      if (!URL.canParse(uri)) {
        return jsonResponse({ error: `Invalid redirect_uri: ${uri}` }, 400);
      }
    }
  }

  // Hash new client secret if provided
  const secretHash = client_secret
    ? await hashSecret(client_secret)
    : client.secretHash;

  await db.update(oauthClients).set({
    name: name ?? client.name,
    redirectUris: redirect_uris ? JSON.stringify(redirect_uris) : client.redirectUris,
    grantTypes: grant_types ? JSON.stringify(grant_types) : client.grantTypes,
    responseTypes: response_types ? JSON.stringify(response_types) : client.responseTypes,
    tokenEndpointAuthMethod: token_endpoint_auth_method ?? client.tokenEndpointAuthMethod,
    secretHash,
  }).where(eq(oauthClients.id, id));

  const updatedClient = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.id, id),
  });

  return jsonResponse({
    id: updatedClient?.id,
    name: updatedClient?.name,
    redirectUris: JSON.parse(updatedClient?.redirectUris ?? "[]"),
    grantTypes: JSON.parse(updatedClient?.grantTypes ?? "[]"),
    responseTypes: JSON.parse(updatedClient?.responseTypes ?? "[]"),
    tokenEndpointAuthMethod: updatedClient?.tokenEndpointAuthMethod,
    hasSecret: updatedClient?.secretHash !== null && updatedClient?.secretHash !== "",
    createdAt: updatedClient?.createdAt,
    updatedAt: updatedClient?.updatedAt,
  });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;