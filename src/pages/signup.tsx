/**
 * Signup page — `GET /signup`
 *
 * Renders a signup form using shadcn UI components. Posts to `/signup/callback`.
 */

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "waku";

export default async function SignupPage({ query }: { query: string }) {
  const params = new URLSearchParams(query);
  const error = params.get("error");

  const errorMap: Record<string, string> = {
    invalid_input: "Please fill in all required fields.",
    password_mismatch: "Passwords do not match.",
    weak_password: "Password must be at least 8 characters.",
    email_exists: "An account with this email already exists.",
  };
  const errorMessage =
    error && errorMap[error] ? errorMap[error] : error ? "An error occurred." : null;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Sign up — IDP</title>
      </head>
      <body className="bg-gray-50">
        <main className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow">
            <h1 className="text-2xl font-bold text-center">Create account</h1>

            {errorMessage && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertDescription className="text-red-800">{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form method="POST" action="/signup/callback" className="space-y-6">
              <Field>
                <FieldLabel>Name</FieldLabel>
                <Input type="text" name="name" id="name" required autoComplete="name" />
              </Field>

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
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Field>
                <FieldLabel>Confirm Password</FieldLabel>
                <Input
                  type="password"
                  name="password_confirm"
                  id="password_confirm"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>

              <Button type="submit" className="w-full">
                Create account
              </Button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-600 underline">
                Sign in
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
