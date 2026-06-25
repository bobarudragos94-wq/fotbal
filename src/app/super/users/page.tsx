import { db } from "@/db";
import { users, locationMembers } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { AppBar } from "@/components/AppBar";
import { Card, Avatar, Badge } from "@/components/ui";

export default async function SuperUsers() {
  const all = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isSuperAdmin: users.isSuperAdmin,
      avatarUrl: users.avatarUrl,
      memberships: sql<number>`(select count(*) from location_members lm where lm.user_id = ${users.id})`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return (
    <>
      <AppBar title={`Users (${all.length})`} />
      <div className="space-y-3 px-4 py-4">
        {all.map((u) => (
          <Card key={u.id} className="flex items-center gap-3">
            <Avatar name={u.name} url={u.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{u.name}</p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">{u.email}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              {u.isSuperAdmin && <Badge tone="brand">Super</Badge>}
              <Badge tone="slate">{Number(u.memberships)} loc</Badge>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
