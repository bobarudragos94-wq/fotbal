import { redirect } from "next/navigation";
import { requirePageUser } from "@/lib/page";
import { getLocation, getLocationMembers } from "@/lib/queries";
import {
  updateLocationAction,
  deleteLocationAction,
  setLocationAdminAction,
} from "@/app/actions/locations";
import Link from "next/link";
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
        <Link href={`/loc/${location.id}/admin`} className="flex items-center justify-between rounded-2xl bg-brand-600 p-4 text-white hover:bg-brand-700">
          <div>
            <p className="font-semibold">Deschide panoul locației</p>
            <p className="text-xs text-white/80">Gestionează jucători, meciuri, ratinguri și reguli</p>
          </div>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </Link>

        <Card>
          <div className="flex items-center justify-between">
            <SectionTitle>Cod de invitație</SectionTitle>
            <Badge tone="brand">{location.inviteCode}</Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Distribuie codul — jucătorii cu codul intră instant, fără aprobare.
          </p>
        </Card>

        <Card>
          <SectionTitle>Editează detaliile</SectionTitle>
          <ActionForm action={updateLocationAction} className="space-y-3">
            <input type="hidden" name="locationId" value={location.id} />
            <input name="name" required className="input" defaultValue={location.name} />
            <input name="address" className="input" defaultValue={location.address ?? ""} placeholder="Adresă" />
            <textarea name="description" rows={2} className="input py-2" defaultValue={location.description ?? ""} placeholder="Descriere" />
            <SubmitButton pendingText="Se salvează…">Salvează</SubmitButton>
          </ActionForm>
        </Card>

        <section>
          <SectionTitle>Membri și admini ({members.length})</SectionTitle>
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
                      className="btn-ghost btn-sm" confirm="Revoci drepturile de admin?">
                      Revocă
                    </InlineAction>
                  ) : (
                    <InlineAction action={setLocationAdminAction}
                      hidden={{ locationId: location.id, userId: m.userId, role: "admin" }}
                      className="btn-primary btn-sm">
                      Fă admin
                    </InlineAction>
                  )}
                </div>
              ))}
              {members.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">Încă niciun membru.</p>}
            </div>
          </Card>
        </section>

        <Card className="border-red-200 dark:border-red-900/60">
          <SectionTitle>Zonă periculoasă</SectionTitle>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Ștergerea unei locații elimină definitiv jucătorii, meciurile, scorurile și istoricul.
          </p>
          <ActionForm action={deleteLocationAction}>
            <input type="hidden" name="locationId" value={location.id} />
            <SubmitButton className="btn-danger w-full" pendingText="Se șterge…">Șterge locația</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
