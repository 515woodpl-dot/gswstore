import Link from "next/link";
import { BRAND } from "@/lib/brand";

type BrandLogoProps = {
  href: string;
  className?: string;
  compact?: boolean;
};

// Intrinsic sizes of the source files — used to reserve exact space so the
// logo doesn't reflow/shrink after the image loads.
const SQUARE = { w: 450, h: 348, ratio: 450 / 348 };
const WIDE = { w: 1530, h: 348, ratio: 1530 / 348 };

export default function BrandLogo({ href, className = "", compact = false }: BrandLogoProps) {
  const squareH = compact ? 54 : 60;
  const wideH = compact ? 48 : 60;

  return (
    <Link href={href} className={`inline-flex items-center ${className}`}>
      <span className="sr-only">{BRAND.name}</span>

      {/* Mobile: square logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/gst-logo-white.png"
        alt=""
        aria-hidden="true"
        width={SQUARE.w}
        height={SQUARE.h}
        className="block h-[var(--sq-h)] w-[var(--sq-w)] object-contain sm:hidden"
        style={
          {
            "--sq-h": `${squareH}px`,
            "--sq-w": `${Math.round(squareH * SQUARE.ratio)}px`,
          } as React.CSSProperties
        }
      />

      {/* Desktop: horizontal logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/gst-logo-horizontal.png"
        alt=""
        aria-hidden="true"
        width={WIDE.w}
        height={WIDE.h}
        className="hidden h-[var(--wd-h)] w-[var(--wd-w)] object-contain sm:block"
        style={
          {
            "--wd-h": `${wideH}px`,
            "--wd-w": `${Math.round(wideH * WIDE.ratio)}px`,
          } as React.CSSProperties
        }
      />
    </Link>
  );
}
