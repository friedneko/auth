/**
 * Dashboard — `GET /dash`
 *
 * Shows a dashboard for logged-in users with their account information.
 * If not logged in, shows a login prompt.
 */

import { getSession } from "@/lib/idp/session";
import { Link } from "waku";

export default async function DashboardPage({ headers }: { headers?: Headers }) {
  let session = null;

  // Check for an active session — same pattern as login.tsx
  if (headers) {
    const cookieHeader = headers.get("cookie") ?? "";
    // The origin in this URL is irrelevant for getSession — it only
    // reads the cookie header.
    const req = new Request("http://localhost/dash", {
      headers: { cookie: cookieHeader },
    });
    session = await getSession(req);
  }

  if (!session) {
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
        <div className="container mx-auto p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <a href="/end_session" className="text-sm text-gray-600 hover:text-gray-900 underline">
              Sign Out ({session.user.email})
            </a>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Account</h2>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium">{session.user.email}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium">{session.user.name ?? "\u2014"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Role</dt>
                <dd className="font-medium">{session.user.role ?? "user"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Permissions</dt>
                <dd className="font-medium">{session.user.permissions?.length ?? 0} assigned</dd>
              </div>
              <div>
                <dt className="text-gray-500">Session expires</dt>
                <dd className="font-medium">
                  {new Date(session.session.expiresAt).toLocaleString()}
                </dd>
              </div>
            </dl>
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
