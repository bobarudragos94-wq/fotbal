import { requireLocationAdmin } from "@/lib/locationContext";
import { getUnratedPlayers } from "@/lib/queries";
import { setPlayerRatingAction, resetLocationRatingsAction } from "@/app/actions/ratings";
import { AppBar } from "@/components/AppBar";
import { Card, EmptyState, Avatar, Badge } from "@/components/ui";
import { InlineAction } from "@/components/Form";
import { Icon } from "@/components/icons";
import { RATING_LABELS, formatRating } from "@/lib/rating";

/** Manual override steps: 1 … 6 in halves. */
const MANUAL_STEPS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];

export default async function AdminRatingsPage({ params }: { params: { locationId: string } }) {
  const ctx = await requireLocationAdmin(params.locationId);
  const unrated = await getUnratedPlayers(params.locationId, ctx.user.id);

  return (
    <>
      <AppBar title="Confirmă ratingurile" back={`/loc/${params.locationId}/admin`} />
      <div className="space-y-4 px-4 py-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Jucătorii sunt evaluați prin votul comunității. Confirmă ratingul propus sau modifică-l. Poți genera
          echipele și înainte ca toți să fie evaluați — cei fără rating primesc unul automat.
        </p>

        <Card className="border-dashed">
          <p className="text-sm font-semibold">Resetează toate ratingurile</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Șterge ratingul fiecărui jucător și toate voturile din locație, ca tot lotul să fie revotat de la
            zero. Folosește înainte de meci dacă apar discuții.
          </p>
          <InlineAction
            action={resetLocationRatingsAction}
            hidden={{ locationId: params.locationId }}
            className="btn-danger w-full"
            confirm="Resetezi TOATE ratingurile și voturile din locație? Toți rămân fără rating și trebuie revotați."
          >
            Resetează ratinguri și voturi
          </InlineAction>
        </Card>
        {unrated.length === 0 ? (
          <EmptyState title="Toți jucătorii au rating" hint="Ești gata să generezi echipe echilibrate." icon={<Icon.Users className="h-8 w-8" />} />
        ) : (
          unrated.map((p) => (
            <Card key={p.userId}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={p.name} url={p.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.proposal.count > 0
                      ? `${p.proposal.count} voturi · medie ${formatRating(p.proposal.mean!)} · mediană ${p.proposal.median}`
                      : "Niciun vot încă"}
                  </p>
                </div>
                {p.proposal.mean != null && <Badge tone="amber">Propus ★{formatRating(p.proposal.mean)}</Badge>}
              </div>

              {p.proposal.mean != null && (
                <InlineAction
                  action={setPlayerRatingAction}
                  hidden={{
                    locationId: params.locationId,
                    targetUserId: p.userId,
                    rating: String(p.proposal.mean),
                  }}
                  className="btn-primary mb-3 w-full"
                >
                  Confirmă media votată · ★{formatRating(p.proposal.mean)}
                </InlineAction>
              )}

              <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Sau pune tu nota (pași de 0,5)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {MANUAL_STEPS.map((r) => (
                  <InlineAction
                    key={r}
                    action={setPlayerRatingAction}
                    hidden={{ locationId: params.locationId, targetUserId: p.userId, rating: String(r) }}
                    className="btn-ghost btn-sm w-full flex-col gap-0 py-2"
                  >
                    <span className="text-base font-bold">{formatRating(r)}</span>
                    <span className="w-full truncate text-[10px] font-normal opacity-80">
                      {Number.isInteger(r) ? RATING_LABELS[r] : " "}
                    </span>
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
