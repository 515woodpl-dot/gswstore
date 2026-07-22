import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import type { ReactNode } from "react";
import { CartProvider } from "@/hooks/useCart";
import { StoreShell } from "@/components/StoreShell";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s | ${BRAND.name}` },
  description: "Trade-grade tools and equipment. Order online, pick up in store.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GSW Staff",
  },
  formatDetection: { telephone: false },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const sb = await createClient();
  const { data: cats } = await sb
    .from("categories")
    .select("id,name")
    .order("sort_order");

  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <CartProvider>
          <StoreShell categories={cats ?? []}>{children}</StoreShell>
        </CartProvider>
      </body>
    </html>
  );
}
