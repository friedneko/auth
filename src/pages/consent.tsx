/**
 * Consent page — `GET /consent`
 *
 * Shows the user which scopes the client is requesting and asks for
 * approval using shadcn UI components. Posts to `/consent/callback`.
 *
 * SECURITY: The middleware in waku.server.tsx verifies the session and
 * adds a signed session id (?sid=...&sig=...) to the URL. This component
 * verifies the signature before proceeding. If the signature is invalid,
 * the user is redirected to /login.
 *
 * Note: Waku v1.0.0-beta.9 does not pass the `headers` prop to page components
 * on the Cloudflare adapter, so we cannot read cookies directly. Instead,
 * we rely on the signed session id from the middleware.
 */

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSessionBySid } from "@/lib/idp/session";
import { verifySignedSessionId } from "@/lib/idp/crypto";
import { wakuRedirect } from "@/lib/utils";

export default async function ConsentPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const sid = params.get("sid");
  const sig = params.get("sig");

  // Verify the signed session id from the middleware
  let sessionUser = null;
  let sessionUserId: number | null = null;

  if (sid && sig) {
    const isValid = await verifySignedSessionId(sid, sig);
    if (isValid) {
      const session = await getSessionBySid(sid);
      if (session) {
        sessionUser = session.user;
        sessionUserId = session.user.id;
      }
    }
  }

  // Not authenticated — redirect to login
  if (!sessionUser) {
    // Build the authorize URL from the original query params (minus sid/sig)
    const authParams = new URLSearchParams();
    for (const [key, value] of params.entries()) {
      if (key !== "sid" && key !== "sig") {
        authParams.set(key, value);
      }
    }

    const loginUrl = new URL("/login");
    loginUrl.searchParams.set("redirect_after_login", `/authorize?${authParams.toString()}`);
    const state = params.get("state");
    if (state) loginUrl.searchParams.set("state", state);

    wakuRedirect(loginUrl.toString(), 303);
  }

  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const scope = params.get("scope") ?? "openid";
  const state = params.get("state");
  const nonce = params.get("nonce");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method") ?? "plain";
  const responseType = params.get("response_type") ?? "code";

  const scopes = scope.split(" ").filter(Boolean);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Consent — IDP</title>
      </head>
      <body className="bg-gray-50">
        <main className="flex min-h-screen items-center justify-center p-4">
          <div className="flex w-full max-w-lg flex-col gap-6">
            <h1 className="text-2xl font-bold text-center">Authorize application</h1>

            <Alert variant="default" className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-800">
                <strong>{clientId}</strong> is requesting access to the following scopes:
              </AlertDescription>
            </Alert>

            <ul className="list-disc list-inside space-y-2 text-gray-700">
              {scopes.map((s) => (
                <li key={s} className="text-sm">
                  {s}
                </li>
              ))}
            </ul>

            <form method="POST" action="/consent/callback" className="flex flex-col gap-6">
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="response_type" value={responseType} />
              <input type="hidden" name="user_id" value={sessionUserId ?? ""} />
              {state && <input type="hidden" name="state" value={state} />}
              {nonce && <input type="hidden" name="nonce" value={nonce} />}
              {codeChallenge && (
                <>
                  <input type="hidden" name="code_challenge" value={codeChallenge} />
                  <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
                </>
              )}

              <div className="flex gap-4">
                <Button type="submit" name="confirm" value="yes" className="flex-1">
                  Allow
                </Button>
                <Button
                  type="submit"
                  name="confirm"
                  value="deny"
                  variant="outline"
                  className="flex-1"
                >
                  Deny
                </Button>
              </div>
            </form>
          </div>
        </main>
      </body>
    </html>
  );
}

export const getConfig = async () => {
  return {
    render: "dynamic",
  } as const;
};
