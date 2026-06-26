import { requirePageUser } from "@/lib/page";
import { db } from "@/db";
import { locations, locationMembers, joinRequests } from "@/db/schema";
import { and, eq, notInArray } from "drizzle-orm";
import { requestJoinAction } from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { PageHeader, Card, SectionTitle, EmptyState } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";
import { Icon } from "@/components/icons";

export default async function JoinPage() {
  const user = await requirePageUser();

  const myMemberships = await db
    .select({ id: locationMembers.locationId })
    .from(locationMembers)
    .where(eq(locationMembers.userId, user.id));
  const myPending = await db
    .select({ id: joinRequests.locationId })
    .from(joinRequests)
    .where(and(eq(joinRequests.userId, user.id), eq(joinRequests.status, "pending")));

  const excluded = [...myMemberships.map((m) => m.id), ...myPending.map((m) => m.id)];
  const available = await db
    .select({ id: locations.id, name: locations.name, address: locations.address, description: locations.description })
    .from(locations)
    .where(excluded.length ? notInArray(locations.id, excluded) : undefined);

  return (
    <>
      <AppBar title="Intră într-o locație" back="/app" />
      <div className="space-y-6 px-4 py-4">
        <PageHeader title="Intră într-un teren" subtitle="Folosește un cod de invitație sau cere să intri mai jos." />

        <Card>
          <SectionTitle>Ai un cod de invitație?</SectionTitle>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Cu un cod intri instant — fără aprobare.
          </p>
          <ActionForm action={requestJoinAction} className="space-y-3">
            <input
              name="inviteCode"
              className="input uppercase tracking-widest"
              placeholder="ex. K7P2QX"
              maxLength={8}
              autoCapitalize="characters"
            />
            <SubmitButton pendingText="Se intră…">Intră cu codul</SubmitButton>
          </ActionForm>
        </Card>

        <section>
          <SectionTitle>Răsfoiește locațiile</SectionTitle>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Fără cod, cererea ta are nevoie de aprobarea adminului.
          </p>
          {available.length === 0 ? (
            <EmptyState title="Nimic de unde să intri acum" hint="Ești deja membru (sau în așteptare) la toate locațiile." icon={<Icon.Pin className="h-8 w-8" />} />
          ) : (
            <div className="space-y-3">
              {available.map((l) => (
                <Card key={l.id}>
                  <div className="mb-2">
                    <p className="font-semibold">{l.name}</p>
                    {l.address && <p className="text-sm text-slate-500 dark:text-slate-400">{l.address}</p>}
                    {l.description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{l.description}</p>}
                  </div>
                  <ActionForm action={requestJoinAction}>
                    <input type="hidden" name="locationId" value={l.id} />
                    <SubmitButton className="btn-ghost btn-sm w-full" pendingText="Se trimite…">Cere să intri</SubmitButton>
                  </ActionForm>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
