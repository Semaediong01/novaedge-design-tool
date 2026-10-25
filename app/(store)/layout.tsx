// app/(store)/layout.tsx — storefront shell (header, footer, cart)
import { CartProvider } from "@/components/CartProvider";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      {children}
      <SiteFooter />
    </CartProvider>
  );
}
