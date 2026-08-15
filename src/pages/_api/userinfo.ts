/**
 * UserInfo endpoint — `GET /userinfo`
 *
 * Requires a Bearer access token (JWT). Returns standard claims about the
 * authenticated end-user.
 */

import { verifyJwt, getSigningKey } from "@/lib/idp/crypto";
import { getUser } from "@/lib/idp/db";
import { getIssuer } from "@/lib/idp/env";
import { OAUTH_ERROR } from "@/lib/idp/constants";

export const GET = async (req: Request): Promise<Response> => {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({
        error: OAUTH_ERROR.invalid_token,
        error_description: "Missing or invalid Authorization header",
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const token = authHeader.slice(7);
  const signingKey = await getSigningKey();

  let payload;
  try {
    payload = await verifyJwt(token, signingKey.publicKey);
  } catch {
    return new Response(
      JSON.stringify({
        error: OAUTH_ERROR.invalid_token,
        error_description: "Invalid access token",
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const issuer = getIssuer(req);
  if (payload.iss !== issuer) {
    return new Response(
      JSON.stringify({
        error: OAUTH_ERROR.invalid_token,
        error_description: "Token issuer mismatch",
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const userId = parseInt(payload.sub as string, 10);
  if (Number.isNaN(userId)) {
    return new Response(
      JSON.stringify({
        error: OAUTH_ERROR.invalid_token,
        error_description: "Invalid subject in token",
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const user = await getUser(userId);
  if (!user) {
    return new Response(
      JSON.stringify({
        error: OAUTH_ERROR.invalid_token,
        error_description: "User not found",
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const response = {
    sub: String(user.id),
    email: user.email,
    email_verified: true,
    name: user.name ?? undefined,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const getConfig = async () => ({ render: "dynamic" }) as const;
