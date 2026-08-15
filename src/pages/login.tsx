/**
 * Login page — `GET /login`
 *
 * Renders a login form using shadcn UI components (Card, Field, Label,
 * Input, Button, Alert). Posts to `/login/callback`.
 */

import { Card } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "waku";

export default async function LoginPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const redirectAfterLogin = params.get("redirect_after_login") ?? "/";
  const error = params.get("error");

  const errorMap: Record<string, string> = {
    invalid_credentials: "Invalid email or password.",
  };
  const errorMessage =
    error && errorMap[error] ? errorMap[error] : error ? "An error occurred." : null;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Login — IDP</title>
      </head>
      <body className="bg-gray-50">
        <main className="flex min-h-screen items-center justify-center">
          <Card className="w-full max-w-md p-8">
            <h1 className="text-2xl font-bold text-center mb-6">Sign in</h1>

            {errorMessage && (
              <Alert variant="destructive" className="mb-6 bg-red-50 border-red-200">
                <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form method="POST" action="/login/callback" className="space-y-6">
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

            <p className="mt-6 text-center text-sm text-gray-600">
              No account?{" "}
              <Link to="/signup" className="text-blue-600 underline">
                Create one
              </Link>
            </p>
          </Card>
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
