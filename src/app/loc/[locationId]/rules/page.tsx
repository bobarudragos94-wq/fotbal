import Link from "next/link";
import { loadLocationContext } from "@/lib/locationContext";
import { getRules } from "@/lib/queries";
import { AppBar } from "@/components/AppBar";
import { Card, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";

export default async function RulesPage({ params }: { params: { locationId: string } }) {
  const ctx = await loadLocationContext(params.locationId);
  const rules = await getRules(params.locationId);
  const base = `/loc/${params.locationId}`;

  return (
    <>
      <AppBar
        title="Reguli"
        right={ctx.isAdmin ? <Link href={`${base}/admin/rules`} className="btn-ghost btn-sm h-9 min-h-0">Editează</Link> : undefined}
      />
      <div className="space-y-4 px-4 py-4">
        {!rules?.content ? (
          <EmptyState
            title="Încă nu sunt reguli"
            hint={ctx.isAdmin ? "Adaugă regulile casei ca toți să fie pe aceeași pagină." : "Adminul n-a adăugat încă reguli."}
            icon={<Icon.Book className="h-8 w-8" />}
          />
        ) : (
          <Card>
            <div className="prose-sm whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
              {rules.content}
            </div>
          </Card>
        )}
        <p className="text-center text-xs text-slate-400">
          Confirmi că ai citit regulile pe pagina fiecărui meci.
        </p>
      </div>
    </>
  );
}
