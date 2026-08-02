import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Golden Stone Supply — Staff",
    short_name: "GSS Staff",
    description: "Staff portal: alerts, inventory, and walk-in sales.",
    start_url: "/staff",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#435d69",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    // Long-press the home screen icon to jump straight to a section.
    shortcuts: [
      {
        name: "Alerts",
        short_name: "Alerts",
        description: "Incoming orders and live queue",
        url: "/alerts",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Inventory",
        short_name: "Inventory",
        description: "Manage products and stock",
        url: "/admin",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Walk-in Sale",
        short_name: "Walk-in",
        description: "Ring up an in-store customer",
        url: "/admin/walk-in",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
