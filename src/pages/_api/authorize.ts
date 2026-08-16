/**
 * Authorization endpoint — `GET /authorize`
 *
 * Validates the OIDC authorization request, checks the session, and either
 * redirects to /login, /consent, or issues an authorization code.
 */

import { sha256Hex, base64UrlEncode } from "@/lib/idp/crypto";
import {
  saveAuthorizationCode,
  hasAuthorizedClient,
  recordAuthorization,
  getClient,
} from "@/lib/idp/db";
import { getSession } from "@/lib/idp/session";
import { AUTH_CODE_TTL, OAUTH_ERROR } from "@/lib/idp/constants";
import type { AuthorizationRequest } from "@/lib/idp/types";

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

function parseAuthorizeRequest(url: URL): AuthorizationRequest & {
  error?: string;
  errorDescription?: string;
} {
  const sp = url.searchParams;
  const responseType = sp.get("response_type");
  const clientId = sp.get("client_id");
  const redirectUri = sp.get("redirect_uri");
  const scope = sp.get("scope") ?? "";
  const state = sp.get("state");
  const nonce = sp.get("nonce");
  const codeChallenge = sp.get("code_challenge");
  const codeChallengeMethod = sp.get("code_challenge_method");

  if (!responseType) {
    return {
      response_type: "",
      client_id: "",
      redirect_uri: "",
      scope,
      state,
      nonce,
      code_challenge: null,
      code_challenge_method: null,
      error: OAUTH_ERROR.invalid_request,
      errorDescription: "missing response_type",
    };
  }
  if (!clientId) {
    return {
      response_type: responseType,
      client_id: "",
      redirect_uri: "",
      scope,
      state,
      nonce,
      code_challenge: null,
      code_challenge_method: null,
      error: OAUTH_ERROR.invalid_request,
      errorDescription: "missing client_id",
    };
  }
  return {
    response_type: responseType,
    client_id: clientId,
    redirect_uri: redirectUri ?? "",
    scope,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidateResult {
  ok: boolean;
  error: string;
  errorDescription: string;
  redirectUri?: string;
  scopes?: string[];
  nonce?: string | null;
}

async function validateAuthorizeRequest(req: AuthorizationRequest): Promise<ValidateResult> {
  if (req.response_type !== "code") {
    return {
      ok: false,
      error: OAUTH_ERROR.unsupported_response_type,
      errorDescription: "Only 'code' response_type is supported",
    };
  }

  const client = await getClient(req.client_id);
  if (!client) {
    return {
      ok: false,
      error: OAUTH_ERROR.unauthorized_client,
      errorDescription: "Unknown client_id",
    };
  }

  if (!req.redirect_uri) {
    return {
      ok: false,
      error: OAUTH_ERROR.invalid_request,
      errorDescription: "redirect_uri is required",
    };
  }
  if (!client.redirectUris.includes(req.redirect_uri)) {
    return {
      ok: false,
      error: OAUTH_ERROR.invalid_request,
      errorDescription: "redirect_uri does not match registered URI",
    };
  }

  try {
    const u = new URL(req.redirect_uri);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return {
        ok: false,
        error: OAUTH_ERROR.invalid_request,
        errorDescription: "redirect_uri must be http or https",
      };
    }
  } catch {
    return {
      ok: false,
      error: OAUTH_ERROR.invalid_request,
      errorDescription: "invalid redirect_uri",
    };
  }

  const scopes = req.scope ? req.scope.split(" ").filter(Boolean) : [];
  return {
    ok: true,
    error: "",
    errorDescription: "",
    redirectUri: req.redirect_uri,
    scopes,
    nonce: req.nonce,
  };
}

function redirectToClientWithError(
  redirectUri: string,
  error: string,
  description: string,
  state?: string | null,
): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { location: url.toString() } });
}

// ---------------------------------------------------------------------------
// GET /authorize
// ---------------------------------------------------------------------------

export const GET = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const parsed = parseAuthorizeRequest(url);

  if (parsed.error) {
    return new Response(
      JSON.stringify({ error: parsed.error, error_description: parsed.errorDescription }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const validation = await validateAuthorizeRequest(parsed);
  if (!validation.ok) {
    if (validation.redirectUri) {
      return redirectToClientWithError(
        validation.redirectUri,
        validation.error,
        validation.errorDescription,
        parsed.state,
      );
    }
    return new Response(
      JSON.stringify({ error: validation.error, error_description: validation.errorDescription }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  // Check session
  const sessionInfo = await getSession(req);
  if (!sessionInfo) {
    const loginUrl = new URL("/login", url);
    loginUrl.searchParams.set("redirect_after_login", url.toString());
    return new Response(null, { status: 302, headers: { location: loginUrl.toString() } });
  }

  // Check existing consent
  const authorized = await hasAuthorizedClient(sessionInfo.user.id, parsed.client_id);
  if (!authorized) {
    const consentUrl = new URL("/consent", url);
    consentUrl.searchParams.set("client_id", parsed.client_id);
    consentUrl.searchParams.set("redirect_uri", validation.redirectUri!);
    consentUrl.searchParams.set("response_type", parsed.response_type);
    consentUrl.searchParams.set("scope", validation.scopes!.join(" "));
    if (parsed.state) consentUrl.searchParams.set("state", parsed.state);
    if (parsed.nonce) consentUrl.searchParams.set("nonce", parsed.nonce);
    if (parsed.code_challenge) {
      consentUrl.searchParams.set("code_challenge", parsed.code_challenge);
      consentUrl.searchParams.set("code_challenge_method", parsed.code_challenge_method ?? "plain");
    }
    return new Response(null, { status: 302, headers: { location: consentUrl.toString() } });
  }

  // Already authorized — issue code
  return issueAuthorizationCode(
    parsed,
    sessionInfo.user.id,
    validation.redirectUri!,
    validation.scopes!,
  );
};

// ---------------------------------------------------------------------------
// Issue authorization code
// ---------------------------------------------------------------------------

async function issueAuthorizationCode(
  parsed: AuthorizationRequest,
  userId: number,
  redirectUri: string,
  scopes: string[],
): Promise<Response> {
  const code = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const codeHash = await sha256Hex(code);
  const expiresAt = new Date(Date.now() + AUTH_CODE_TTL * 1000);

  await saveAuthorizationCode({
    code,
    codeHash,
    clientId: parsed.client_id,
    userId,
    redirectUri,
    codeChallenge: parsed.code_challenge,
    codeChallengeMethod: parsed.code_challenge_method,
    scopes,
    nonce: parsed.nonce,
    expiresAt,
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (parsed.state) redirectUrl.searchParams.set("state", parsed.state);

  await recordAuthorization(userId, parsed.client_id);

  return new Response(null, { status: 302, headers: { location: redirectUrl.toString() } });
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
