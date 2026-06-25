import { db } from "@/db";
import { joinRequests, locations, users } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { decideJoinAction } from "@/app/actions/locations";
import { AppBar } from "@/components/AppBar";
import { Card, EmptyState, Avatar, Badge } from "@/components/ui";
import { InlineAction } from "@/components/Form";
import { Icon } from "@/components/icons";

export default async function SuperPending() {
  const requests = await db
    .select({
      id: joinRequests.id,
      message: joinRequests.message,
      locationName: locations.name,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(joinRequests)
    .innerJoin(locations, eq(locations.id, joinRequests.locationId))
    .innerJoin(users, eq(users.id, joinRequests.userId))
    .where(eq(joinRequests.status, "pending"))
    .orderBy(asc(joinRequests.createdAt));

  return (
    <>
      <AppBar title="Global Pending" />
      <div className="space-y-3 px-4 py-4">
        {requests.length === 0 ? (
          <EmptyState title="No pending requests" hint="Join requests across all locations show here." icon={<Icon.Clock className="h-8 w-8" />} />
        ) : (
          requests.map((r) => (
            <Card key={r.id}>
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={r.name} url={r.avatarUrl} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">{r.email}</p>
                </div>
                <Badge tone="amber">{r.locationName}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <InlineAction action={decideJoinAction} hidden={{ requestId: r.id, decision: "approve" }} className="btn-primary w-full">Approve</InlineAction>
                <InlineAction action={decideJoinAction} hidden={{ requestId: r.id, decision: "reject" }} className="btn-ghost w-full" confirm="Reject this request?">Reject</InlineAction>
              </div>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
