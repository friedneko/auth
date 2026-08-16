/**
 * Dashboard — `GET /dash`
 *
 * Shows a dashboard for logged-in users to view their OAuth clients
 * and account information.
 */

import { Link } from "waku";

export default async function DashboardPage({ query }: { query: string }) {
  const error = new URLSearchParams(query).get("error");

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Dashboard — IDP</title>
      </head>
      <body className="bg-gray-50 min-h-screen">
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-4xl">
            {/* Header */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
              <p className="text-gray-600">
                Welcome to your OAuth IDP dashboard. Manage your clients and view account
                information.
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-4 p-4 bg-red-100 border border-red-400 rounded">
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Users</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">-</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Clients</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">-</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Active Sessions</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">-</p>
              </div>
            </div>

            {/* Navigation Section */}
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Authentication</h3>
                  <div className="space-y-2">
                    <Link
                      to="/login"
                      className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/signup"
                      className="block w-full text-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Sign Up
                    </Link>
                    <Link
                      to="/consent"
                      className="block w-full text-center px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Consent
                    </Link>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Admin Tools</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="p-2 bg-gray-50 rounded">
                      <span className="font-medium">API Docs:</span>{" "}
                      /api/.well-known/openid-configuration
                    </p>
                    <p className="p-2 bg-gray-50 rounded">
                      <span className="font-medium">JWKS:</span> /api/jwks
                    </p>
                    <p className="p-2 bg-gray-50 rounded">
                      <span className="font-medium">Logout:</span> /end_session
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Information</h2>
              <div className="space-y-3 text-sm text-gray-600">
                <p>
                  <span className="font-medium">IDP Type:</span> OAuth 2.1 / OpenID Connect Provider
                </p>
                <p>
                  <span className="font-medium">Token Types:</span> JWT (ES256)
                </p>
                <p>
                  <span className="font-medium">Authentication:</span> Password-based
                  (PBKDF2-SHA256)
                </p>
                <p>
                  <span className="font-medium">Session:</span> DB-backed with JWT cookie
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

export const getConfig = async () =>
  ({
    render: "dynamic",
  }) as const;
