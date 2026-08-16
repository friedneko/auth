/**
 * Dashboard — `GET /dash`
 *
 * Shows a dashboard for logged-in users to view their OAuth clients
 * and account information.
 */

import { getSession } from "@/lib/idp/session";
import { Link } from "waku";

export default async function DashboardPage({
  query,
  headers,
}: {
  query: string;
  headers?: Headers;
}) {
  const params = new URLSearchParams(query);
  const error = params.get("error");

  // Check if user is logged in
  const cookieHeader = headers?.get("cookie") ?? "";
  const session = await getSession(
    new Request("https://example.com/dash", { headers: { cookie: cookieHeader } }),
  );

  if (!session) {
    // Not logged in - show login prompt
    return (
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Dashboard — IDP</title>
        </head>
        <body className="bg-gray-50 min-h-screen">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
              <p className="text-gray-600 mb-8">You need to be logged in to view this page.</p>
              <Link
                to="/login"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
              >
                Sign In
              </Link>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Dashboard — IDP</title>
      </head>
      <body className="bg-gray-50 min-h-screen">
        <div className="flex min-h-screen flex-col p-4">
          {/* Header */}
          <header className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">
                  Welcome back, {session.user.name ?? session.user.email}!
                </p>
              </div>
              <Link
                to="/end_session"
                className="bg-gray-100 text-gray-600 px-4 py-2 rounded-md hover:bg-gray-200"
              >
                Sign Out
              </Link>
            </div>
          </header>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}

          {/* User Info */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">Email:</span>
                <span className="ml-2 text-gray-900">{session.user.email}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Name:</span>
                <span className="ml-2 text-gray-900">{session.user.name ?? "Not set"}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Role:</span>
                <span className="ml-2 text-gray-900">{session.user.role ?? "None"}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">User ID:</span>
                <span className="ml-2 text-gray-900">#{session.user.id}</span>
              </div>
            </div>
          </div>

          {/* Client Management */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">OAuth Clients</h2>
            <p className="text-gray-600 mb-4">
              Manage OAuth clients and applications registered with this IDP.
            </p>
            <Link
              to="/login"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Continue to Admin Panel
            </Link>
          </div>

          {/* Quick Links */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h2>
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
              <li>
                <Link to="/consent" className="text-blue-600 hover:underline">
                  Consent
                </Link>
              </li>
            </ul>
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
