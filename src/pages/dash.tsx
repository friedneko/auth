/**
 * Dashboard — `GET /dash`
 *
 * Shows a dashboard for logged-in users to view their OAuth clients
 * and account information. If not logged in, shows login prompt.
 * Uses client-side session validation for simplicity.
 */

import { Link } from "waku";

export default function DashboardPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Dashboard — IDP</title>
      </head>
      <body className="bg-gray-50 min-h-screen">
        <div id="root">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
              <p className="text-gray-600 mb-8">Loading...</p>
              <Link
                to="/login"
                className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

export const getConfig = async () =>
  ({
    render: "static",
  }) as const;
