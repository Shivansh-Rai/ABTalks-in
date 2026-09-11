/**
 * Runtime environment helpers.
 *
 * Keyed off `NEXT_PUBLIC_APP_ENV`, NOT `NODE_ENV`. Vercel preview deployments
 * run with `NODE_ENV=production`, so using it here would let analytics load on
 * every preview URL — which TC-S-007 forbids. `NEXT_PUBLIC_APP_ENV=production`
 * is set only on the real production deploy.
 */
export function isProduction(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "production";
}
