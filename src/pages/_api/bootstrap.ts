/**
 * Bootstrap script — register an initial OAuth client.
 *
 * Usage:
 *   curl -X POST https://auth.vwinter.moe/bootstrap \
 *     -H "Content-Type: application/json" \
 *     -d '{"client_id":"my-app","redirect_uris":["https://app.example.com/callback"]}'
 *
 * Note: This endpoint is disabled in production for security.
 * For initial setup, use: wrangler d1 execute auth_db --file=scripts/bootstrap.sql
 */

import { hashSecret } from "@/lib/idp/crypto";
import { oauthClients } from "@/lib/db/schema";
import { getDb } from "@/lib/env";

export const POST = async (req: Request): Promise<Response> => {
  // Only allow from localhost (development)
  const url = new URL(req.url);
  const hostname = url.hostname;
  if (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "[::1]") {
    return new Response(
      JSON.stringify({
        error: "not_available",
        error_description:
          "Bootstrap endpoint only available in development. Use: wrangler d1 execute auth_db --file=scripts/bootstrap.sql",
      }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    client_id: string;
    client_secret?: string;
    name?: string;
    redirect_uris: string[];
    grant_types?: string[];
    response_types?: string[];
    token_endpoint_auth_method?: string;
  } | null;

  if (!body || !body.client_id || !body.redirect_uris) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "client_id and redirect_uris are required",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const secretHash = body.client_secret ? await hashSecret(body.client_secret) : null;

  const db = await getDb();
  await db.insert(oauthClients).values({
    id: body.client_id,
    secretHash,
    name: body.name ?? body.client_id,
    redirectUris: JSON.stringify(body.redirect_uris),
    grantTypes: JSON.stringify(body.grant_types ?? ["authorization_code", "refresh_token"]),
    responseTypes: JSON.stringify(body.response_types ?? ["code"]),
    tokenEndpointAuthMethod: body.token_endpoint_auth_method ?? "client_secret_post",
  });

  return new Response(
    JSON.stringify({
      ok: true,
      client_id: body.client_id,
      token_endpoint_auth_method: body.token_endpoint_auth_method ?? "client_secret_post",
    }),
    { status: 201, headers: { "content-type": "application/json" } },
  );
};

export const getConfig = async () =>
  ({
    render: "dynamic",
  }) as const;
