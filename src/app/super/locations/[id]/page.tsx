import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/page";
import { getLocation, getLocationMembers } from "@/lib/queries";
import {
  updateLocationAction,
  deleteLocationAction,
  setLocationAdminAction,
} from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, Avatar, Badge, RatingDot } from "@/components/ui";
import { ActionForm, SubmitButton, InlineAction } from "@/components/Form";

export default async function SuperLocationDetail({ params }: { params: { id: string } }) {
  const user = await requirePageUser();
  if (!user.isSuperAdmin) redirect("/app");
  const location = await getLocation(params.id);
  if (!location) redirect("/super/locations");
  const members = await getLocationMembers(params.id);

  return (
    <>
      <AppBar title={location.name} back="/super/locations" />
      <div className="space-y-5 px-4 py-4">
        <Card>
          <div className="flex items-center justify-between">
            <SectionTitle>Invite code</SectionTitle>
            <Badge tone="brand">{location.inviteCode}</Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Share this code so players can request to join this location.
          </p>
        </Card>

        <Card>
          <SectionTitle>Edit details</SectionTitle>
          <ActionForm action={updateLocationAction} className="space-y-3">
            <input type="hidden" name="locationId" value={location.id} />
            <input name="name" required className="input" defaultValue={location.name} />
            <input name="address" className="input" defaultValue={location.address ?? ""} placeholder="Address" />
            <textarea name="description" rows={2} className="input py-2" defaultValue={location.description ?? ""} placeholder="Description" />
            <SubmitButton pendingText="Saving…">Save</SubmitButton>
          </ActionForm>
        </Card>

        <section>
          <SectionTitle>Members & admins ({members.length})</SectionTitle>
          <Card className="p-0">
            <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.name} url={m.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      {m.role === "admin" && <Badge tone="brand">Admin</Badge>}
                      <RatingDot rating={m.rating} />
                    </div>
                  </div>
                  {m.role === "admin" ? (
                    <InlineAction action={setLocationAdminAction}
                      hidden={{ locationId: location.id, userId: m.userId, role: "player" }}
                      className="btn-ghost btn-sm" confirm="Revoke admin rights?">
                      Revoke
                    </InlineAction>
                  ) : (
                    <InlineAction action={setLocationAdminAction}
                      hidden={{ locationId: location.id, userId: m.userId, role: "admin" }}
                      className="btn-primary btn-sm">
                      Make admin
                    </InlineAction>
                  )}
                </div>
              ))}
              {members.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No members yet.</p>}
            </div>
          </Card>
        </section>

        <Card className="border-red-200 dark:border-red-900/60">
          <SectionTitle>Danger zone</SectionTitle>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Deleting a location permanently removes its players, matches, scores and history.
          </p>
          <ActionForm action={deleteLocationAction}>
            <input type="hidden" name="locationId" value={location.id} />
            <SubmitButton className="btn-danger w-full" pendingText="Deleting…">Delete location</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
