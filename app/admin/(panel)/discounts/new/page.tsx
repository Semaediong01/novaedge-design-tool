// app/admin/(panel)/discounts/new/page.tsx
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DiscountForm from "../DiscountForm";

export const metadata = { title: "New discount code · Admin · Nova Edge" };

export default async function NewDiscount() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("id, title, active").order("title");

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>New discount code</h1>
        </div>
      </div>
      <DiscountForm products={(data ?? []) as { id: string; title: string; active: boolean }[]} />
    </>
  );
}
