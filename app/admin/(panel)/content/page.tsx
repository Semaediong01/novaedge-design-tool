// app/admin/(panel)/content/page.tsx — edit the wording of the store
import { requireAdmin } from "@/lib/auth";
import { getSiteContent } from "@/lib/store-data";
import ConfirmButton from "../products/ConfirmButton";
import ContentForm from "./ContentForm";
import { resetContent } from "./actions";

export const metadata = { title: "Store wording · Admin · Nova Edge" };

export default async function AdminContent({ searchParams }: { searchParams: Promise<{ saved?: string; reset?: string; error?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const content = await getSiteContent();

  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Store wording</h1>
          <p>The announcement bar, the home page hero, the footer and your contact details.</p>
        </div>
      </div>

      {sp.saved && <p className="ad-flash">Saved. The store is updated.</p>}
      {sp.reset && <p className="ad-flash">Wording reset to the defaults.</p>}
      {sp.error && <p className="ad-flash err" role="alert">{sp.error}</p>}

      <ContentForm key={JSON.stringify(content)} content={content} />

      <form action={resetContent} className="danger-zone">
        <p className="muted">Reset puts every line back to the original Nova Edge wording.</p>
        <ConfirmButton message="Reset all store wording to the defaults?" className="btn btn-danger btn-sm">Reset to defaults</ConfirmButton>
      </form>
    </>
  );
}
