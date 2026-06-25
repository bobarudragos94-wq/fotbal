import { loadLocationContext } from "@/lib/locationContext";
import { getUnratedPlayers } from "@/lib/queries";
import { castRatingVoteAction } from "@/app/actions/ratings";
import { AppBar } from "@/components/AppBar";
import { Card, EmptyState, Avatar, Badge } from "@/components/ui";
import { InlineAction } from "@/components/Form";
import { Icon } from "@/components/icons";
import { RATING_LABELS } from "@/lib/rating";

export default async function RatePage({ params }: { params: { locationId: string } }) {
  const ctx = await loadLocationContext(params.locationId);
  const unrated = await getUnratedPlayers(params.locationId, ctx.user.id);

  return (
    <>
      <AppBar title="Rate Players" />
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Help the admin rate new players. 1 = top player, 4 = beginner. The admin confirms the final rating.
        </p>

        {unrated.length === 0 ? (
          <EmptyState title="Everyone's rated" hint="No players need a rating right now." icon={<Icon.Users className="h-8 w-8" />} />
        ) : (
          unrated.map((p) => (
            <Card key={p.userId}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={p.name} url={p.avatarUrl} />
                <div className="flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.proposal.count > 0
                      ? `${p.proposal.count} vote(s) · proposed ★${p.proposal.rounded} (avg ${p.proposal.mean})`
                      : "No votes yet"}
                  </p>
                </div>
                {p.myVote && <Badge tone="brand">You: ★{p.myVote}</Badge>}
              </div>
              {p.userId === ctx.user.id ? (
                <p className="text-sm text-slate-400">You can't rate yourself.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((r) => (
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
      </div>
    </>
  );
}
