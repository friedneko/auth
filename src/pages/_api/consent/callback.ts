/**
 * Consent callback — `POST /consent/callback`
 *
 * Processes the consent form: if approved, records the authorization and
 * redirects back to /authorize (which will issue the auth code). If denied,
 * redirects to the client's redirect_uri with an error.
 *
 * SECURITY: Requires valid session to prevent consent hijacking attacks.
 */

import { getSession } from "@/lib/idp/session";
import { recordAuthorization } from "@/lib/idp/db";

export const POST = async (req: Request): Promise<Response> => {
  // SECURITY: Verify session before processing consent
  const session = await getSession(req);
  if (!session) {
    return new Response(
      JSON.stringify({
        error: "not_authenticated",
        error_description: "Session expired or invalid",
      }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const formData = await req.formData();
  const clientId = formData.get("client_id")?.toString() ?? "";
  const redirectUri = formData.get("redirect_uri")?.toString() ?? "";
  const scope = formData.get("scope")?.toString() ?? "openid";
  const state = formData.get("state")?.toString() ?? null;
  const nonce = formData.get("nonce")?.toString() ?? null;
  const codeChallenge = formData.get("code_challenge")?.toString() ?? null;
  const codeChallengeMethod = formData.get("code_challenge_method")?.toString() ?? null;
  const responseType = formData.get("response_type")?.toString() ?? "code";
  const confirm = formData.get("confirm")?.toString();

  if (confirm === "deny") {
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set("error", "access_denied");
      url.searchParams.set("error_description", "User denied consent");
      if (state) url.searchParams.set("state", state);
      return new Response(null, { status: 303, headers: { location: url.toString() } });
    }
    return new Response("Access denied", { status: 403 });
  }

  // Record the authorization so subsequent authorize requests skip consent
  await recordAuthorization(session.user.id, clientId);

  // Redirect back to /authorize with all params — the session cookie is
  // already set from login, so authorize will issue the code directly.
  const baseUrl = new URL(req.url).origin;
  const authorizeUrl = new URL("/authorize", baseUrl);
  authorizeUrl.searchParams.set("response_type", responseType);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  if (state) authorizeUrl.searchParams.set("state", state);
  if (nonce) authorizeUrl.searchParams.set("nonce", nonce);
  if (codeChallenge) {
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", codeChallengeMethod ?? "plain");
  }

  return new Response(null, { status: 303, headers: { location: authorizeUrl.toString() } });
};

export const getConfig = async () => ({ render: "dynamic" }) as const;
