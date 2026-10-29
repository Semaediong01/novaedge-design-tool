// components/BrandLogo.tsx — header lockup: NE monogram + tracked wordmark (green in light mode, white in dark mode)
import Image from "next/image";
import Link from "next/link";

export default function BrandLogo() {
  return (
    <Link href="/" className="brand" aria-label="Nova Edge Clothing, home">
      <Image className="logo-light" src="/brand/ne-monogram.png" alt="" width={389} height={328} preload sizes="40px" />
      <Image className="logo-dark" src="/brand/ne-monogram-white.png" alt="" width={389} height={328} sizes="40px" />
      <span className="brand-word" aria-hidden>
        NOVAEDGE
      </span>
    </Link>
  );
}
