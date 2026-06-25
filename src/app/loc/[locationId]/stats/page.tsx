import { loadLocationContext } from "@/lib/locationContext";
import { getPlayerStats, getLocationMembers } from "@/lib/queries";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, Avatar, RatingDot } from "@/components/ui";

export default async function StatsPage({ params }: { params: { locationId: string } }) {
  const ctx = await loadLocationContext(params.locationId);
  const [stats, members] = await Promise.all([
    getPlayerStats(params.locationId, ctx.user.id),
    getLocationMembers(params.locationId),
  ]);

  const stat = (label: string, value: string | number) => (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
      <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );

  return (
    <>
      <AppBar title="Stats" />
      <div className="space-y-5 px-4 py-4">
        <section>
          <SectionTitle>My stats</SectionTitle>
          <Card>
            <div className="grid grid-cols-4 gap-2">
              {stat("Played", stats.played)}
              {stat("Wins", stats.wins)}
              {stat("Win %", `${stats.winRate}`)}
              {stat("Rating", ctx.rating ?? "—")}
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle>Squad ({members.length})</SectionTitle>
          <Card className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={m.name} url={m.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {m.userId === ctx.user.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                  </p>
                  <p className="truncate text-xs capitalize text-slate-500 dark:text-slate-400">{m.role}</p>
                </div>
                <RatingDot rating={m.rating} />
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
