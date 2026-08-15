/**
 * Root route — redirects to /login.
 *
 * Waku's fsRouter doesn't expose a server-side redirect for page components,
 * so we use a <meta http-equiv="refresh"> tag which works even when JavaScript
 * is disabled.
 */

export default function HomePage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>→ Login</title>
        <meta httpEquiv="refresh" content="0;url=/login" />
      </head>
      <body>
        <p>
          Redirecting to <a href="/login">login</a>...
        </p>
      </body>
    </html>
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  } as const;
};
