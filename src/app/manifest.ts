import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Golden Stone Supply — Staff",
    short_name: "GSW Staff",
    description: "Admin and alerts panel for Golden Stone Supply staff.",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#1e3a5f",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcuts: [
      {
        name: "Alerts",
        short_name: "Alerts",
        description: "View incoming orders and alerts",
        url: "/alerts",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Inventory",
        short_name: "Inventory",
        description: "Manage product inventory",
        url: "/admin",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
      {
        name: "Walk-in",
        short_name: "Walk-in",
        description: "Process walk-in sales",
        url: "/admin/walk-in",
        icons: [{ src: "/icon-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
