// app/admin/(panel)/affiliates/[id]/edit/page.tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Affiliate } from "@/lib/types";
import AffiliateForm from "../../AffiliateForm";

export const metadata = { title: "Edit affiliate · Admin · Nova Edge" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditAffiliate({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("affiliates").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Affiliate;

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Edit {a.name}</h1>
        </div>
      </div>
      <AffiliateForm
        key={a.id}
        affiliate={{ id: a.id, name: a.name, email: a.email ?? "", code: a.code, commission_rate: Number(a.commission_rate), active: a.active, notes: a.notes ?? "" }}
      />
    </>
  );
}
