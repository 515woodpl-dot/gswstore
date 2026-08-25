// ── Admin navigation config ───────────────────────────────────────────────────
// This is the SINGLE source of truth for admin navigation.
// Add a new item here → it appears in both the header dropdown AND the dashboard.
//
// To add a new section:
//   1. Add your page under src/app/admin/your-page/page.tsx
//   2. Add an entry in the relevant group below (or create a new group)
//   Done — it shows up automatically everywhere.

export interface NavItem {
  href: string;
  label: string;
  description: string;    // shown on dashboard card
  icon: string;           // emoji or short icon
}

export interface NavGroup {
  label: string;
  color: string;          // Tailwind ring/bg color for card accent
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Sales",
    color: "ring-emerald-200 bg-emerald-50",
    items: [
      {
        href: "/admin/walk-in",
        label: "Walk-in Sale",
        description: "Ring up an in-store customer",
        icon: "🛒",
      },
      {
        href: "/admin/manual-sale",
        label: "Past Sale",
        description: "Record a backdated offline sale",
        icon: "📝",
      },
      {
        href: "/admin/sales",
        label: "Sales Report",
        description: "Revenue, discounts, staff breakdown, CSV & QuickBooks export",
        icon: "📊",
      },
    ],
  },
  {
    label: "Inventory",
    color: "ring-sky-200 bg-sky-50",
    items: [
      {
        href: "/admin/inventory",
        label: "Products",
        description: "Manage stock, pricing, images, and categories",
        icon: "📦",
      },
      {
        href: "/admin/receiving",
        label: "Receive Stock",
        description: "Create batches and calculate true landed item costs",
        icon: "🚚",
      },
      {
        href: "/admin/orders",
        label: "Orders",
        description: "Full order history, status updates, and fulfillment",
        icon: "📋",
      },
    ],
  },
  {
    label: "Settings",
    color: "ring-violet-200 bg-violet-50",
    items: [
      {
        href: "/admin/tax-rates",
        label: "Tax Rates",
        description: "Upload WA DOR quarterly ZIP+4 rate file",
        icon: "🧾",
      },
      {
        href: "/admin/staff",
        label: "Staff",
        description: "Manage admin and staff accounts",
        icon: "👥",
      },
    ],
  },
];

// Flat list for header dropdowns (no description needed)
export type { NavGroup as AdminNavGroup };
