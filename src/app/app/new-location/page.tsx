import { requirePageUser } from "@/lib/page";
import { createLocationAction } from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { Card } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";

export default async function NewLocationPage() {
  await requirePageUser();
  return (
    <>
      <AppBar title="New Location" back="/app" />
      <div className="px-4 py-4">
        <Card>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Create your own pitch. You become its admin and get an invite code to share with players.
          </p>
          <ActionForm action={createLocationAction} className="space-y-3" resetOnSuccess>
            <input name="name" required className="input" placeholder="Location name (e.g. Sud Arena)" />
            <input name="address" className="input" placeholder="Address (optional)" />
            <textarea name="description" rows={2} className="input py-2" placeholder="Short description (optional)" />
            <textarea name="rules" rows={3} className="input py-2" placeholder="Initial rules (optional)" />
            <SubmitButton pendingText="Creating…">Create location</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
