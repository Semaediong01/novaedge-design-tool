// app/admin/(panel)/products/from-design/page.tsx — create a product by putting a design on the standby tee
import { requireAdmin } from "@/lib/auth";
import { getLibrary } from "@/lib/library";
import { saveDesignedProduct } from "../design-actions";
import DesignProductEditor from "../DesignProductEditor";

export const metadata = { title: "Create product · Admin · Nova Edge" };

export default async function CreateFromDesign({ searchParams }: { searchParams: Promise<{ base?: string }> }) {
  const user = await requireAdmin();
  const { base } = await searchParams;
  const library = await getLibrary();
  return (
    <DesignProductEditor
      userId={user.id}
      library={library}
      draft={{ id: null, base: base === "cap" ? "cap" : "tee", title: "", description: "", price: 0, colors: ["White", "Black", "Ash"], customizable: false, elements: [], save: saveDesignedProduct }}
    />
  );
}
