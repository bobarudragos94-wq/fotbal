import { requireLocationAdmin } from "@/lib/locationContext";
import { createMatchAction } from "@/app/actions/matches";
import { AppBar } from "@/components/AppBar";
import { Card } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";
import { toDateTimeLocal } from "@/lib/format";

export default async function NewMatchPage({ params }: { params: { locationId: string } }) {
  await requireLocationAdmin(params.locationId);
  // default: next day at 19:00
  const def = new Date();
  def.setDate(def.getDate() + 1);
  def.setHours(19, 0, 0, 0);

  return (
    <>
      <AppBar title="Creează meci" back={`/loc/${params.locationId}/admin`} />
      <div className="px-4 py-4">
        <Card>
          <ActionForm action={createMatchAction} className="space-y-4">
            <input type="hidden" name="locationId" value={params.locationId} />
            <div>
              <label className="label" htmlFor="title">Titlu <span className="text-slate-400">(opțional)</span></label>
              <input id="title" name="title" className="input" placeholder="Vineri seara 5 la 5" />
            </div>
            <div>
              <label className="label" htmlFor="startsAt">Data și ora</label>
              <input id="startsAt" name="startsAt" type="datetime-local" required className="input" defaultValue={toDateTimeLocal(Math.floor(def.getTime() / 1000))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label" htmlFor="numTeams">Echipe</label>
                <input id="numTeams" name="numTeams" type="number" min={2} max={6} defaultValue={3} className="input text-center" />
              </div>
              <div>
                <label className="label" htmlFor="playersPerTeam">Per echipă</label>
                <input id="playersPerTeam" name="playersPerTeam" type="number" min={1} defaultValue={6} className="input text-center" />
              </div>
              <div>
                <label className="label" htmlFor="maxPlayers">Max</label>
                <input id="maxPlayers" name="maxPlayers" type="number" min={2} defaultValue={18} className="input text-center" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pitchCost">Cost teren (lei) <span className="text-slate-400">(opțional)</span></label>
              <input id="pitchCost" name="pitchCost" type="number" min={0} step="0.01" className="input" placeholder="360" />
            </div>
            <div>
              <label className="label" htmlFor="notes">Observații <span className="text-slate-400">(opțional)</span></label>
              <textarea id="notes" name="notes" rows={2} className="input py-2" placeholder="Aduceți tricouri deschise și închise" />
            </div>
            <SubmitButton pendingText="Se creează…">Creează meciul</SubmitButton>
          </ActionForm>
        </Card>
        <p className="mt-3 text-center text-xs text-slate-400">
          Meciurile noi se deschid imediat pentru înscrieri. Poți bloca și genera echipele mai târziu.
        </p>
      </div>
    </>
  );
}
