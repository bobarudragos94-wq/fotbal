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
                      ? `${p.proposal.count} voturi · medie ${p.proposal.mean} · mediană ${p.proposal.median}`
                      : "Niciun vot încă"}
                  </p>
                </div>
                {p.proposal.rounded && <Badge tone="amber">Propus ★{p.proposal.rounded}</Badge>}
              </div>
              <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Confirmă ratingul final</p>
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
