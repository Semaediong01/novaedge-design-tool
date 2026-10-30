// app/admin/(panel)/delivery/new/page.tsx
import { requireAdmin } from "@/lib/auth";
import ZoneForm from "../ZoneForm";
import { loadZones, takenByMap } from "../data";

export const metadata = { title: "New delivery zone · Admin · Nova Edge" };

export default async function NewZone() {
  await requireAdmin();
  const zones = await loadZones();
  return (
    <>
      <div className="ad-head">
        <div>
          <h1>New delivery zone</h1>
        </div>
      </div>
      <ZoneForm takenBy={takenByMap(zones)} />
    </>
  );
}
