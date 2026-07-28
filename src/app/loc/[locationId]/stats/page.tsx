import { loadLocationContext } from "@/lib/locationContext";
import { getLocationPlayerStats, getLocationMembers } from "@/lib/queries";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, Avatar, Badge, RatingDot } from "@/components/ui";

export default async function StatsPage({ params }: { params: { locationId: string } }) {
  const ctx = await loadLocationContext(params.locationId);
  const [agg, members] = await Promise.all([
    getLocationPlayerStats(params.locationId),
    getLocationMembers(params.locationId),
  ]);

  const zero = { played: 0, wins: 0, goals: 0 };
  const mine = agg.get(ctx.user.id) ?? zero;
  const myWinRate = mine.played > 0 ? Math.round((mine.wins / mine.played) * 100) : 0;

  const stat = (label: string, value: string | number) => (
    <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
      <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );

  // Leaderboard: everyone, ranked by goals, then wins, then played.
  const board = members
    .map((m) => ({ ...m, ...(agg.get(m.userId) ?? zero) }))
    .sort((a, b) => b.goals - a.goals || b.wins - a.wins || b.played - a.played);

  return (
    <>
      <AppBar title="Statistici" />
      <div className="space-y-5 px-4 py-4">
        <section>
          <SectionTitle>Statisticile mele</SectionTitle>
          <Card>
            <div className="grid grid-cols-4 gap-2">
              {stat("Jucate", mine.played)}
              {stat("Victorii", mine.wins)}
              {stat("Goluri", mine.goals)}
              {stat("% victorii", myWinRate)}
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle>Clasament jucători</SectionTitle>
          <Card className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800">
                  <th className="px-3 py-2">Jucător</th>
                  <th className="px-2 py-2 text-center">J</th>
                  <th className="px-2 py-2 text-center">V</th>
                  <th className="px-3 py-2 text-center">Goluri</th>
                </tr>
              </thead>
              <tbody>
                {board.map((m) => (
                  <tr key={m.userId} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={m.name} url={m.avatarUrl} size={28} />
                        <span className="truncate font-medium">
                          {m.name}
                          {m.userId === ctx.user.id && <span className="ml-1 text-xs text-slate-400">(tu)</span>}
                        </span>
                        {m.rating != null && <RatingDot rating={m.rating} />}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center">{m.played}</td>
                    <td className="px-2 py-2 text-center">{m.wins}</td>
                    <td className="px-3 py-2 text-center font-bold">{m.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 text-center text-xs text-slate-400">
            J = meciuri jucate · V = victorii · din meciurile încheiate.
          </p>
        </section>
      </div>
    </>
  );
}
