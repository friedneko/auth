/**
 * OIDC Discovery — `GET /.well-known/openid-configuration`
 *
 * Returns the OIDC discovery document per
 * https://openid.net/specs/openid-connect-discovery-1_0.html
 */

import { buildDiscoveryDocument } from "@/lib/idp/discovery";
import type { DiscoveryDocument } from "@/lib/idp/types";

export const GET = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const issuer = `${url.protocol}//${url.host}`;
  const doc: DiscoveryDocument = buildDiscoveryDocument(issuer);
  return new Response(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const getConfig = async () => ({ render: "dynamic" }) as const;
