/**
 * End session endpoint — `GET /end_session`
 *
 * Destroys the current session and optionally redirects the user-agent to a
 * post-logout redirect URI that must be registered for the logged-in client.
 */

import { getSessionToken, clearSessionCookieOnResponse } from "@/lib/idp/cookies";
import { destroySession, getSession } from "@/lib/idp/session";
import { isValidRedirect } from "@/lib/idp/db";

export const GET = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = getSessionToken(req);

  // Capture the session before destroying it, so we can validate the
  // post-logout redirect URI against the user's authorized clients.
  const session = token ? await getSession(req) : null;

  if (token) {
    await destroySession(token);
  }

  const postLogoutRedirect = url.searchParams.get("post_logout_redirect_uri");
  let res: Response;

  if (postLogoutRedirect) {
    // SECURITY: Validate the post-logout redirect URI.
    // If the user has a session, require the URI to be registered for a
    // client the user has authorized. If no session, only allow same-origin
    // redirects (relative paths or the issuer origin).
    const issuer = `${new URL(req.url).protocol}//${new URL(req.url).host}`;

    let allowed = false;
    try {
      const target = new URL(postLogoutRedirect);
      // Same-origin check
      if (target.origin === issuer) {
        allowed = true;
      }
      // Cross-origin: require client_id + redirect validation
      if (!allowed && session) {
        const clientId = url.searchParams.get("client_id");
        if (clientId) {
          allowed = await isValidRedirect(clientId, target.toString());
        }
      }
    } catch {
      // Not a valid URL — treat as relative path
      allowed = true;
    }

    if (allowed) {
      res = new Response(null, { status: 302, headers: { location: postLogoutRedirect } });
    } else {
      res = new Response("Invalid post-logout redirect URI.", { status: 400 });
    }
  } else {
    res = new Response("You have been logged out.", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return clearSessionCookieOnResponse(res);
};

export const getConfig = async () => ({ render: "dynamic" }) as const;
