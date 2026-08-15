import { Link } from "waku";

export default async function HomePage() {
  return (
    <div>
      <title>auth.vwinter.moe — OIDC IDP</title>
      <h1 className="text-4xl font-bold tracking-tight">Self-hosted OIDC IDP</h1>
      <p className="mt-2 text-gray-600">
        Running at <code className="bg-gray-100 px-1 py-0.5 rounded">auth.vwinter.moe</code>
      </p>

      <p className="mt-4 max-w-lg">
        A minimal OpenID Connect / OAuth 2.1 identity provider running on Cloudflare Workers + D1.
        Supports authorization code flow with PKCE, refresh tokens, and signed JWT tokens (ES256).
      </p>

      <h2 className="mt-6 text-xl font-semibold">Discovery</h2>
      <ul className="list-disc list-inside space-y-1 text-gray-600">
        <li>
          <a href="/.well-known/openid-configuration" className="text-blue-600 underline">
            /.well-known/openid-configuration
          </a>
        </li>
        <li>
          <a href="/jwks" className="text-blue-600 underline">
            /jwks
          </a>
        </li>
      </ul>

      <h2 className="mt-6 text-xl font-semibold">Endpoints</h2>
      <ul className="list-disc list-inside space-y-1 text-gray-600">
        <li>
          <code className="bg-gray-100 px-1 py-0.5 rounded">/authorize</code> — Authorization
          endpoint
        </li>
        <li>
          <code className="bg-gray-100 px-1 py-0.5 rounded">/token</code> — Token endpoint
        </li>
        <li>
          <code className="bg-gray-100 px-1 py-0.5 rounded">/userinfo</code> — UserInfo endpoint
        </li>
        <li>
          <code className="bg-gray-100 px-1 py-0.5 rounded">/jwks</code> — JWKS endpoint
        </li>
        <li>
          <code className="bg-gray-100 px-1 py-0.5 rounded">/end_session</code> — End session
        </li>
        <li>
          <a href="/login" className="text-blue-600 underline">
            /login
          </a>{" "}
          — Login
        </li>
        <li>
          <a href="/signup" className="text-blue-600 underline">
            /signup
          </a>{" "}
          — Sign up
        </li>
      </ul>

      <h2 className="mt-6 text-xl font-semibold">Quick start</h2>
      <ol className="list-decimal list-inside space-y-1 text-gray-600 text-sm">
        <li>
          Run <code className="bg-gray-100 px-1 py-0.5 rounded">pnpm preview:cloudflare</code> to
          start locally
        </li>
        <li>
          Sign up at{" "}
          <a href="/signup" className="text-blue-600 underline">
            /signup
          </a>
        </li>
        <li>
          Register a client:{" "}
          <code className="bg-gray-100 px-1 py-0.5 rounded">{`curl -X POST localhost:8787/bootstrap -H 'Content-Type: application/json' -d '{"client_id":"my-app","client_secret":"secret","redirect_uris":["http://localhost:3000/callback"]}'`}</code>
        </li>
        <li>
          Visit{" "}
          <code className="bg-gray-100 px-1 py-0.5 rounded">
            /authorize?response_type=code {"&"} client_id=my-app {"&"}{" "}
            redirect_uri=http://localhost:3000/callback {"&"} scope=openid
          </code>
        </li>
      </ol>

      <Link to="/about" className="mt-6 inline-block underline">
        About
      </Link>
    </div>
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  } as const;
};
