/**
 * JWKS endpoint — `GET /jwks`
 *
 * Returns the JSON Web Key Set containing the public signing keys.
 * Clients use this to verify ID tokens and access tokens.
 */

import { getJwks } from "@/lib/idp/crypto";

export const GET = async (_req: Request): Promise<Response> => {
  const jwks = await getJwks();
  return new Response(JSON.stringify(jwks), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const getConfig = async () => ({ render: "dynamic" }) as const;
