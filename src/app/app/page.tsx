import Link from "next/link";
import { requirePageUser } from "@/lib/page";
import { getUserLocations, getUserPendingRequests, getMemberCounts } from "@/lib/queries";
import { AppBar } from "@/components/AppBar";
import { PageHeader, Card, SectionTitle, EmptyState, Badge, LinkCard } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function MyLocationsPage() {
  const user = await requirePageUser();
  const [locs, pending] = await Promise.all([
    getUserLocations(user.id),
    getUserPendingRequests(user.id),
  ]);
  const counts = await getMemberCounts(locs.map((l) => l.id));

  return (
    <>
      <AppBar title="My Locations" />
      <div className="space-y-5 px-4 py-4">
        <PageHeader title={`Hi, ${user.name.split(" ")[0]} 👋`} subtitle="Pick a pitch to see what's coming up." />

        {user.isSuperAdmin && (
          <Link href="/super" className="flex items-center gap-3 rounded-2xl bg-slate-900 p-4 text-white dark:bg-slate-800">
            <Icon.Shield className="h-6 w-6 text-accent-400" />
            <div className="flex-1">
              <p className="font-semibold">Super Admin</p>
              <p className="text-xs text-white/70">Manage all locations & admins</p>
            </div>
            <Icon.Plus className="h-5 w-5 rotate-45 text-white/40" />
          </Link>
        )}

        <section>
          <SectionTitle action={<Link href="/app/join" className="text-sm font-semibold text-brand-600 dark:text-brand-400">Join +</Link>}>
            Your pitches
          </SectionTitle>
          {locs.length === 0 ? (
            <EmptyState
              title="You're not in any location yet"
              hint="Join a pitch with an invite code to get started."
              icon={<Icon.Pin className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-3">
              {locs.map((l) => (
                <LinkCard
                  key={l.id}
                  href={`/loc/${l.id}`}
                  title={l.name}
                  subtitle={l.address ?? `${counts.get(l.id) ?? 0} players`}
                  right={
                    <div className="flex items-center gap-1.5">
                      {l.role === "admin" && <Badge tone="brand">Admin</Badge>}
                      {l.rating == null ? <Badge tone="amber">Unrated</Badge> : <Badge tone="slate">★ {l.rating}</Badge>}
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </section>

        {pending.length > 0 && (
          <section>
            <SectionTitle>Awaiting approval</SectionTitle>
            <div className="space-y-3">
              {pending.map((p) => (
                <Card key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.locationName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Your request is pending an admin's review.</p>
                  </div>
                  <Badge tone="amber">
                    <Icon.Clock className="h-3.5 w-3.5" /> Pending
                  </Badge>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
