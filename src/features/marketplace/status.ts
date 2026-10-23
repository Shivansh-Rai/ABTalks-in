/**
 * Marketplace on/off switch. A code switch on purpose: there is no admin
 * toggle for it yet.
 *
 *   true  → /marketplace shows the catalog and redeeming works.
 *   false → /marketplace shows the "closed" page and the redeem action
 *           refuses, so points cannot be spent from a stale tab or a script.
 *
 * The marketplace is not in the dashboard sidebar either way; it is reached
 * from in-page links (Synergy chip, workshop pages, search).
 */
export const MARKETPLACE_OPEN = false;

export function isMarketplaceOpen(): boolean {
  return MARKETPLACE_OPEN;
}
