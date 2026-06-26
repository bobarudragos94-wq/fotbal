import { requireLocationAdmin } from "@/lib/locationContext";
import { getRules } from "@/lib/queries";
import { updateRulesAction } from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { Card } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";

const TEMPLATE = `- No slide tackles
- Any hand contact is a handball
- Call your own fouls
- Keeper stays in the box
- Whoever kicks the ball out fetches it
- Don't argue every call
- More than 10 min late may lose your spot`;

export default async function RulesEditorPage({ params }: { params: { locationId: string } }) {
  await requireLocationAdmin(params.locationId);
  const rules = await getRules(params.locationId);

  return (
    <>
      <AppBar title="Editor reguli" back={`/loc/${params.locationId}/admin`} />
      <div className="px-4 py-4">
        <Card>
          <ActionForm action={updateRulesAction} className="space-y-3">
            <input type="hidden" name="locationId" value={params.locationId} />
            <label className="label" htmlFor="content">Regulile casei</label>
            <textarea
              id="content"
              name="content"
              rows={14}
              className="input py-2 font-mono text-sm leading-relaxed"
              defaultValue={rules?.content || TEMPLATE}
            />
            <SubmitButton pendingText="Se salvează…">Salvează regulile</SubmitButton>
          </ActionForm>
        </Card>
        <p className="mt-3 text-center text-xs text-slate-400">
          Jucătorii confirmă că le-au citit pe pagina fiecărui meci.
        </p>
      </div>
    </>
  );
}
