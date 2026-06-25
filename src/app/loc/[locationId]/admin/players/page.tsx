import { requireLocationAdmin } from "@/lib/locationContext";
import { getLocationMembers } from "@/lib/queries";
import { setPlayerRatingAction } from "@/app/actions/ratings";
import { addDemoPlayersAction, removeDemoPlayersAction } from "@/app/actions/demo";
import { AppBar } from "@/components/AppBar";
import { Card, Avatar, Badge, RatingDot } from "@/components/ui";
import { SelectSubmit } from "@/components/SelectSubmit";
import { InlineAction } from "@/components/Form";

export default async function AdminPlayersPage({ params }: { params: { locationId: string } }) {
  const ctx = await requireLocationAdmin(params.locationId);
  const members = await getLocationMembers(params.locationId);
  const base = `/loc/${params.locationId}`;
  const demoCount = members.filter((m) => m.email.endsWith("@demo.local")).length;

  return (
    <>
      <AppBar title={`Players (${members.length})`} back={`${base}/admin`} />
      <div className="space-y-3 px-4 py-4">
        <Card className="border-dashed">
          <p className="text-sm font-semibold">Testing tools</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Add 18 demo players to try the full flow (RSVP fill, voting, teams). Remove them when done.
            {demoCount > 0 ? ` Currently ${demoCount} demo player(s).` : ""}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <InlineAction action={addDemoPlayersAction} hidden={{ locationId: params.locationId }} className="btn-primary w-full">
              Add 18 demo players
            </InlineAction>
            <InlineAction action={removeDemoPlayersAction} hidden={{ locationId: params.locationId }} className="btn-danger w-full"
              confirm="Remove ALL demo players and their data from this location?">
              Remove demo players
            </InlineAction>
          </div>
        </Card>

        {members.map((m) => (
          <Card key={m.userId} className="flex items-center gap-3">
            <Avatar name={m.name} url={m.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {m.name}
                {m.userId === ctx.user.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
              </p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {m.role === "admin" && <Badge tone="brand">Admin</Badge>}
                <RatingDot rating={m.rating} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase text-slate-400">Set rating</span>
              <SelectSubmit
                action={setPlayerRatingAction}
                name="rating"
                value={m.rating ? String(m.rating) : ""}
                hidden={{ locationId: params.locationId, targetUserId: m.userId }}
                options={[
                  { value: "", label: "—" },
                  { value: "1", label: "1 · Top" },
                  { value: "2", label: "2 · Good" },
                  { value: "3", label: "3 · Avg" },
                  { value: "4", label: "4 · Beginner" },
                ]}
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
