import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

/**
 * Host-only cookies split www.abtalks.in and abtalks.in, so a Google callback
 * that lands on the other host cannot decrypt (or even see) the PKCE cookie.
 * Preview / localhost keep host-only cookies.
 */
function oauthCookieDomain(): string | undefined {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  if (!raw) return undefined;
  try {
    const host = new URL(raw).hostname;
    if (host === "abtalks.in" || host === "www.abtalks.in") return ".abtalks.in";
  } catch {
    return undefined;
  }
  return undefined;
}

const cookieDomain = oauthCookieDomain();

function oauthCheckCookie(name: string) {
  return {
    name: `${cookiePrefix}${name}`,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: useSecureCookies,
      maxAge: 60 * 15,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  };
}

/**
 * Current + pre-v2 Auth.js OAuth-check cookie names. Middleware expires these
 * on /login so a leftover verifier from a previous Google attempt cannot 500
 * the next sign-in. Keep in sync with `cookies` below.
 */
export const OAUTH_CHECK_COOKIE_NAMES = [
  "authjs.pkce.code_verifier",
  "__Secure-authjs.pkce.code_verifier",
  "authjs.pkce.code_verifier.v2",
  "__Secure-authjs.pkce.code_verifier.v2",
  "authjs.state",
  "__Secure-authjs.state",
  "authjs.state.v2",
  "__Secure-authjs.state.v2",
  "authjs.nonce",
  "__Secure-authjs.nonce",
  "authjs.nonce.v2",
  "__Secure-authjs.nonce.v2",
] as const;

export default {
  // Explicit so Edge middleware (middleware.ts) always receives the secret.
  // Auth.js also reads AUTH_SECRET from env; this is the belt-and-suspenders fix
  // when process.env is sparse under Turbopack/edge bundling.
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
    // InvalidCheck (stale/missing PKCE) otherwise 500s /api/auth/error with
    // ?error=Configuration. Send the user back to sign-in instead.
    error: "/login",
  },
  providers: [
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            authorization: {
              params: { prompt: "select_account" },
            },
          }),
        ]
      : []),
    // Recruiter email OTP. Edge-safe stub, exactly like the dev provider below:
    // middleware imports this file, so the real authorize — which needs Prisma —
    // lives in auth.ts. Registering it here is what makes the id routable.
    Credentials({
      id: "recruiter-otp",
      name: "Recruiter email code",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      authorize: async () => null,
    }),
    ...(process.env.ENABLE_DEV_AUTH === "true"
      ? [
          Credentials({
            id: "dev-credentials",
            name: "Dev Login",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            // authorize runs only in node context (not edge),
            // but we leave it empty here — full version in auth.ts
            authorize: async () => null,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as { role?: string }).role ?? "STUDENT";
      }
      if (token.email) {
        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        token.isAdmin = adminEmails.includes(String(token.email).toLowerCase());
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { isAdmin?: boolean }).isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  // v2 name ignores stale JWTs encrypted with a previous secret
  // ("no matching decryption secret" on /login and /register).
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token.v2"
          : "authjs.session-token.v2",
    },
    pkceCodeVerifier: oauthCheckCookie("authjs.pkce.code_verifier.v2"),
    state: oauthCheckCookie("authjs.state.v2"),
    nonce: oauthCheckCookie("authjs.nonce.v2"),
  },
} satisfies NextAuthConfig;
