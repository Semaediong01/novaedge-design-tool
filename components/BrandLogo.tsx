// components/BrandLogo.tsx — header lockup: NE monogram + tracked wordmark
import Image from "next/image";
import Link from "next/link";

export default function BrandLogo() {
  return (
    <Link href="/" className="brand" aria-label="Nova Edge Clothing, home">
      <Image src="/brand/ne-monogram.png" alt="" width={389} height={328} preload sizes="40px" />
      <span className="brand-word" aria-hidden>
        NOVAEDGE
      </span>
    </Link>
  );
}
