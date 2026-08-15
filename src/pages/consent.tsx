/**
 * Consent page — `GET /consent`
 *
 * Shows the user which scopes the client is requesting and asks for
 * approval. The form posts to `/consent/callback`.
 */

import "@/styles.css";

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
          <form
            method="POST"
            action="/consent/callback"
            className="w-full max-w-md space-y-4 rounded-lg bg-white p-8 shadow"
          >
            <h1 className="text-2xl font-bold text-center">Authorize application</h1>

            <p className="text-center text-gray-600">
              <strong>{clientId}</strong> is requesting access to:
            </p>

            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {scopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>

            {/* Hidden fields to pass through the authorize flow */}
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

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                name="confirm"
                value="yes"
                className="flex-1 rounded-md bg-blue-600 py-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                Allow
              </button>
              <button
                type="submit"
                name="confirm"
                value="deny"
                className="flex-1 rounded-md border border-gray-300 py-2 px-4 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              >
                Deny
              </button>
            </div>
          </form>
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
