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
      <AppBar title="Setări meci" back={`/loc/${params.locationId}/m/${match.id}`} />
      <div className="px-4 py-4">
        <Card>
          <ActionForm action={updateMatchSetupAction} className="space-y-4">
            <input type="hidden" name="matchId" value={match.id} />
            <div>
              <label className="label" htmlFor="title">Titlu</label>
              <input id="title" name="title" className="input" defaultValue={match.title ?? ""} placeholder="Opțional" />
            </div>
            <div>
              <label className="label" htmlFor="startsAt">Data și ora</label>
              <input id="startsAt" name="startsAt" type="datetime-local" className="input" defaultValue={toDateTimeLocal(match.startsAt)} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="numTeams">Echipe</label>
                <input id="numTeams" name="numTeams" type="number" min={2} max={6} defaultValue={match.numTeams} className="input text-center" />
              </div>
              <div>
                <label className="label" htmlFor="playersPerTeam">Per echipă</label>
                <input id="playersPerTeam" name="playersPerTeam" type="number" min={1} defaultValue={match.playersPerTeam} className="input text-center" />
              </div>
              <div>
                <label className="label" htmlFor="maxPlayers">Max</label>
                <input id="maxPlayers" name="maxPlayers" type="number" min={2} defaultValue={match.maxPlayers} className="input text-center" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pitchCost">Cost teren (lei)</label>
              <input id="pitchCost" name="pitchCost" type="number" min={0} step="0.01" className="input" defaultValue={match.pitchCost ?? ""} placeholder="Opțional" />
            </div>
            <div>
              <label className="label" htmlFor="notes">Observații</label>
              <textarea id="notes" name="notes" rows={2} className="input py-2" defaultValue={match.notes ?? ""} />
            </div>
            <SubmitButton pendingText="Se salvează…">Salvează</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
