import { redirect } from "next/navigation";
import { requireLocationAdmin } from "@/lib/locationContext";
import { getMatch } from "@/lib/queries";
import { updateMatchSetupAction } from "@/app/actions/matches";
import { AppBar } from "@/components/AppBar";
import { Card } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";
import { toDateTimeLocal } from "@/lib/format";

export default async function EditMatchPage({ params }: { params: { locationId: string; matchId: string } }) {
  await requireLocationAdmin(params.locationId);
  const match = await getMatch(params.matchId);
  if (!match || match.locationId !== params.locationId) redirect(`/loc/${params.locationId}`);

  return (
    <>
      <AppBar title="Match Setup" back={`/loc/${params.locationId}/m/${match.id}`} />
      <div className="px-4 py-4">
        <Card>
          <ActionForm action={updateMatchSetupAction} className="space-y-4">
            <input type="hidden" name="matchId" value={match.id} />
            <div>
              <label className="label" htmlFor="title">Title</label>
              <input id="title" name="title" className="input" defaultValue={match.title ?? ""} placeholder="Optional" />
            </div>
            <div>
              <label className="label" htmlFor="startsAt">Date & time</label>
              <input id="startsAt" name="startsAt" type="datetime-local" className="input" defaultValue={toDateTimeLocal(match.startsAt)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="numTeams">Teams</label>
                <input id="numTeams" name="numTeams" type="number" min={2} max={6} defaultValue={match.numTeams} className="input text-center" />
              </div>
              <div>
                <label className="label" htmlFor="playersPerTeam">Per team</label>
                <input id="playersPerTeam" name="playersPerTeam" type="number" min={1} defaultValue={match.playersPerTeam} className="input text-center" />
              </div>
              <div>
                <label className="label" htmlFor="maxPlayers">Max</label>
                <input id="maxPlayers" name="maxPlayers" type="number" min={2} defaultValue={match.maxPlayers} className="input text-center" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pitchCost">Pitch cost (lei)</label>
              <input id="pitchCost" name="pitchCost" type="number" min={0} step="0.01" className="input" defaultValue={match.pitchCost ?? ""} placeholder="Optional" />
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" rows={2} className="input py-2" defaultValue={match.notes ?? ""} />
            </div>
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
