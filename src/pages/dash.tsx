/**
 * Dashboard — `GET /dash`
 *
 * Shows a dashboard for logged-in users with their account information
 * and session details. Uses shadcn UI components for a consistent look.
 * If not logged in, shows a login prompt.
 *
 * Session verification is handled by the middleware in waku.server.tsx,
 * which adds a signed session id (?sid=...&sig=...) to the URL.
 * This component verifies the signature and looks up the session from the DB.
 */

import { getSessionBySid } from "@/lib/idp/session";
import { verifySignedSessionId } from "@/lib/idp/crypto";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { wakuRedirect } from "@/lib/utils";
import type { SessionInfo } from "@/lib/idp/session";

export default async function DashboardPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const sid = params.get("sid");
  const sig = params.get("sig");

  let session: SessionInfo | null = null;

  if (sid && sig) {
    // Verify the signed session id (ES256, signed by the middleware)
    const isValid = await verifySignedSessionId(sid, sig);
    if (isValid) {
      session = await getSessionBySid(sid);
    }
  }

  // No valid session — redirect to login.
  // The middleware in waku.server.tsx should have already redirected
  // unauthenticated requests, but this is a fallback for direct access
  // with a forged session id.
  if (!session) {
    wakuRedirect("/login?redirect_after_login=/dash", 303);
  }

  const { user, session: sessionInfo } = session;
  const permissions = user.permissions ?? [];
  const isAdmin = user.role === "admin";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Dashboard — IDP</title>
      </head>
      <body className="bg-gray-50 min-h-screen">
        <main className="container mx-auto p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <a
              href="/end_session"
              className={cn(buttonVariants({ variant: "ghost", className: "text-sm" }))}
            >
              Sign Out ({user.email})
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:max-w-3xl">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-2 text-sm">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium">{user.email}</dd>

                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium">{user.name ?? "—"}</dd>

                  <dt className="text-gray-500">Role</dt>
                  <dd className="font-medium">
                    {user.role ? (
                      <>
                        {user.role}
                        {isAdmin && (
                          <Badge variant="secondary" className="ml-2">
                            Admin
                          </Badge>
                        )}
                      </>
                    ) : (
                      "user"
                    )}
                  </dd>

                  <dt className="text-gray-500">Permissions</dt>
                  <dd className="font-medium">{permissions.length} assigned</dd>
                </dl>
              </CardContent>
            </Card>

            {permissions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Permissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {permissions.map((perm) => (
                      <Badge key={perm} variant="outline">
                        {perm}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Session</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-2 text-sm">
                  <dt className="text-gray-500">Session ID</dt>
                  <dd className="font-mono text-xs break-all">{sessionInfo.id}</dd>

                  <dt className="text-gray-500">Expires</dt>
                  <dd className="font-medium">
                    {new Date(sessionInfo.expiresAt).toLocaleString()}
                  </dd>

                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    <Badge variant={sessionInfo.revoked ? "destructive" : "default"}>
                      {sessionInfo.revoked ? "Revoked" : "Active"}
                    </Badge>
                  </dd>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Endpoints</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm">
                  <a href="/userinfo" className="text-blue-600 hover:underline">
                    Userinfo (OIDC)
                  </a>
                  <Separator />
                  <a
                    href="/.well-known/openid-configuration"
                    className="text-blue-600 hover:underline"
                  >
                    Discovery Document
                  </a>
                  <Separator />
                  <a href="/jwks" className="text-blue-600 hover:underline">
                    JWKS Endpoint
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {isAdmin && (
            <Card className="mt-6 lg:max-w-3xl">
              <CardHeader>
                <CardTitle>Admin</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-sm">
                  <a href="/admin/users" className="text-blue-600 hover:underline">
                    Manage Users
                  </a>
                  <Separator />
                  <a href="/admin/clients" className="text-blue-600 hover:underline">
                    Manage OAuth Clients
                  </a>
                  <Separator />
                  <a href="/admin/roles" className="text-blue-600 hover:underline">
                    Manage Roles &amp; Permissions
                  </a>
                  <Separator />
                  <a href="/admin/stats" className="text-blue-600 hover:underline">
                    System Stats
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </body>
    </html>
  );
}

export const getConfig = async () =>
  ({
    render: "dynamic",
  }) as const;
