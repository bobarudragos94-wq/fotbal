import Link from "next/link";
import { requireLocationAdmin } from "@/lib/locationContext";
import { db } from "@/db";
import { joinRequests, locationMembers, matches } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { AppBar } from "@/components/AppBar";
import { PageHeader, Card, LinkCard, Badge } from "@/components/ui";
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
      <AppBar title="Manage" back={base} />
      <div className="space-y-5 px-4 py-4">
        <PageHeader title={ctx.location.name} subtitle="Location admin dashboard" />

        <Card>
          <div className="grid grid-cols-4 gap-2">
            {stat("Players", players)}
            {stat("Pending", pending)}
            {stat("Unrated", unrated)}
            {stat("Open", openMatches)}
          </div>
        </Card>

        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Invite code</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Share it — players with the code join instantly.</p>
          </div>
          <span className="rounded-xl bg-brand-50 px-3 py-2 text-lg font-bold tracking-widest text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
            {ctx.location.inviteCode}
          </span>
        </Card>

        <div className="grid gap-3">
          <Link href={`${base}/admin/new-match`} className="flex items-center gap-3 rounded-2xl bg-brand-600 p-4 text-white hover:bg-brand-700">
            <Icon.Plus className="h-6 w-6" />
            <div className="flex-1"><p className="font-semibold">Create a match</p><p className="text-xs text-white/80">Set teams, players & cost</p></div>
          </Link>

          <LinkCard href={`${base}/admin/pending`} title="Pending players" subtitle="Approve or reject join requests"
            right={pending > 0 ? <Badge tone="amber">{pending}</Badge> : undefined} />
          <LinkCard href={`${base}/admin/players`} title="Players" subtitle="Manage squad & ratings" />
          <LinkCard href={`${base}/admin/ratings`} title="Ratings" subtitle="Confirm community votes"
            right={unrated > 0 ? <Badge tone="amber">{unrated}</Badge> : undefined} />
          <LinkCard href={`${base}/admin/rules`} title="Rules editor" subtitle="Edit the house rules" />
        </div>
      </div>
    </>
  );
}
