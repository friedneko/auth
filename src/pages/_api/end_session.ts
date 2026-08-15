/**
 * End session endpoint — `GET /end_session`
 *
 * Destroys the current session and optionally redirects the user-agent to a
 * post-logout redirect URI.
 */

import { getSessionToken, clearSessionCookieOnResponse } from "@/lib/idp/cookies";
import { destroySession } from "@/lib/idp/session";

export const GET = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = getSessionToken(req);

  if (token) {
    await destroySession(token);
  }

  const postLogoutRedirect = url.searchParams.get("post_logout_redirect_uri");
  let res: Response;

  if (postLogoutRedirect) {
    try {
      const target = new URL(postLogoutRedirect);
      if (target.protocol === "https:" || target.protocol === "http:") {
        res = new Response(null, { status: 302, headers: { location: target.toString() } });
      } else {
        res = new Response("Logged out", { status: 200 });
      }
    } catch {
      res = new Response("Logged out", { status: 200 });
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
