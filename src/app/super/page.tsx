import Link from "next/link";
import { db } from "@/db";
import { locations, locationMembers, users, joinRequests, matches } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { AppBar } from "@/components/AppBar";
import { PageHeader, Card, SectionTitle, LinkCard, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function SuperOverview() {
  const [locCount, userCount, pendingCount, locs] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(locations),
    db.select({ c: sql<number>`count(*)` }).from(users),
    db.select({ c: sql<number>`count(*)` }).from(joinRequests).where(eq(joinRequests.status, "pending")),
    db
      .select({
        id: locations.id,
        name: locations.name,
        members: sql<number>`(select count(*) from location_members lm where lm.location_id = "locations"."id")`,
        admins: sql<number>`(select count(*) from location_members lm where lm.location_id = "locations"."id" and lm.role = 'admin')`,
        openMatches: sql<number>`(select count(*) from matches mt where mt.location_id = "locations"."id" and mt.status != 'finished')`,
      })
      .from(locations)
      .orderBy(locations.name),
  ]);

  const stat = (label: string, value: number) => (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );

  return (
    <>
      <AppBar title="Super Admin" />
      <div className="space-y-5 px-4 py-4">
        <PageHeader title="Sumar" subtitle="Totul, în toate locațiile" />
        <Card>
          <div className="grid grid-cols-3 gap-2">
            {stat("Locații", Number(locs.length))}
            {stat("Utilizatori", Number(userCount[0].c))}
            {stat("Cereri", Number(pendingCount[0].c))}
          </div>
        </Card>

        <Link href="/super/locations" className="flex items-center gap-3 rounded-2xl bg-brand-600 p-4 text-white hover:bg-brand-700">
          <Icon.Plus className="h-6 w-6" />
          <div className="flex-1"><p className="font-semibold">Locație nouă</p><p className="text-xs text-white/80">Creează un teren nou, izolat</p></div>
        </Link>

        <section>
          <SectionTitle>Activitate per locație</SectionTitle>
          <div className="space-y-3">
            {locs.map((l) => (
              <LinkCard
                key={l.id}
                href={`/super/locations/${l.id}`}
                title={l.name}
                subtitle={`${Number(l.members)} jucători · ${Number(l.admins)} admin(i)`}
                right={Number(l.openMatches) > 0 ? <Badge tone="green">{Number(l.openMatches)} deschise</Badge> : undefined}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
