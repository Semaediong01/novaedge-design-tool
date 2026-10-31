// app/admin/(panel)/affiliates/new/page.tsx
import { requireAdmin } from "@/lib/auth";
import AffiliateForm from "../AffiliateForm";

export const metadata = { title: "New affiliate · Admin · Nova Edge" };

export default async function NewAffiliate() {
  await requireAdmin();
  return (
    <>
      <div className="ad-head">
        <div>
          <h1>New affiliate</h1>
        </div>
      </div>
      <AffiliateForm />
    </>
  );
}
