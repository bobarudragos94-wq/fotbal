import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Multi-tenant football manager schema.
 * Tenant = location. Almost everything is scoped by `locationId`.
 *
 * Global roles live on `users.isSuperAdmin`.
 * Per-location roles live on `location_members.role` ("admin" | "player").
 */

const now = sql`(unixepoch())`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash").notNull(),
  isSuperAdmin: integer("is_super_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_idx").on(t.email),
}));

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // opaque random token, stored in cookie
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => ({
  userIdx: index("sessions_user_idx").on(t.userId),
}));

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  description: text("description"),
  inviteCode: text("invite_code").notNull(), // share/join code
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => ({
  inviteIdx: uniqueIndex("locations_invite_idx").on(t.inviteCode),
}));

/**
 * Membership of a user in a location, with per-location role and rating.
 * rating: 1..4 visual (1 = best). Internally converted to strength (1->4 ... 4->1).
 * status: "active" once approved.
 */
export const locationMembers = sqliteTable("location_members", {
  id: text("id").primaryKey(),
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["admin", "player"] }).notNull().default("player"),
  rating: integer("rating"), // 1..4, null = unrated
  status: text("status", { enum: ["active"] }).notNull().default("active"),
  joinedAt: integer("joined_at").notNull().default(now),
}, (t) => ({
  uniq: uniqueIndex("location_members_uniq").on(t.locationId, t.userId),
  locIdx: index("location_members_loc_idx").on(t.locationId),
}));

export const joinRequests = sqliteTable("join_requests", {
  id: text("id").primaryKey(),
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  message: text("message"),
  decidedBy: text("decided_by").references(() => users.id),
  createdAt: integer("created_at").notNull().default(now),
  decidedAt: integer("decided_at"),
}, (t) => ({
  uniqPending: index("join_requests_loc_user_idx").on(t.locationId, t.userId),
  statusIdx: index("join_requests_status_idx").on(t.locationId, t.status),
}));

/**
 * Proposed rating from community votes for an unrated player in a location.
 * Admin confirms -> writes back to location_members.rating.
 */
export const ratingVotes = sqliteTable("rating_votes", {
  id: text("id").primaryKey(),
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  targetUserId: text("target_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  voterUserId: text("voter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1..4
  createdAt: integer("created_at").notNull().default(now),
}, (t) => ({
  uniq: uniqueIndex("rating_votes_uniq").on(t.locationId, t.targetUserId, t.voterUserId),
  targetIdx: index("rating_votes_target_idx").on(t.locationId, t.targetUserId),
}));

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  locationId: text("location_id").notNull().references(() => locations.id, { onDelete: "cascade" }),
  title: text("title"),
  startsAt: integer("starts_at").notNull(),
  numTeams: integer("num_teams").notNull().default(2),
  playersPerTeam: integer("players_per_team").notNull().default(6),
  maxPlayers: integer("max_players").notNull().default(12),
  status: text("status", { enum: ["draft", "open", "locked", "finished"] }).notNull().default("draft"),
  pitchCost: real("pitch_cost"), // total, optional
  notes: text("notes"),
  teamsGeneratedAt: integer("teams_generated_at"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => ({
  locIdx: index("matches_loc_idx").on(t.locationId, t.startsAt),
}));

/**
 * RSVP + participation. status flow: going | maybe | declined | waitlist.
 * When locked, "going" rows are the final participants assigned to teams.
 */
export const matchParticipants = sqliteTable("match_participants", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["going", "maybe", "declined", "waitlist"] }).notNull(),
  // captured rating snapshot at lock time (used by balancing), null until locked
  ratingSnapshot: integer("rating_snapshot"),
  teamId: text("team_id"), // assigned team after generation
  rulesConfirmed: integer("rules_confirmed", { mode: "boolean" }).notNull().default(false),
  paid: integer("paid", { mode: "boolean" }).notNull().default(false),
  rsvpAt: integer("rsvp_at").notNull().default(now),
}, (t) => ({
  uniq: uniqueIndex("match_participants_uniq").on(t.matchId, t.userId),
  matchIdx: index("match_participants_match_idx").on(t.matchId),
}));

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // "Team A"
  colorIndex: integer("color_index").notNull().default(0),
  totalStrength: integer("total_strength").notNull().default(0),
}, (t) => ({
  matchIdx: index("teams_match_idx").on(t.matchId),
}));

export const matchGames = sqliteTable("match_games", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  homeTeamId: text("home_team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  awayTeamId: text("away_team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => ({
  matchIdx: index("match_games_match_idx").on(t.matchId),
}));

export const locationRules = sqliteTable("location_rules", {
  locationId: text("location_id").primaryKey().references(() => locations.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: integer("updated_at").notNull().default(now),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  locationId: text("location_id"),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  detail: text("detail"),
  createdAt: integer("created_at").notNull().default(now),
}, (t) => ({
  locIdx: index("audit_logs_loc_idx").on(t.locationId, t.createdAt),
}));

export type User = typeof users.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type LocationMember = typeof locationMembers.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type MatchGame = typeof matchGames.$inferSelect;
