import { requireLocationAdmin } from "@/lib/locationContext";
import { getPendingJoinRequests } from "@/lib/queries";
import { decideJoinAction } from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { Card, EmptyState, Avatar } from "@/components/ui";
import { InlineAction } from "@/components/Form";
import { Icon } from "@/components/icons";

export default async function PendingPage({ params }: { params: { locationId: string } }) {
  await requireLocationAdmin(params.locationId);
  const requests = await getPendingJoinRequests(params.locationId);
  const base = `/loc/${params.locationId}`;

  return (
    <>
      <AppBar title="Cereri jucători" back={`${base}/admin`} />
      <div className="space-y-3 px-4 py-4">
        {requests.length === 0 ? (
          <EmptyState title="Nicio cerere în așteptare" hint="Cererile noi vor apărea aici." icon={<Icon.Users className="h-8 w-8" />} />
        ) : (
          requests.map((r) => (
            <Card key={r.id}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={r.name} url={r.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{r.email}{r.phone ? ` · ${r.phone}` : ""}</p>
                </div>
              </div>
              {r.message && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800/60">{r.message}</p>}
              <div className="grid grid-cols-2 gap-2">
                <InlineAction action={decideJoinAction} hidden={{ requestId: r.id, decision: "approve" }} className="btn-primary w-full">
                  Aprobă
                </InlineAction>
                <InlineAction action={decideJoinAction} hidden={{ requestId: r.id, decision: "reject" }} className="btn-ghost w-full" confirm="Respingi cererea?">
                  Respinge
                </InlineAction>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
