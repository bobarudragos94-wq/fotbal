import Link from "next/link";
import { requirePageUser } from "@/lib/page";
import { getNotifications } from "@/lib/queries";
import { markNotificationsReadAction } from "@/app/actions/notifications";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, EmptyState } from "@/components/ui";
import { PushManager } from "@/components/PushManager";
import { ActionForm, SubmitButton } from "@/components/Form";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const items = await getNotifications(user.id);
  const hasUnread = items.some((n) => !n.read);

  return (
    <>
      <AppBar title="Notificări" back="/app" />
      <div className="space-y-5 px-4 py-4">
        <Card>
          <SectionTitle>Notificări pe telefon</SectionTitle>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            Primești o notificare când se creează un meci nou sau când trebuie să votezi rankingurile.
          </p>
          <PushManager />
        </Card>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Recente</SectionTitle>
            {hasUnread && (
              <ActionForm action={markNotificationsReadAction}>
                <SubmitButton className="btn-ghost btn-sm">Marchează citite</SubmitButton>
              </ActionForm>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState title="Nicio notificare" hint="Alertele tale vor apărea aici." icon={<Icon.Bell className="h-8 w-8" />} />
          ) : (
            <div className="space-y-2">
              {items.map((n) => {
                const inner = (
                  <div className={`card flex items-start gap-3 ${!n.read ? "border-brand-300 dark:border-brand-700" : ""}`}>
                    <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand-500"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{n.title}</p>
                      {n.body && <p className="text-sm text-slate-500 dark:text-slate-400">{n.body}</p>}
                      <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return n.url ? (
                  <Link key={n.id} href={n.url} className="block">{inner}</Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
