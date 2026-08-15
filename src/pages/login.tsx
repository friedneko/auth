/**
 * Login page — `GET /login`
 *
 * Renders a simple login form. The form posts to `/login/callback`.
 * The `redirect_after_login` query parameter tells the callback where to
 * send the user after a successful login (typically the authorize URL).
 */

import "@/styles.css";

export default async function LoginPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const redirectAfterLogin = params.get("redirect_after_login") ?? "/";
  const error = params.get("error");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Login — IDP</title>
      </head>
      <body className="bg-gray-50">
        <main className="flex min-h-screen items-center justify-center">
          <form
            method="POST"
            action="/login/callback"
            className="w-full max-w-sm space-y-4 rounded-lg bg-white p-8 shadow"
          >
            <h1 className="text-2xl font-bold text-center">Sign in</h1>

            {error && <p className="rounded bg-red-100 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                name="password"
                id="password"
                required
                autoComplete="current-password"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            {/* Hidden field to return to authorize after login */}
            <input type="hidden" name="redirect_after_login" value={redirectAfterLogin} />

            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 py-2 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Sign in
            </button>

            <p className="text-center text-sm text-gray-600">
              No account?{" "}
              <a href="/signup" className="text-blue-600 underline">
                Create one
              </a>
            </p>
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
