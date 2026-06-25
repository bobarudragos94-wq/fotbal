import Link from "next/link";
import { redirect } from "next/navigation";
import { loadLocationContext } from "@/lib/locationContext";
import {
  getMatch,
  getMatchParticipants,
  getTeams,
  getGames,
  getMatchStandings,
  getRules,
  getUnratedPlayers,
  type ParticipantRow,
} from "@/lib/queries";
import {
  rsvpAction,
  confirmRulesAction,
  lockMatchAction,
  generateTeamsAction,
  setMatchStatusAction,
  promoteWaitlistAction,
  movePlayerToTeamAction,
  saveGameAction,
  deleteGameAction,
  togglePaidAction,
} from "@/app/actions/matches";
import { castRatingVoteAction, setPlayerRatingAction } from "@/app/actions/ratings";
import { fillMatchWithDemosAction } from "@/app/actions/demo";
import { AppBar } from "@/components/AppBar";
import { Card, SectionTitle, Badge, StatusBadge, Avatar, RatingDot, EmptyState } from "@/components/ui";
import { ActionForm, SubmitButton, InlineAction } from "@/components/Form";
import { SelectSubmit } from "@/components/SelectSubmit";
import { Icon } from "@/components/icons";
import { formatDateTime, money } from "@/lib/format";
import { RATING_LABELS } from "@/lib/rating";

const TEAM_STYLES = [
  "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
  "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900",
];

export default async function MatchPage({
  params,
}: {
  params: { locationId: string; matchId: string };
}) {
  const ctx = await loadLocationContext(params.locationId);
  const match = await getMatch(params.matchId);
  if (!match || match.locationId !== params.locationId) redirect(`/loc/${params.locationId}`);

  const [participants, teams, games, rules] = await Promise.all([
    getMatchParticipants(params.matchId, params.locationId),
    getTeams(params.matchId),
    getGames(params.matchId),
    getRules(params.locationId),
  ]);
  const standings = teams.length ? await getMatchStandings(params.matchId) : [];

  const base = `/loc/${params.locationId}`;
  const me = participants.find((p) => p.userId === ctx.user.id);
  const group = (s: string) => participants.filter((p) => p.status === s);
  const going = group("going");
  const maybe = group("maybe");
  const declined = group("declined");
  const waitlist = group("waitlist");
  const unratedGoing = going.filter((p) => p.rating == null);

  const costPerPlayer = match.pitchCost != null && going.length > 0 ? match.pitchCost / going.length : null;
  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  const editable = match.status !== "finished";

  // Confirmed players still without a team after generation (reserves).
  const reserves = teams.length > 0 ? going.filter((p) => p.teamId == null) : [];

  // Match-scoped rating voting (starts once the list is locked).
  const goingIds = new Set(going.map((p) => p.userId));
  const allUnrated = match.status === "locked" ? await getUnratedPlayers(params.locationId, ctx.user.id) : [];
  const matchUnrated = allUnrated.filter((u) => goingIds.has(u.userId));

  return (
    <>
      <AppBar
        title={match.title || "Match"}
        back={base}
        right={ctx.isAdmin && editable ? (
          <Link href={`${base}/admin/match/${match.id}`} className="btn-ghost btn-sm h-9 min-h-0">Edit</Link>
        ) : undefined}
      />
      <div className="space-y-5 px-4 py-4">
        {/* Overview */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-lg font-bold">
                <Icon.Calendar className="h-5 w-5 text-brand-600" /> {formatDateTime(match.startsAt)}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {match.numTeams} teams × {match.playersPerTeam} · max {match.maxPlayers} players
              </p>
            </div>
            <StatusBadge status={match.status} />
          </div>
          {match.notes && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/60">{match.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge tone={going.length >= match.maxPlayers ? "amber" : "green"}>
              <Icon.Users className="h-3.5 w-3.5" /> {going.length}/{match.maxPlayers} confirmed
            </Badge>
            {match.pitchCost != null && <Badge tone="slate">Pitch {money(match.pitchCost)}</Badge>}
            {costPerPlayer != null && <Badge tone="slate">{money(costPerPlayer)}/player</Badge>}
          </div>
        </Card>

        {/* Your RSVP */}
        {match.status !== "finished" && (
          <Card>
            <SectionTitle>Your RSVP</SectionTitle>
            {match.status === "locked" ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                The list is locked. You're {me ? <strong>{me.status}</strong> : "not on the list"}.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {([["going", "I'm in", "green"], ["maybe", "Maybe", "amber"], ["declined", "Can't", "red"]] as const).map(
                  ([choice, label]) => (
                    <InlineAction
                      key={choice}
                      action={rsvpAction}
                      hidden={{ matchId: match.id, choice }}
                      className={`btn-sm w-full ${me?.status === choice ? "btn-primary" : "btn-ghost"}`}
                    >
                      {label}
                    </InlineAction>
                  )
                )}
              </div>
            )}
            {me?.status === "waitlist" && (
              <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                Match is full — you're on the waitlist. We'll move you up if a spot frees.
              </p>
            )}

            {rules?.content && (
              <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                {me?.rulesConfirmed ? (
                  <p className="flex items-center gap-1.5 text-sm text-brand-600 dark:text-brand-400">
                    <Icon.Book className="h-4 w-4" /> You've confirmed the rules. Thanks!
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`${base}/rules`} className="text-sm font-medium text-brand-600 dark:text-brand-400">
                      Read the rules →
                    </Link>
                    <InlineAction action={confirmRulesAction} hidden={{ matchId: match.id }} className="btn-accent btn-sm">
                      I've read the rules
                    </InlineAction>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Admin: workflow */}
        {ctx.isAdmin && (
          <Card>
            <SectionTitle>Admin controls</SectionTitle>
            <div className="space-y-3">
              {match.status === "open" && (
                <>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {going.length} confirmed{going.length >= match.numTeams
                      ? ` → ${match.numTeams} teams of ${Math.min(match.playersPerTeam, Math.floor(going.length / match.numTeams))}`
                      : ""}.
                    {unratedGoing.length > 0
                      ? ` Locking the list starts the rating vote for ${unratedGoing.length} unrated player(s).`
                      : " Lock the list when everyone's in."}
                  </p>
                  <InlineAction action={lockMatchAction} hidden={{ matchId: match.id }} className="btn-primary w-full"
                    confirm="Lock the participant list? Players won't be able to change their RSVP, and the rating vote opens.">
                    Lock list & start voting ({going.length})
                  </InlineAction>
                  <InlineAction action={fillMatchWithDemosAction} hidden={{ matchId: match.id }} className="btn-ghost w-full">
                    Fill with demo players (testing)
                  </InlineAction>
                </>
              )}

              {match.status === "locked" && (
                <>
                  {matchUnrated.length > 0 && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      {matchUnrated.length} player(s) not confirmed yet. You can confirm ratings below, or just
                      generate now — unrated players use their vote average (or a neutral rating).
                    </p>
                  )}
                  <InlineAction action={generateTeamsAction} hidden={{ matchId: match.id }} className="btn-primary w-full">
                    {teams.length ? "Regenerate teams" : "Generate teams"}
                  </InlineAction>
                  <InlineAction action={setMatchStatusAction} hidden={{ matchId: match.id, status: "open" }}
                    className="btn-ghost w-full">
                    Reopen RSVP
                  </InlineAction>
                  {teams.length > 0 && (
                    <InlineAction action={setMatchStatusAction} hidden={{ matchId: match.id, status: "finished" }}
                      className="btn-accent w-full" confirm="Mark this match as finished?">
                      Finish match
                    </InlineAction>
                  )}
                </>
              )}

              {match.status === "draft" && (
                <InlineAction action={setMatchStatusAction} hidden={{ matchId: match.id, status: "open" }} className="btn-primary w-full">
                  Open for RSVP
                </InlineAction>
              )}

              {match.status === "finished" && (
                <InlineAction action={setMatchStatusAction} hidden={{ matchId: match.id, status: "locked" }} className="btn-ghost w-full">
                  Reopen (back to locked)
                </InlineAction>
              )}
            </div>
          </Card>
        )}

        {/* Rating vote — starts after the list is locked */}
        {match.status === "locked" && matchUnrated.length > 0 && (
          <section>
            <SectionTitle>Rate the unrated</SectionTitle>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              The list is locked. Vote where these players belong (1 = top, 4 = beginner).
              {ctx.isAdmin ? " As admin, confirm each final rating to close the vote." : " The admin confirms the final rating."}
            </p>
            <div className="space-y-3">
              {matchUnrated.map((p) => (
                <Card key={p.userId}>
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar name={p.name} url={p.avatarUrl} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {p.proposal.count === 0
                          ? "No votes yet"
                          : ctx.isAdmin
                            ? `${p.proposal.count} vote(s) · proposed ★${p.proposal.rounded} (avg ${p.proposal.mean})`
                            : `${p.proposal.count} vote(s) so far`}
                      </p>
                    </div>
                    {p.myVote && <Badge tone="brand">You: ★{p.myVote}</Badge>}
                  </div>

                  {p.userId !== ctx.user.id && (
                    <>
                      <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Your vote</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((r) => (
                          <InlineAction
                            key={r}
                            action={castRatingVoteAction}
                            hidden={{ locationId: params.locationId, targetUserId: p.userId, rating: String(r) }}
                            className={`btn-sm w-full flex-col gap-0 py-2 ${p.myVote === r ? "btn-primary" : "btn-ghost"}`}
                          >
                            <span className="text-base font-bold">{r}</span>
                            <span className="text-[10px] font-normal opacity-80">{RATING_LABELS[r]}</span>
                          </InlineAction>
                        ))}
                      </div>
                    </>
                  )}

                  {ctx.isAdmin && (
                    <>
                      <p className="mb-1 mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">Confirm final rating</p>
                      <div className="grid grid-cols-4 gap-2">
                        {[1, 2, 3, 4].map((r) => (
                          <InlineAction
                            key={r}
                            action={setPlayerRatingAction}
                            hidden={{ locationId: params.locationId, targetUserId: p.userId, rating: String(r) }}
                            className={`btn-sm w-full ${p.proposal.rounded === r ? "btn-accent" : "btn-ghost"}`}
                          >
                            ★{r}
                          </InlineAction>
                        ))}
                      </div>
                    </>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Teams */}
        {teams.length > 0 && (
          <section>
            <SectionTitle>Teams</SectionTitle>
            <div className="space-y-3">
              {teams.map((t) => {
                const teamPlayers = participants.filter((p) => p.teamId === t.id);
                return (
                  <Card key={t.id} className={`border-2 ${TEAM_STYLES[t.colorIndex % TEAM_STYLES.length]}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold">{t.name}</p>
                      {ctx.isAdmin && <Badge tone="slate">Σ {t.totalStrength}</Badge>}
                    </div>
                    <div className="space-y-1.5">
                      {teamPlayers.map((p) => (
                        <div key={p.userId} className="flex items-center gap-2">
                          <Avatar name={p.name} url={p.avatarUrl} size={28} />
                          <span className="flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{p.name}</span>
                          {ctx.isAdmin && match.status !== "finished" ? (
                            <SelectSubmit
                              action={movePlayerToTeamAction}
                              name="teamId"
                              value={t.id}
                              hidden={{ matchId: match.id, userId: p.userId }}
                              options={[...teams.map((tt) => ({ value: tt.id, label: tt.name })), { value: "", label: "Reserve" }]}
                            />
                          ) : (
                            <RatingDot rating={p.rating} reveal={ctx.isAdmin} showUnrated={ctx.isAdmin} />
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}

              {/* Reserves — confirmed players left without a team */}
              {reserves.length > 0 && (
                <Card className="border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-bold text-slate-600 dark:text-slate-300">Reserves · no team</p>
                    <Badge tone="slate">{reserves.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {reserves.map((p) => (
                      <div key={p.userId} className="flex items-center gap-2">
                        <Avatar name={p.name} url={p.avatarUrl} size={28} />
                        <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                        {ctx.isAdmin && match.status !== "finished" ? (
                          <SelectSubmit
                            action={movePlayerToTeamAction}
                            name="teamId"
                            value=""
                            hidden={{ matchId: match.id, userId: p.userId }}
                            options={[{ value: "", label: "Reserve" }, ...teams.map((tt) => ({ value: tt.id, label: `→ ${tt.name}` }))]}
                          />
                        ) : (
                          <RatingDot rating={p.rating} />
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
            {ctx.isAdmin && match.status !== "finished" && (
              <p className="mt-2 text-center text-xs text-slate-400">
                Use the dropdowns to move players between teams or bench them as reserves.
              </p>
            )}
          </section>
        )}

        {/* Scores */}
        {(teams.length > 0) && (
          <section>
            <SectionTitle>Scores & standings</SectionTitle>
            {standings.some((s) => s.played > 0) ? (
              <Card className="mb-3 p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs text-slate-500 dark:border-slate-800">
                      <th className="px-3 py-2">Team</th>
                      <th className="px-2 py-2 text-center">P</th>
                      <th className="px-2 py-2 text-center">W-D-L</th>
                      <th className="px-2 py-2 text-center">GD</th>
                      <th className="px-3 py-2 text-center">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.teamId} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
                        <td className="px-3 py-2 font-medium">
                          {i === 0 && s.played > 0 ? "🏆 " : `${i + 1}. `}{s.name}
                        </td>
                        <td className="px-2 py-2 text-center">{s.played}</td>
                        <td className="px-2 py-2 text-center">{s.wins}-{s.draws}-{s.losses}</td>
                        <td className="px-2 py-2 text-center">{s.goalDiff > 0 ? `+${s.goalDiff}` : s.goalDiff}</td>
                        <td className="px-3 py-2 text-center font-bold">{s.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : (
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">No games recorded yet.</p>
            )}

            {/* games list */}
            {games.length > 0 && (
              <div className="mb-3 space-y-2">
                {games.map((g) => (
                  <Card key={g.id} className="flex items-center justify-between py-2.5">
                    <span className="text-sm font-medium">{teamName.get(g.homeTeamId)}</span>
                    <span className="rounded-lg bg-slate-900 px-3 py-1 font-bold text-white dark:bg-slate-700">
                      {g.homeScore} – {g.awayScore}
                    </span>
                    <span className="text-sm font-medium">{teamName.get(g.awayTeamId)}</span>
                    {ctx.isAdmin && match.status !== "finished" && (
                      <InlineAction action={deleteGameAction} hidden={{ gameId: g.id, matchId: match.id }} className="btn-ghost btn-sm h-8 min-h-0 px-2" confirm="Remove this score?">✕</InlineAction>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {ctx.isAdmin && match.status !== "finished" && (
              <Card>
                <p className="mb-2 text-sm font-medium">Add a game result</p>
                <ActionForm action={saveGameAction} className="space-y-2" resetOnSuccess>
                  <input type="hidden" name="matchId" value={match.id} />
                  <div className="flex items-center gap-2">
                    <select name="homeTeamId" className="input min-h-0 h-10 flex-1" defaultValue="">
                      <option value="" disabled>Team 1</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <input name="homeScore" type="number" min={0} defaultValue={0} className="input min-h-0 h-10 w-16 text-center" />
                    <span className="text-slate-400">–</span>
                    <input name="awayScore" type="number" min={0} defaultValue={0} className="input min-h-0 h-10 w-16 text-center" />
                    <select name="awayTeamId" className="input min-h-0 h-10 flex-1" defaultValue="">
                      <option value="" disabled>Team 2</option>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <SubmitButton className="btn-primary w-full btn-sm" pendingText="Saving…">Save score</SubmitButton>
                </ActionForm>
              </Card>
            )}
          </section>
        )}

        {/* Participants */}
        <section>
          <SectionTitle>Participants</SectionTitle>
          <div className="space-y-3">
            <ParticipantList title="Confirmed" tone="green" rows={going} isAdmin={ctx.isAdmin} match={match} showRating />
            {waitlist.length > 0 && (
              <ParticipantList title="Waitlist" tone="blue" rows={waitlist} isAdmin={ctx.isAdmin} match={match} promote />
            )}
            {maybe.length > 0 && <ParticipantList title="Maybe" tone="amber" rows={maybe} isAdmin={ctx.isAdmin} match={match} />}
            {declined.length > 0 && <ParticipantList title="Can't make it" tone="red" rows={declined} isAdmin={ctx.isAdmin} match={match} />}
            {participants.length === 0 && <EmptyState title="No RSVPs yet" hint="Be the first to confirm." />}
          </div>
        </section>

        {/* Payments */}
        {match.pitchCost != null && (
          <section>
            <SectionTitle>Payments</SectionTitle>
            <Card className="p-0">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Cost per player</span>
                <span className="font-bold">{money(costPerPlayer)}</span>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {going.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={p.name} url={p.avatarUrl} size={32} />
                    <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                    {ctx.isAdmin ? (
                      <InlineAction
                        action={togglePaidAction}
                        hidden={{ matchId: match.id, participantId: p.participantId, paid: String(!p.paid) }}
                        className={`btn-sm ${p.paid ? "btn-primary" : "btn-ghost"}`}
                      >
                        {p.paid ? "Paid" : "Unpaid"}
                      </InlineAction>
                    ) : (
                      <Badge tone={p.paid ? "green" : "slate"}>{p.paid ? "Paid" : "Unpaid"}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        )}
      </div>
    </>
  );
}

function ParticipantList({
  title,
  tone,
  rows,
  isAdmin,
  match,
  showRating,
  promote,
}: {
  title: string;
  tone: "green" | "amber" | "red" | "blue";
  rows: ParticipantRow[];
  isAdmin: boolean;
  match: { id: string; status: string };
  showRating?: boolean;
  promote?: boolean;
}) {
  return (
    <Card className="p-0">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        <Badge tone={tone}>{rows.length}</Badge>
      </div>
      {rows.length > 0 && (
        <div className="divide-y divide-slate-50 border-t border-slate-100 dark:divide-slate-800/50 dark:border-slate-800">
          {rows.map((p) => (
            <div key={p.userId} className="flex items-center gap-3 px-4 py-2.5">
              <Avatar name={p.name} url={p.avatarUrl} size={32} />
              <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
              {showRating && <RatingDot rating={p.rating} reveal={isAdmin} showUnrated={isAdmin} />}
              {promote && isAdmin && match.status !== "finished" && (
                <InlineAction action={promoteWaitlistAction} hidden={{ matchId: match.id, participantId: p.participantId }} className="btn-accent btn-sm">
                  Promote
                </InlineAction>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
