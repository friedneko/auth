/**
 * Consent page — `GET /consent`
 *
 * Shows the user which scopes the client is requesting and asks for
 * approval using shadcn UI components. Posts to `/consent/callback`.
 */

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function ConsentPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
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
        <main className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-lg space-y-6 rounded-lg bg-white p-8 shadow">
            <h1 className="text-2xl font-bold text-center">Authorize application</h1>

            <Alert variant="default" className="bg-blue-50 border-blue-200">
              <AlertDescription>
                <strong>{clientId}</strong> is requesting access to the following scopes:
              </AlertDescription>
            </Alert>

            <ul className="list-disc list-inside space-y-2 text-gray-700 pl-4">
              {scopes.map((s) => (
                <li key={s} className="text-sm">
                  {s}
                </li>
              ))}
            </ul>

            <form method="POST" action="/consent/callback" className="space-y-6">
              <input type="hidden" name="client_id" value={clientId} />
              <input type="hidden" name="redirect_uri" value={redirectUri} />
              <input type="hidden" name="scope" value={scope} />
              <input type="hidden" name="response_type" value={responseType} />
              {state && <input type="hidden" name="state" value={state} />}
              {nonce && <input type="hidden" name="nonce" value={nonce} />}
              {codeChallenge && (
                <>
                  <input type="hidden" name="code_challenge" value={codeChallenge} />
                  <input type="hidden" name="code_challenge_method" value={codeChallengeMethod} />
                </>
              )}

              <div className="flex gap-3">
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
