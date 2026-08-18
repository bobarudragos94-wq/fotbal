import { loadLocationContext } from "@/lib/locationContext";
import { getUnratedPlayers, getLocationMembers } from "@/lib/queries";
import { castRatingVoteAction } from "@/app/actions/ratings";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, EmptyState, Avatar, Badge, RatingDot } from "@/components/ui";
import { InlineAction } from "@/components/Form";
import { Icon } from "@/components/icons";
import { RATING_LABELS, formatRating } from "@/lib/rating";

export default async function RatePage({ params }: { params: { locationId: string } }) {
  const ctx = await loadLocationContext(params.locationId);
  const [unrated, members] = await Promise.all([
    getUnratedPlayers(params.locationId, ctx.user.id),
    getLocationMembers(params.locationId),
  ]);
  // Final notes, best first — this is where players come looking after they vote.
  const rated = members
    .filter((m) => m.rating != null)
    .sort((a, b) => (a.rating as number) - (b.rating as number));

  return (
    <>
      <AppBar title="Votează jucători" />
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ajută adminul să evalueze jucătorii noi. 1 = top, 6 = începător. Adminul confirmă ratingul final.
        </p>

        {unrated.length === 0 ? (
          <EmptyState title="Toți au rating" hint="Niciun jucător nu are nevoie de rating acum." icon={<Icon.Users className="h-8 w-8" />} />
        ) : (
          unrated.map((p) => (
            <Card key={p.userId}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={p.name} url={p.avatarUrl} />
                <div className="flex-1">
                  <p className="font-semibold">{p.name}</p>
                  {ctx.isAdmin && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {p.proposal.count === 0
                        ? "Niciun vot încă"
                        : `${p.proposal.count} voturi · medie ★${formatRating(p.proposal.mean!)}`}
                    </p>
                  )}
                </div>
                {p.myVote &&
                  (ctx.isAdmin ? <Badge tone="brand">Tu: ★{p.myVote}</Badge> : <Badge tone="green">Ai votat</Badge>)}
              </div>
              {p.userId === ctx.user.id ? (
                <p className="text-sm text-slate-400">Nu te poți evalua pe tine.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((r) => (
                    <InlineAction
                      key={r}
                      action={castRatingVoteAction}
                      hidden={{ locationId: params.locationId, targetUserId: p.userId, rating: String(r) }}
                      className={`btn-sm w-full flex-col gap-0 py-2 ${p.myVote === r ? "btn-primary" : "btn-ghost"}`}
                    >
                      <span className="text-base font-bold">{r}</span>
                      <span className="text-[10px] font-normal opacity-80">{RATING_LABELS[r]}</span>
                    </InlineAction>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}

        {rated.length > 0 && (
          <section>
            <SectionTitle>Note finale ({rated.length})</SectionTitle>
            <Card className="p-0">
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {rated.map((m) => (
                  <div key={m.userId} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={m.name} url={m.avatarUrl} size={32} />
                    <span className="flex-1 truncate text-sm font-medium">
                      {m.name}
                      {m.userId === ctx.user.id && <span className="ml-1 text-xs text-slate-400">(tu)</span>}
                    </span>
                    <RatingDot rating={m.rating} />
                  </div>
                ))}
              </div>
            </Card>
            <p className="mt-2 text-center text-xs text-slate-400">
              Nota finală este media voturilor, confirmată de admin. Voturile individuale rămân private.
            </p>
          </section>
        )}
      </div>
    </>
  );
}
