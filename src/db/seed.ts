import "dotenv/config";
import { db } from "./index";
import {
  users,
  locations,
  locationMembers,
  locationRules,
  joinRequests,
  ratingVotes,
  matches,
  matchParticipants,
  teams,
  matchGames,
} from "./schema";
import bcrypt from "bcryptjs";
import { newId, inviteCode } from "../lib/ids";

const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
import { generateBalancedTeams, TEAM_NAMES, type BalancePlayer } from "../lib/teams";

/**
 * Seed demo data. Safe to re-run: it wipes the tables it owns first.
 * Run with: npm run db:seed
 */

const SUPER_EMAIL = process.env.SEED_SUPERADMIN_EMAIL ?? "bobarudragos94@gmail.com";
const SUPER_PASS = process.env.SEED_SUPERADMIN_PASSWORD ?? "noobsaibot";
const SUPER_NICK = process.env.SEED_SUPERADMIN_NICKNAME ?? "Dragos";
const DEMO_PASS = "player1234";

async function wipe() {
  // children first
  await db.delete(matchGames);
  await db.delete(teams);
  await db.delete(matchParticipants);
  await db.delete(matches);
  await db.delete(ratingVotes);
  await db.delete(joinRequests);
  await db.delete(locationRules);
  await db.delete(locationMembers);
  await db.delete(locations);
  await db.delete(users);
}

async function mkUser(name: string, nickname: string, email: string, password: string, isSuperAdmin = false) {
  const id = newId();
  await db.insert(users).values({
    id,
    name,
    nickname,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    isSuperAdmin,
  });
  return id;
}

async function main() {
  console.log("Seeding database…");
  await wipe();

  // --- Super admin (also a player, see Pipera membership below) ---
  const superId = await mkUser("Dragos", SUPER_NICK, SUPER_EMAIL, SUPER_PASS, true);

  // --- Demo players (shared pool of people) ---
  const names = [
    "Andrei Popescu", "Mihai Ionescu", "Alex Dumitru", "Cristian Stan", "George Marin",
    "Vlad Constantin", "Radu Gheorghe", "Bogdan Matei", "Stefan Nistor", "Cosmin Toma",
    "Ionut Barbu", "Razvan Lupu", "Daniel Sava", "Florin Dinu", "Marius Olaru",
    "Paul Vasile", "Adrian Tudor", "Sorin Pana", "Catalin Voicu", "Lucian Ene",
  ];
  const playerIds: Record<string, string> = {};
  for (let i = 0; i < names.length; i++) {
    const email = `player${i + 1}@fgm.app`;
    const nick = names[i].split(" ")[0]; // demo nickname = first name
    playerIds[names[i]] = await mkUser(names[i], nick, email, DEMO_PASS);
  }

  // --- Locations ---
  async function mkLocation(name: string, address: string, description: string, rules: string) {
    const id = newId();
    await db.insert(locations).values({
      id, name, address, description, inviteCode: inviteCode(), createdBy: superId,
    });
    await db.insert(locationRules).values({ locationId: id, content: rules, updatedBy: superId });
    return id;
  }

  const rulesText = `- No slide tackles
- Any hand contact is a handball
- Call your own fouls
- Keeper stays in the box
- Whoever kicks the ball out fetches it
- Don't argue every call
- More than 10 min late may lose your spot`;

  const pipera = await mkLocation("Teren Pipera", "Str. Pipera 1, Bucuresti", "Friday night 6-a-side, 3 teams.", rulesText);
  const militari = await mkLocation("Teren Militari", "Bd. Iuliu Maniu, Bucuresti", "Sunday morning kickabout.", rulesText);
  const titan = await mkLocation("Teren Titan", "Parcul Titan, Bucuresti", "Midweek 5-a-side.", rulesText);

  // membership helper
  async function addMember(locationId: string, userId: string, role: "admin" | "player", rating: number | null) {
    await db.insert(locationMembers).values({ id: newId(), locationId, userId, role, rating });
  }

  // ---------- Pipera: full setup with a finished match ----------
  // First two players are admins here.
  const pip = names.slice(0, 18); // 18 players
  const ratingsPip: Record<string, number> = {};
  pip.forEach((nm, i) => {
    // spread ratings 1..4
    ratingsPip[nm] = ((i % 4) + 1);
  });
  // Make one player unrated to demo voting (last one)
  const unratedName = pip[17];

  for (let i = 0; i < pip.length; i++) {
    const nm = pip[i];
    const role = i < 2 ? "admin" : "player";
    const rating = nm === unratedName ? null : ratingsPip[nm];
    await addMember(pipera, playerIds[nm], role, rating);
  }
  // The super admin is ALSO a player at Pipera (global super powers + plays here).
  await addMember(pipera, superId, "player", 2);

  // votes for the unrated player (proposes ~2)
  for (const voter of [pip[2], pip[3], pip[4]]) {
    await db.insert(ratingVotes).values({
      id: newId(), locationId: pipera, targetUserId: playerIds[unratedName],
      voterUserId: playerIds[voter], rating: voter === pip[3] ? 3 : 2,
    });
  }

  // A finished match (last week) with teams + scores
  const finishedStart = Math.floor(Date.now() / 1000) - 5 * 86400;
  const finishedId = newId();
  await db.insert(matches).values({
    id: finishedId, locationId: pipera, title: "Last Friday", startsAt: finishedStart,
    numTeams: 3, playersPerTeam: 6, maxPlayers: 18, status: "finished",
    pitchCost: 360, createdBy: playerIds[pip[0]], teamsGeneratedAt: finishedStart,
  });
  // 18 confirmed players (exclude the unrated one for a clean balanced match -> use first 18 rated)
  const finishedPlayers = pip.filter((nm) => nm !== unratedName); // 17 rated
  // add the unrated as rating-snapshot 2 for this past match so it balances
  const balanceInput: BalancePlayer[] = pip.map((nm) => ({
    userId: playerIds[nm],
    rating: ratingsPip[nm] ?? 2,
  }));
  const balanced = generateBalancedTeams(balanceInput, 3);

  const teamIdByIndex: string[] = [];
  for (const t of balanced.teams) {
    const tid = newId();
    teamIdByIndex[t.index] = tid;
    await db.insert(teams).values({
      id: tid, matchId: finishedId, name: `Team ${TEAM_NAMES[t.index]}`,
      colorIndex: t.index, totalStrength: t.totalStrength,
    });
  }
  // participants with team assignment + paid status + rules confirmed
  for (let ti = 0; ti < balanced.teams.length; ti++) {
    const t = balanced.teams[ti];
    for (const uid of t.playerIds) {
      await db.insert(matchParticipants).values({
        id: newId(), matchId: finishedId, userId: uid, status: "going",
        ratingSnapshot: 2, teamId: teamIdByIndex[t.index], rulesConfirmed: true,
        paid: Math.random() > 0.3,
      });
    }
  }
  // round-robin scores: A vs B, A vs C, B vs C
  const [A, B, C] = teamIdByIndex;
  await db.insert(matchGames).values([
    { id: newId(), matchId: finishedId, homeTeamId: A, awayTeamId: B, homeScore: 3, awayScore: 2 },
    { id: newId(), matchId: finishedId, homeTeamId: A, awayTeamId: C, homeScore: 1, awayScore: 1 },
    { id: newId(), matchId: finishedId, homeTeamId: B, awayTeamId: C, homeScore: 2, awayScore: 0 },
  ]);

  // An upcoming OPEN match accepting RSVPs (with a waitlist demo)
  const upStart = Math.floor(Date.now() / 1000) + 3 * 86400;
  const upId = newId();
  await db.insert(matches).values({
    id: upId, locationId: pipera, title: "This Friday", startsAt: upStart,
    numTeams: 3, playersPerTeam: 6, maxPlayers: 18, status: "open",
    pitchCost: 360, notes: "Bring light & dark shirts.", createdBy: playerIds[pip[0]],
  });
  // 18 going + 2 waitlist (use all 18 pip + 2 extra from names[18..19])
  let order = Date.now();
  for (let i = 0; i < pip.length; i++) {
    await db.insert(matchParticipants).values({
      id: newId(), matchId: upId, userId: playerIds[pip[i]], status: "going",
      rsvpAt: Math.floor((order += 1000) / 1000), rulesConfirmed: i % 2 === 0,
    });
  }
  for (const extra of names.slice(18, 20)) {
    // they must be members to RSVP — add them as players
    await addMember(pipera, playerIds[extra], "player", 2);
    await db.insert(matchParticipants).values({
      id: newId(), matchId: upId, userId: playerIds[extra], status: "waitlist",
      rsvpAt: Math.floor((order += 1000) / 1000),
    });
  }

  // ---------- Militari: smaller squad, one open match, a couple unrated ----------
  const mil = names.slice(5, 15); // 10 players
  for (let i = 0; i < mil.length; i++) {
    const role = i === 0 ? "admin" : "player";
    const rating = i >= 8 ? null : ((i % 4) + 1); // last two unrated
    await addMember(militari, playerIds[mil[i]], role, rating);
  }
  const milMatch = newId();
  await db.insert(matches).values({
    id: milMatch, locationId: militari, title: "Sunday AM", startsAt: Math.floor(Date.now() / 1000) + 5 * 86400,
    numTeams: 2, playersPerTeam: 5, maxPlayers: 10, status: "open", pitchCost: 200,
    createdBy: playerIds[mil[0]],
  });
  for (let i = 0; i < 7; i++) {
    await db.insert(matchParticipants).values({
      id: newId(), matchId: milMatch, userId: playerIds[mil[i]], status: i < 5 ? "going" : "maybe",
    });
  }

  // ---------- Titan: just an admin + a pending join request ----------
  await addMember(titan, playerIds[names[2]], "admin", 1);
  await addMember(titan, playerIds[names[3]], "player", 2);
  // pending request from someone not in titan
  await db.insert(joinRequests).values({
    id: newId(), locationId: titan, userId: playerIds[names[6]], status: "pending",
    message: "Hey, can I join the Tuesday games?",
  });

  // print invite codes
  const allLoc = await db.select().from(locations);
  console.log("\n✅ Seed complete.\n");
  console.log("Super admin (also a player at Teren Pipera):");
  console.log(`  ${SUPER_EMAIL} / ${SUPER_PASS}  (nickname: ${SUPER_NICK})`);
  console.log("\nDemo players (password: " + DEMO_PASS + "):");
  console.log(`  player1@fgm.app … player20@fgm.app`);
  console.log(`  player1 & player2 are admins of Teren Pipera`);
  console.log(`  player6 is admin of Teren Militari`);
  console.log(`  player3 is admin of Teren Titan`);
  console.log("\nLocations & invite codes:");
  for (const l of allLoc) console.log(`  ${l.name.padEnd(16)} ${l.inviteCode}`);
  console.log("");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
