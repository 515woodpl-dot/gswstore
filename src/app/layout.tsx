import type { Metadata } from "next";
import { CartProvider } from "@/hooks/useCart";
import PortoShell from "@/components/PortoShell";

export const metadata: Metadata = {
  title: { default: "Golden Stone Tools", template: "%s | Golden Stone Tools" },
  description: "Quality tools and equipment. Order online, pick up in store.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1.0, shrink-to-fit=no" />
        <link rel="shortcut icon" href="/img/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/img/apple-touch-icon.png" />
        <link href="https://fonts.googleapis.com/css?family=Poppins:300,400,500,600,700,800%7CShadows+Into+Light%7CPlayfair+Display:400&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/vendor/bootstrap/css/bootstrap.min.css" />
        <link rel="stylesheet" href="/vendor/fontawesome-free/css/all.min.css" />
        <link rel="stylesheet" href="/vendor/animate/animate.compat.css" />
        <link rel="stylesheet" href="/vendor/simple-line-icons/css/simple-line-icons.min.css" />
        <link rel="stylesheet" href="/vendor/owl.carousel/assets/owl.carousel.min.css" />
        <link rel="stylesheet" href="/vendor/owl.carousel/assets/owl.theme.default.min.css" />
        <link rel="stylesheet" href="/vendor/magnific-popup/magnific-popup.min.css" />
        <link rel="stylesheet" href="/vendor/bootstrap-star-rating/css/star-rating.min.css" />
        <link rel="stylesheet" href="/vendor/bootstrap-star-rating/themes/krajee-fas/theme.min.css" />
        <link rel="stylesheet" href="/css/theme.css" />
        <link rel="stylesheet" href="/css/theme-elements.css" />
        <link rel="stylesheet" href="/css/theme-blog.css" />
        <link rel="stylesheet" href="/css/theme-shop.css" />
        <link rel="stylesheet" href="/css/skins/default.css" />
        <link rel="stylesheet" href="/css/custom.css" />
      </head>
      <body data-plugin-page-transition>
        <CartProvider>
          <div className="body">
            <PortoShell>{children}</PortoShell>
          </div>
        </CartProvider>
        <script src="/vendor/plugins/js/plugins.min.js" defer />
        <script src="/vendor/bootstrap-star-rating/js/star-rating.min.js" defer />
        <script src="/vendor/bootstrap-star-rating/themes/krajee-fas/theme.min.js" defer />
        <script src="/js/theme.js" defer />
        <script src="/js/views/view.shop.js" defer />
        <script src="/js/theme.init.js" defer />
      </body>
    </html>
  );
}
