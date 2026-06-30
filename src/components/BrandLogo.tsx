import Link from "next/link";

type BrandLogoProps = {
  href: string;
  className?: string;
  compact?: boolean;
};

export default function BrandLogo({ href, className = "", compact = false }: BrandLogoProps) {
  return (
    <Link href={href} className={`inline-flex items-center ${className}`}>
      <span className="sr-only">Golden Stone Tools</span>
      {/* Mobile: square logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/gst-logo-white.png"
        alt=""
        aria-hidden="true"
        className={
          compact
            ? "block h-[54px] w-auto sm:hidden"
            : "block h-[60px] w-auto sm:hidden"
        }
      />
      {/* Desktop: horizontal logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/gst-logo-horizontal.png"
        alt=""
        aria-hidden="true"
        className={
          compact
            ? "hidden h-[48px] w-auto sm:block"
            : "hidden h-[60px] w-auto sm:block"
        }
      />
    </Link>
  );
}
