import Link from "next/link";
import { requireLocationAdmin } from "@/lib/locationContext";
import { db } from "@/db";
import { joinRequests, locationMembers, matches } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { AppBar } from "@/components/AppBar";
import { PageHeader, Card, LinkCard, Badge } from "@/components/ui";
import { InlineAction } from "@/components/Form";
import { deleteLocationAction } from "@/app/actions/locations";
import { Icon } from "@/components/icons";

async function count(where: any) {
  const r = await db.select({ c: sql<number>`count(*)` }).from(where.from).where(where.where);
  return Number(r[0]?.c ?? 0);
}

export default async function AdminDashboard({ params }: { params: { locationId: string } }) {
  const ctx = await requireLocationAdmin(params.locationId);
  const base = `/loc/${params.locationId}`;
  const lid = params.locationId;

  const [pending, players, unrated, openMatches] = await Promise.all([
    count({ from: joinRequests, where: and(eq(joinRequests.locationId, lid), eq(joinRequests.status, "pending")) }),
    count({ from: locationMembers, where: eq(locationMembers.locationId, lid) }),
    count({ from: locationMembers, where: and(eq(locationMembers.locationId, lid), sql`${locationMembers.rating} is null`) }),
    count({ from: matches, where: and(eq(matches.locationId, lid), sql`${matches.status} != 'finished'`) }),
  ]);

  const stat = (label: string, value: number) => (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );

  return (
    <>
      <AppBar title="Administrare" back={base} />
      <div className="space-y-5 px-4 py-4">
        <PageHeader title={ctx.location.name} subtitle="Panou admin locație" />

        <Card>
          <div className="grid grid-cols-4 gap-2">
            {stat("Jucători", players)}
            {stat("Cereri", pending)}
            {stat("Fără rating", unrated)}
            {stat("Deschise", openMatches)}
          </div>
        </Card>

        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Cod de invitație</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Distribuie-l — jucătorii cu codul intră instant.</p>
          </div>
          <span className="rounded-xl bg-brand-50 px-3 py-2 text-lg font-bold tracking-widest text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            {ctx.location.inviteCode}
          </span>
        </Card>

        <div className="grid gap-3">
          <Link href={`${base}/admin/new-match`} className="flex items-center gap-3 rounded-2xl bg-brand-600 p-4 text-white hover:bg-brand-700">
            <Icon.Plus className="h-6 w-6" />
            <div className="flex-1"><p className="font-semibold">Creează un meci</p><p className="text-xs text-white/80">Echipe, jucători și cost</p></div>
          </Link>

          <LinkCard href={`${base}/admin/pending`} title="Cereri jucători" subtitle="Aprobă sau respinge cererile"
            right={pending > 0 ? <Badge tone="amber">{pending}</Badge> : undefined} />
          <LinkCard href={`${base}/admin/players`} title="Jucători" subtitle="Gestionează lotul și ratingurile" />
          <LinkCard href={`${base}/admin/ratings`} title="Ratinguri" subtitle="Confirmă voturile comunității"
            right={unrated > 0 ? <Badge tone="amber">{unrated}</Badge> : undefined} />
          <LinkCard href={`${base}/admin/rules`} title="Editor reguli" subtitle="Editează regulile casei" />
        </div>

        {ctx.user.isSuperAdmin && (
          <Card className="border-red-200 dark:border-red-900/60">
            <p className="text-sm font-semibold">Zonă periculoasă</p>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Șterge definitiv această locație cu toți jucătorii, meciurile, scorurile și istoricul.
            </p>
            <InlineAction
              action={deleteLocationAction}
              hidden={{ locationId: params.locationId }}
              className="btn-danger w-full"
              confirm="Ștergi această locație și TOATE datele ei? Nu se poate anula."
            >
              Șterge locația
            </InlineAction>
          </Card>
        )}
      </div>
    </>
  );
}
