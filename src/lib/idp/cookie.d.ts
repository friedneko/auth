declare module "cookie" {
  export interface CookieSerializeOptions {
    /**
     * Name of the cookie.
     */
    name?: string;
    /**
     * The maximum age of the cookie in seconds.
     */
    maxAge?: number;
    /**
     * The expiration date of the cookie.
     */
    expires?: Date;
    /**
     * The path of the cookie.
     */
    path?: string;
    /**
     * The domain of the cookie.
     */
    domain?: string;
    /**
     * Whether the cookie is secure.
     */
    secure?: boolean;
    /**
     * Whether the cookie is http only.
     */
    httpOnly?: boolean;
    /**
     * The same site setting of the cookie.
     */
    sameSite?: "strict" | "lax" | "none";
  }

  export function parse(header: string | undefined): Record<string, string>;
  export function serialize(name: string, value: string, options?: CookieSerializeOptions): string;
}
