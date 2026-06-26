import { requirePageUser } from "@/lib/page";
import { display } from "@/lib/auth";
import { updateProfileAction, logoutAction } from "@/app/actions/auth";
import { AppBar } from "@/components/AppBar";
import { Card, Avatar, Badge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";
import { Icon } from "@/components/icons";

export default async function ProfilePage() {
  const user = await requirePageUser();
  return (
    <>
      <AppBar title="Profil" />
      <div className="space-y-5 px-4 py-4">
        <Card className="flex items-center gap-4">
          <Avatar name={display(user)} url={user.avatarUrl} size={56} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{display(user)}</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            {user.isSuperAdmin && <Badge tone="brand">Super Admin</Badge>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Editează profilul</h2>
          <ActionForm action={updateProfileAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="nickname">Nickname <span className="text-slate-400">(vizibil pentru toți)</span></label>
              <input id="nickname" name="nickname" defaultValue={user.nickname ?? ""} className="input" required minLength={2} maxLength={24} />
            </div>
            <div>
              <label className="label" htmlFor="name">Nume complet <span className="text-slate-400">(privat)</span></label>
              <input id="name" name="name" defaultValue={user.name} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="phone">Telefon</label>
              <input id="phone" name="phone" defaultValue={user.phone ?? ""} className="input" placeholder="Opțional" />
            </div>
            <div>
              <label className="label" htmlFor="avatarUrl">URL avatar</label>
              <input id="avatarUrl" name="avatarUrl" defaultValue={user.avatarUrl ?? ""} className="input" placeholder="https://…  (opțional)" />
            </div>
            <SubmitButton pendingText="Se salvează…">Salvează</SubmitButton>
          </ActionForm>
        </Card>

        <form action={logoutAction}>
          <SubmitButton className="btn-ghost w-full">
            <Icon.Logout className="h-5 w-5" /> Deconectare
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
