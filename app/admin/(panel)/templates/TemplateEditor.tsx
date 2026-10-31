// TemplateEditor.tsx — the customer designer, in template mode, for admins
"use client";

import { CartProvider } from "@/components/CartProvider";
import DesignCanvas, { type TemplateDraft } from "@/app/(store)/design/DesignCanvas";

type Props = {
  userId: string;
  draft: Omit<TemplateDraft, "save">;
  save: TemplateDraft["save"];
};

const TEE_COLORS = ["White", "Ash", "Black"];

export default function TemplateEditor({ userId, draft, save }: Props) {
  // The designer reads the cart hook even in template mode, so give it an (unused) cart.
  return (
    <CartProvider>
    <DesignCanvas
      mode="template"
      userId={userId}
      product={{ id: "template", title: "Template", image: null, mockup: true, price: 0, sizes: [], colors: TEE_COLORS, symbolDefault: true, allowUploads: true, soldOutVariants: [] }}
      initialDesign={null}
      initialSize=""
      initialColor="White"
      templateDraft={{ ...draft, save }}
    />
    </CartProvider>
  );
}
