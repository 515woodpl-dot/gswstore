import Link from "next/link";

type BrandLogoProps = {
  href: string;
  className?: string;
  compact?: boolean;
};

export default function BrandLogo({ href, className = "", compact = false }: BrandLogoProps) {
  return (
    <Link href={href} className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/gst-logo-white.png"
        alt="Golden Stone Tools"
        className={compact ? "h-12 w-auto sm:h-14" : "h-14 w-auto sm:h-16"}
      />
    </Link>
  );
}
