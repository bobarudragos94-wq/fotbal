import { db } from "@/db";
import { locations, locationMembers } from "@/db/schema";
import { sql } from "drizzle-orm";
import { createLocationAction } from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, LinkCard, Badge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";

export default async function SuperLocations() {
  const locs = await db
    .select({
      id: locations.id,
      name: locations.name,
      address: locations.address,
      inviteCode: locations.inviteCode,
      members: sql<number>`(select count(*) from location_members lm where lm.location_id = ${locations.id})`,
    })
    .from(locations)
    .orderBy(locations.name);

  return (
    <>
      <AppBar title="Locations" />
      <div className="space-y-5 px-4 py-4">
        <Card>
          <SectionTitle>Create a location</SectionTitle>
          <ActionForm action={createLocationAction} className="space-y-3" resetOnSuccess>
            <input name="name" required className="input" placeholder="Teren Pipera" />
            <input name="address" className="input" placeholder="Address (optional)" />
            <textarea name="description" rows={2} className="input py-2" placeholder="Short description (optional)" />
            <textarea name="rules" rows={3} className="input py-2" placeholder="Initial rules (optional)" />
            <SubmitButton pendingText="Creating…">Create location</SubmitButton>
          </ActionForm>
        </Card>

        <section>
          <SectionTitle>All locations ({locs.length})</SectionTitle>
          <div className="space-y-3">
            {locs.map((l) => (
              <LinkCard
                key={l.id}
                href={`/super/locations/${l.id}`}
                title={l.name}
                subtitle={l.address ?? `${Number(l.members)} players`}
                right={<Badge tone="slate">{l.inviteCode}</Badge>}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
