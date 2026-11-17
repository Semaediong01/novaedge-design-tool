// DesignProductEditor.tsx — the designer, in product mode: put a design on the standby tee and sell it
"use client";

import { TEE_COLOR_NAMES } from "@/lib/mockups";
import { CartProvider } from "@/components/CartProvider";
import DesignCanvas, { type ProductDraft } from "@/app/(store)/design/DesignCanvas";
import type { LibraryItem } from "@/lib/library";

export default function DesignProductEditor({ userId, draft, library }: { userId: string; draft: ProductDraft; library: LibraryItem[] }) {
  // The designer reads the cart hook even here, so give it an (unused) cart.
  return (
    <CartProvider>
      <DesignCanvas
        mode="product"
        userId={userId}
        product={{ id: "design-product", title: "Product", image: null, mockup: true, base: draft.base ?? "tee", price: 0, sizes: [], colors: TEE_COLOR_NAMES, symbolDefault: false, allowUploads: true, soldOutVariants: [] }}
        initialDesign={null}
        initialSize=""
        initialColor="White"
        productDraft={draft}
        library={library}
      />
    </CartProvider>
  );
}
