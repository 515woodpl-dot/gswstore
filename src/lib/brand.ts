/**
 * ─── BRAND / STORE CONFIG ────────────────────────────────────────────────────
 * Single source of truth for all store branding.
 * To white-label this app for another company:
 *   1. Set the NEXT_PUBLIC_* env vars below in the host (DigitalOcean, etc.)
 *   2. Replace the logo files in /public
 *   3. Adjust brand colors in tailwind.config.ts
 * No code changes required.
 */

export const BRAND = {
  /** Store display name — emails, titles, footer */
  name: process.env.NEXT_PUBLIC_STORE_NAME || "Stone Product Supply",

  /** Short name / abbreviation */
  shortName: process.env.NEXT_PUBLIC_STORE_SHORT_NAME || "SPS",

  /** Primary site URL (no trailing slash) */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://stoneproductsupply.com",

  /** Admin subdomain URL */
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.stoneproductsupply.com",

  /** Alerts subdomain URL */
  alertsUrl: process.env.NEXT_PUBLIC_ALERTS_URL || "https://alerts.stoneproductsupply.com",

  /** Public phone, display format */
  phone: process.env.NEXT_PUBLIC_SHOP_PHONE || "+1 253-449-6246",

  /** Phone in tel: format (digits and + only) */
  get phoneRaw() {
    return this.phone.replace(/[^+\d]/g, "");
  },

  /** Physical store address (shown in ready-for-pickup emails) */
  address: process.env.NEXT_PUBLIC_STORE_ADDRESS || "4204 Auburn Wy N Ste 8, Auburn, WA 98002",

  /** Customer-facing order email */
  orderEmail: process.env.NEXT_PUBLIC_ORDER_EMAIL || "orders@stoneproductsupply.com",
};
