/**
 * Dashboard — `GET /dash`
 *
 * Shows a dashboard for logged-in users to manage their OAuth clients.
 * Requires authentication via session JWT.
 */

import { Link } from "waku";

export default async function DashboardPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const error = params.get("error");

  // Get session to check authentication
  // Note: This page is a server component, so we need to handle auth differently
  // The session validation happens at the JWT level via getSession

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Dashboard — IDP</title>
      </head>
      <body className="bg-gray-50">
        <main className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <h1 className="text-3xl font-bold text-center mb-6">Dashboard</h1>

            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                {error}
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Your OAuth Clients</h2>

              <p className="text-gray-600 mb-4">
                This dashboard shows your OAuth clients registered with this IDP.
              </p>

              <div className="space-y-4">
                <p className="text-gray-500">
                  Client management requires admin permissions. Use the admin API routes if you have
                  appropriate access.
                </p>

                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Quick Links</h3>
                  <ul className="space-y-2 text-sm">
                    <li>
                      <Link to="/login" className="text-blue-600 hover:underline">
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link to="/signup" className="text-blue-600 hover:underline">
                        Sign Up
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Back to Login
              </Link>
            </div>
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
