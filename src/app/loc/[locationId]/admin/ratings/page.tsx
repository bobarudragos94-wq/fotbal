import { requireLocationAdmin } from "@/lib/locationContext";
import { getUnratedPlayers } from "@/lib/queries";
import { setPlayerRatingAction, resetLocationRatingsAction } from "@/app/actions/ratings";
import { AppBar } from "@/components/AppBar";
import { Card, EmptyState, Avatar, Badge } from "@/components/ui";
import { InlineAction } from "@/components/Form";
import { Icon } from "@/components/icons";
import { RATING_LABELS } from "@/lib/rating";

export default async function AdminRatingsPage({ params }: { params: { locationId: string } }) {
  const ctx = await requireLocationAdmin(params.locationId);
  const unrated = await getUnratedPlayers(params.locationId, ctx.user.id);

  return (
    <>
      <AppBar title="Confirm Ratings" back={`/loc/${params.locationId}/admin`} />
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Players are rated by community vote. Confirm the proposed rating, or override it. You can also generate
          teams before everyone is rated — unrated players get an automatic rating.
        </p>

        <Card className="border-dashed">
          <p className="text-sm font-semibold">Reset all ratings</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Clears every player&apos;s rating and all votes in this location, so the whole squad is re-voted from
            scratch. Use this before a match if there are disputes.
          </p>
          <InlineAction
            action={resetLocationRatingsAction}
            hidden={{ locationId: params.locationId }}
            className="btn-danger w-full"
            confirm="Reset ALL ratings and votes in this location? Everyone becomes unrated and must be voted again."
          >
            Reset all ratings & votes
          </InlineAction>
        </Card>
        {unrated.length === 0 ? (
          <EmptyState title="All players rated" hint="You're ready to generate balanced teams." icon={<Icon.Users className="h-8 w-8" />} />
        ) : (
          unrated.map((p) => (
            <Card key={p.userId}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={p.name} url={p.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.proposal.count > 0
                      ? `${p.proposal.count} vote(s) · avg ${p.proposal.mean} · median ${p.proposal.median}`
                      : "No votes yet"}
                  </p>
                </div>
                {p.proposal.rounded && <Badge tone="amber">Proposed ★{p.proposal.rounded}</Badge>}
              </div>
              <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Confirm final rating</p>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((r) => (
                  <InlineAction
                    key={r}
                    action={setPlayerRatingAction}
                    hidden={{ locationId: params.locationId, targetUserId: p.userId, rating: String(r) }}
                    className={`btn-sm w-full flex-col gap-0 py-2 ${p.proposal.rounded === r ? "btn-accent" : "btn-ghost"}`}
                  >
                    <span className="text-base font-bold">{r}</span>
                    <span className="text-[10px] font-normal opacity-80">{RATING_LABELS[r]}</span>
                  </InlineAction>
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
