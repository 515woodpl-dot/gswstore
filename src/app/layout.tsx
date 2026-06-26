import type { Metadata } from "next";
import { CartProvider } from "@/hooks/useCart";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: { default: "GSW Tools", template: "%s | GSW Tools" },
  description: "Quality tools and equipment. Order online, pick up in store.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Porto vendor CSS from CDN */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body style={{ fontFamily: "'Poppins', sans-serif" }}>
        <CartProvider>
          <div className="body">
            <Header />
            <main>{children}</main>
            <Footer />
          </div>
        </CartProvider>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js" async />
      </body>
    </html>
  );
}
