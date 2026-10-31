// app/admin/(panel)/delivery/[id]/page.tsx — edit a delivery zone
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import ZoneForm from "../ZoneForm";
import { loadZones, takenByMap } from "../data";
import { canonicalState, isFallback } from "../zones";

export const metadata = { title: "Edit delivery zone · Admin · Nova Edge" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditZone({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const zones = await loadZones();
  const zone = zones.find((z) => z.id === id);
  if (!zone) notFound();

  const states = zone.states.map(canonicalState).filter((s): s is string => Boolean(s));
  return (
    <>
      <div className="ad-head">
        <div>
          <h1>Edit {zone.name}</h1>
        </div>
      </div>
      <ZoneForm
        key={zone.id}
        takenBy={takenByMap(zones, zone.id)}
        zone={{ id: zone.id, name: zone.name, fee: zone.fee, active: zone.active, states, fallback: isFallback(zone) }}
      />
    </>
  );
}
