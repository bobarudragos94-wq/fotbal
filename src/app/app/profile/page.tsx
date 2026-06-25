import { requirePageUser } from "@/lib/page";
import { updateProfileAction, logoutAction } from "@/app/actions/auth";
import { AppBar } from "@/components/AppBar";
import { Card, Avatar, Badge } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/Form";
import { Icon } from "@/components/icons";

export default async function ProfilePage() {
  const user = await requirePageUser();
  return (
    <>
      <AppBar title="Profile" />
      <div className="space-y-5 px-4 py-4">
        <Card className="flex items-center gap-4">
          <Avatar name={user.name} url={user.avatarUrl} size={56} />
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{user.name}</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            {user.isSuperAdmin && <Badge tone="brand">Super Admin</Badge>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-semibold">Edit profile</h2>
          <ActionForm action={updateProfileAction} className="space-y-4">
            <div>
              <label className="label" htmlFor="name">Name</label>
              <input id="name" name="name" defaultValue={user.name} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input id="phone" name="phone" defaultValue={user.phone ?? ""} className="input" placeholder="Optional" />
            </div>
            <div>
              <label className="label" htmlFor="avatarUrl">Avatar URL</label>
              <input id="avatarUrl" name="avatarUrl" defaultValue={user.avatarUrl ?? ""} className="input" placeholder="https://…  (optional)" />
            </div>
            <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
          </ActionForm>
        </Card>

        <form action={logoutAction}>
          <SubmitButton className="btn-ghost w-full">
            <Icon.Logout className="h-5 w-5" /> Log out
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
