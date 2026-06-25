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
        title="Rules"
        right={ctx.isAdmin ? <Link href={`${base}/admin/rules`} className="btn-ghost btn-sm h-9 min-h-0">Edit</Link> : undefined}
      />
      <div className="space-y-4 px-4 py-4">
        {!rules?.content ? (
          <EmptyState
            title="No rules set yet"
            hint={ctx.isAdmin ? "Add the house rules so everyone's on the same page." : "The admin hasn't added rules yet."}
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
          You confirm you've read the rules on each match's page.
        </p>
      </div>
    </>
  );
}
