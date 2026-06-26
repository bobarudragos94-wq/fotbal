import { requirePageUser } from "@/lib/page";
import { createLocationAction } from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { Card } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";

export default async function NewLocationPage() {
  await requirePageUser();
  return (
    <>
      <AppBar title="Locație nouă" back="/app" />
      <div className="px-4 py-4">
        <Card>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Creează-ți propriul teren. Devii adminul lui și primești un cod de invitație de dat jucătorilor.
          </p>
          <ActionForm action={createLocationAction} className="space-y-3" resetOnSuccess>
            <input name="name" required className="input" placeholder="Numele locației (ex. Sud Arena)" />
            <input name="address" className="input" placeholder="Adresă (opțional)" />
            <textarea name="description" rows={2} className="input py-2" placeholder="Scurtă descriere (opțional)" />
            <textarea name="rules" rows={3} className="input py-2" placeholder="Reguli inițiale (opțional)" />
            <SubmitButton pendingText="Se creează…">Creează locația</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
