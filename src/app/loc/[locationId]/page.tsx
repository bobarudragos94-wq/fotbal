import Link from "next/link";
import { loadLocationContext } from "@/lib/locationContext";
import { getMatches } from "@/lib/queries";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, EmptyState, StatusBadge, Badge, Chevron } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

export default async function LocationHome({ params }: { params: { locationId: string } }) {
  const ctx = await loadLocationContext(params.locationId);
  const matches = await getMatches(params.locationId);
  const base = `/loc/${params.locationId}`;

  const now = Math.floor(Date.now() / 1000);
  const upcoming = matches.filter((m) => m.status !== "finished");
  const past = matches.filter((m) => m.status === "finished");

  return (
    <>
      <AppBar
        title={ctx.location.name}
        right={
          ctx.isAdmin ? (
            <Link href={`${base}/admin/new-match`} className="btn-primary btn-sm h-9 min-h-0">
              <Icon.Plus className="h-4 w-4" /> Match
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-5 px-4 py-4">
        {ctx.location.address && (
          <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Icon.Pin className="h-4 w-4" /> {ctx.location.address}
          </p>
        )}

        <section>
          <SectionTitle>Upcoming matches</SectionTitle>
          {upcoming.length === 0 ? (
            <EmptyState
              title="No matches scheduled"
              hint={ctx.isAdmin ? "Create one with the button up top." : "Check back soon — an admin will set one up."}
              icon={<Icon.Calendar className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-3">
              {upcoming.map((m) => (
                <Link key={m.id} href={`${base}/m/${m.id}`} className="card flex items-center gap-3 hover:border-brand-300 hover:shadow-md dark:hover:border-brand-700">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    <Icon.Ball className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{m.title || formatDateTime(m.startsAt)}</p>
                      <StatusBadge status={m.status} />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDateTime(m.startsAt)} · {m.numTeams}×{m.playersPerTeam}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={m.going >= m.maxPlayers ? "amber" : "green"}>{m.going}/{m.maxPlayers}</Badge>
                    <Chevron />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <SectionTitle>Past matches</SectionTitle>
            <div className="space-y-3">
              {past.slice(0, 10).map((m) => (
                <Link key={m.id} href={`${base}/m/${m.id}`} className="card flex items-center justify-between gap-3 hover:border-brand-300 dark:hover:border-brand-700">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.title || formatDateTime(m.startsAt)}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{formatDateTime(m.startsAt)}</p>
                  </div>
                  <div className="flex items-center gap-2"><StatusBadge status={m.status} /><Chevron /></div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
