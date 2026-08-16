/**
 * Login page — `GET /login`
 *
 * Renders a login form using shadcn UI components. Posts to `/login/callback`.
 */

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "waku";
import { getSession } from "@/lib/idp/session";

export default async function LoginPage({ query, headers }: { query: string; headers?: Headers }) {
  const params = new URLSearchParams(query);
  const redirectAfterLogin = params.get("redirect_after_login") ?? "/dash";
  const error = params.get("error");

  const errorMap: Record<string, string> = {
    invalid_credentials: "Invalid email or password.",
  };
  const errorMessage =
    error && errorMap[error] ? errorMap[error] : error ? "An error occurred." : null;

  // If user is already logged in and no specific redirect requested,
  // send them to the dashboard
  if (headers && !params.get("redirect_after_login")) {
    const cookieHeader = headers.get("cookie") ?? "";
    const req = new Request("https://idp.local/login", {
      headers: { cookie: cookieHeader },
    });
    const session = await getSession(req);
    if (session) {
      return new Response(null, {
        status: 302,
        headers: { location: "/dash" },
      });
    }
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Login — IDP</title>
      </head>
      <body className="bg-gray-50">
        <main className="flex min-h-screen items-center justify-center p-4">
          <div className="flex w-full max-w-md flex-col gap-6">
            <h1 className="text-2xl font-bold text-center">Sign in</h1>

            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form method="POST" action="/login/callback" className="flex flex-col gap-4">
              <Field>
                <FieldLabel>Email</FieldLabel>
                <Input type="email" name="email" id="email" required autoComplete="email" />
              </Field>

              <Field>
                <FieldLabel>Password</FieldLabel>
                <Input
                  type="password"
                  name="password"
                  id="password"
                  required
                  autoComplete="current-password"
                />
              </Field>

              <input type="hidden" name="redirect_after_login" value={redirectAfterLogin} />

              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              No account?{" "}
              <Link to="/signup" className="text-blue-600 underline">
                Create one
              </Link>
            </p>
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
