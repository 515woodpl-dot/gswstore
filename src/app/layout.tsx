import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import type { ReactNode } from "react";
// Note: IBM Plex fonts loaded via globals.css @import for production
// For the build environment we use system fonts as fallback
import { CartProvider } from "@/hooks/useCart";
import { StoreShell } from "@/components/StoreShell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s | ${BRAND.name}` },
  description: "Trade-grade tools and equipment. Order online, pick up in store.",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <CartProvider>
          <StoreShell>{children}</StoreShell>
        </CartProvider>
      </body>
    </html>
  );
}
