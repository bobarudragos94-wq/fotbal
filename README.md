# ⚽ Football Group Manager

A modern, mobile-first **PWA** for organizing recurring football matches among groups of friends.
Each **location is a fully isolated tenant** — its own players, admins, rules, matches, scores and history.

> Stack: **Next.js 14 (App Router)** · **Turso / libSQL** + **Drizzle ORM** · **Tailwind CSS** · custom session auth · deployed on **Vercel**.

---

## Table of contents

1. [Architecture](#1-architecture)
2. [Database schema](#2-database-schema)
3. [Main flows](#3-main-flows)
4. [Page structure](#4-page-structure)
5. [Team-balancing algorithm](#5-team-balancing-algorithm)
6. [Core UI components](#6-core-ui-components)
7. [Local development](#7-local-development)
8. [Turso / libSQL setup](#8-turso--libsql-setup)
9. [Deploy to Vercel](#9-deploy-to-vercel)
10. [Seed data & demo accounts](#10-seed-data--demo-accounts)
11. [Security model](#11-security-model)

---

## 1. Architecture

```
Browser (PWA, installable)
   │  service worker (offline shell)  ── public/sw.js + public/manifest.json
   ▼
Next.js App Router (Vercel, Node runtime)
   ├─ Server Components ........ read data directly via Drizzle (per-request)
   ├─ Server Actions ("use server") .. all mutations, with server-side permission guards
   └─ Client Components ........ only where interactivity is needed
         (bottom nav, theme toggle, form state, select-submit)
   ▼
Drizzle ORM ──► @libsql/client ──► Turso / libSQL (SQLite)
```

Key design decisions:

- **No REST layer.** Reads happen in server components (`src/lib/queries.ts`); writes are
  **Server Actions** (`src/app/actions/*`). Every action re-checks permissions on the server —
  the UI never decides authorization.
- **Tenant isolation by `location_id`.** Access is resolved through
  `src/lib/permissions.ts` + `src/lib/locationContext.ts`. A user can be a *player* in one
  location and an *admin* in another; ratings, rules and matches are all per-location.
- **Sessions in the DB** (opaque token in an httpOnly cookie) — simple, revocable, serverless-friendly.
- **Mobile-first** app shell (`max-w-app`, bottom navigation, 44px touch targets, safe-area insets).

### Folder layout

```
src/
  app/
    page.tsx                       Landing
    login/ register/               Auth pages
    app/                           Player home shell  (My Locations, Join, Profile)
    loc/[locationId]/              Location tenant area (matches, rules, stats, rate, admin/*)
      m/[matchId]/                 Match detail (RSVP, teams, scores, payments) — role-aware
      admin/                       Location-admin pages (pending, players, ratings, rules, new-match)
    super/                         Super-admin area (locations, users, pending)
    actions/                       Server Actions: auth, locations, ratings, matches
  components/                      UI kit + nav + forms (server- and client-safe)
  db/
    schema.ts                      Drizzle schema (source of truth)
    index.ts                       libSQL client
    seed.ts                        Demo data
  lib/
    auth.ts permissions.ts page.ts locationContext.ts
    teams.ts                       Balancing algorithm
    standings.ts                   Points / goal difference
    rating.ts queries.ts format.ts ids.ts actionResult.ts
public/  manifest.json  sw.js  icons/
```

---

## 2. Database schema

SQLite/libSQL via Drizzle (`src/db/schema.ts`). Timestamps are unix seconds.

| Table | Purpose |
|-------|---------|
| `users` | Global accounts. `is_super_admin` is the only global role. |
| `sessions` | DB-backed auth sessions (cookie token → user). |
| `locations` | Tenants. Has a shareable `invite_code`. |
| `location_members` | **User ↔ location** with per-location `role` (admin/player) and per-location `rating` (1–4, null = unrated). |
| `join_requests` | Pending/approved/rejected requests to join a location. |
| `rating_votes` | Community votes (1–4) for an unrated player; one row per voter/target. |
| `matches` | Per-location match: time, `num_teams`, `players_per_team`, `max_players`, status, pitch cost, notes. |
| `match_participants` | RSVP rows (going/maybe/declined/waitlist) + `team_id`, `rules_confirmed`, `paid`, `rating_snapshot`. |
| `teams` | Generated teams for a match (`total_strength`, color). |
| `match_games` | Individual game scores within a match (team vs team). |
| `location_rules` | Editable house rules per location (versioned). |
| `audit_logs` | Optional action log (joins, approvals, admin grants…). |

**Schema notes / simplifications (no overengineering):** the spec's separate `player_ratings`
table is folded into `location_members.rating` (rating *is* per-location); `rule_confirmations`
and `payments` are folded into `match_participants` (`rules_confirmed`, `paid`) since they are
1:1 with a participant. Everything else maps 1:1 to the requested tables.

Relationships: a user → many locations; a match → many participants/teams/games;
all match/score/rule/payment queries are filtered by `location_id` (directly or via the match).

---

## 3. Main flows

**Register → join → approved**
1. Sign up (`/register`).
2. Join a location via invite code or the browse list (`/app/join`) → creates a `join_request`.
3. A location admin approves on `…/admin/pending` → a `location_member` (player) is created.

**Rating an unrated player**
1. New players start `Unrated`.
2. Approved members vote 1–4 on `…/rate` (`rating_votes`).
3. Admin sees the proposed rating (avg/median) on `…/admin/ratings` and confirms a final value,
   which writes `location_members.rating` and clears the votes.

**Match day**
1. Admin creates a match (`…/admin/new-match`) → status `open`, setting **max players** and **number of teams**.
2. Players RSVP on the match page (Going / Maybe / Can't). When `going` hits `max_players`,
   further "Going" RSVPs auto-go to the **waitlist**; a player can withdraw at any time and the
   first waitlisted player is auto-promoted (admin can also promote manually).
3. Players confirm "I've read the rules".
4. Admin **locks the list** when it's final → the match becomes `locked` and the **rating vote opens**
   on the match page for any unrated confirmed players.
5. Everyone votes 1–4 on unrated players; the admin **confirms each final rating**. Once all confirmed
   players are rated, the admin **closes the vote & generates teams**.
6. **Equal teams:** team size = `min(playersPerTeam, floor(confirmed / numTeams))`, so e.g. 16 confirmed
   with 3 teams → **3 × 5** and the app lists who is left **without a team (Reserves)**. The admin can
   move players between teams or bench/un-bench reserves, and **regenerate** for a fresh fair split.
7. Admin enters game scores → standings (points, goal difference) compute live.
8. Admin tracks **payments** (cost/player auto-computed) and marks the match **finished**.

---

## 4. Page structure

**Public:** `/` landing · `/login` · `/register`

**Player (`/app`, `/loc/[id]`):** My Locations · Join Location · Profile ·
Location matches list · Match details (RSVP, waitlist status, teams, scores, payments) ·
Rules · Rate players · My stats.

**Location Admin (`/loc/[id]/admin`):** Dashboard · Pending players · Players (set rating) ·
Ratings (confirm votes) · Create match · Match setup · everything on the match page
(lock, generate/regenerate, manual team editor, enter scores, waitlist, payments) · Rules editor.

**Super Admin (`/super`):** Overview · Locations (create/edit/delete) · Manage location admins
(promote/revoke) · All users · Global pending requests.

---

## 5. Team-balancing algorithm

`src/lib/teams.ts`. Visual rating is **1 = best … 4 = weakest**, inverted to *strength* for math:

```
rating 1 → strength 4
rating 2 → strength 3
rating 3 → strength 2
rating 4 → strength 1
```

**Controlled randomization, equal team sizes** (not pure random):

1. Convert every player's rating to strength.
2. Team size = `min(playersPerTeam, floor(confirmed / numTeams))` → teams come out **equal**;
   any extra confirmed players become **reserves (no team)**, which the app reports by name.
3. Generate ~800 random candidate splits. Each candidate shuffles players, randomly picks which
   `teamSize × numTeams` play (the rest are that candidate's leftovers), then greedily assigns the
   strongest remaining player to the currently weakest team.
4. Score each candidate by **spread** = `max(team strength) − min(team strength)`.
5. Keep the best-spread candidates and pick one **at random** among them.

→ Teams are always equal-sized and near-balanced (spread typically 0–2), and **Regenerate** yields a
fresh but still fair split. Examples: 18 players / 3 teams → `3 × 6` (no reserves);
16 players / 3 teams → `3 × 5`, with 1 player listed under **Reserves**.

Scoring/standings (`src/lib/standings.ts`): win = 3, draw = 1, loss = 0; ranked by points,
then goal difference, then goals for.

---

## 6. Core UI components

`src/components/` — a small, consistent kit:

- **`ui.tsx`** — `Card`, `Badge`/`StatusBadge`, `Avatar`, `RatingDot`, `LinkCard`, `EmptyState`, headers.
- **`BottomNav.tsx`** — fixed mobile bottom navigation (icons passed by name to stay server→client safe).
- **`AppBar.tsx`** — sticky top bar with back button + `ThemeToggle`.
- **`Form.tsx`** — `ActionForm` (server-action form with inline success/error), `SubmitButton`
  (pending state via `useFormStatus`), `InlineAction` (one-tap action buttons, optional confirm).
- **`SelectSubmit.tsx`** — a `<select>` that submits on change (rating / move-player).
- **`ThemeToggle.tsx`** — optional dark mode (class strategy, persisted, no flash).
- **`icons.tsx`** — inline SVG icon set (no emoji icons).

Design tokens (`tailwind.config.ts` / `globals.css`): pitch-green **brand** primary, **amber**
accent for ratings/CTAs, slate base, Inter font, rounded-2xl cards, 150–300ms transitions.

---

## 7. Local development

```bash
npm install

# Use a local SQLite file for dev:
echo 'TURSO_DATABASE_URL="file:./local.db"' > .env

npm run db:push     # create tables from the Drizzle schema
npm run db:seed     # load demo data (prints accounts + invite codes)
npm run dev         # http://localhost:3000
```

Scripts: `dev` · `build` · `start` · `db:push` · `db:generate` · `db:seed`.

---

## 8. Turso / libSQL setup

```bash
# Install the CLI (https://docs.turso.tech)
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# Create the database
turso db create football-group-manager
turso db show football-group-manager --url        # → TURSO_DATABASE_URL
turso db tokens create football-group-manager     # → TURSO_AUTH_TOKEN
```

Put both in `.env`, then create the tables and seed:

```bash
npm run db:push
npm run db:seed
```

(`drizzle.config.ts` uses `dialect: "turso"`; `npm run db:generate` produces SQL migrations
in `./drizzle` if you prefer migrations over `push`.)

---

## 9. Deploy to Vercel

1. Push this repo to GitHub and **Import** it in Vercel (framework auto-detected as Next.js).
2. Add **Environment Variables** (Production + Preview):

   | Key | Value |
   |-----|-------|
   | `TURSO_DATABASE_URL` | `libsql://<your-db>.turso.io` |
   | `TURSO_AUTH_TOKEN` | token from `turso db tokens create` |
   | `SESSION_SECRET` | `openssl rand -base64 32` |

3. **Deploy.** Run `npm run db:push` once (locally, pointed at the Turso URL) to create the
   schema, and optionally `npm run db:seed`.
4. Open the app on your phone → browser menu → **Add to Home Screen** to install the PWA.

No extra config needed — it runs on Vercel's default Node serverless runtime.

---

## 10. Seed data & demo accounts

`npm run db:seed` creates:

**Super admin** — `admin@fgm.app` / `admin1234` (override via `SEED_SUPERADMIN_*` env).

**Players** — `player1@fgm.app … player20@fgm.app`, password `player1234`:
- `player1` & `player2` → **admins of Teren Pipera**
- `player6` → admin of Teren Militari
- `player3` → admin of Teren Titan

**Locations** (each isolated; invite codes printed on seed):
- **Teren Pipera** — full demo: 18+ players, a **finished** match (3×6) with generated teams,
  round-robin scores & standings, payments; plus an **open** match with a live waitlist and an
  unrated player with community votes to confirm.
- **Teren Militari** — 10 players (a couple unrated), one open 2×5 match.
- **Teren Titan** — admin + a pending join request to approve.

---

## 11. Security model

- Players can't see data for locations they aren't approved in (`loadLocationContext` redirects).
- Location admins can only manage **their** location; cross-location writes are rejected
  (`assertLocationAdmin`). Super admin can do everything.
- **All** create/edit/delete actions are Server Actions that re-validate the session **and**
  the caller's role for the target `location_id` — the UI is never the source of truth for auth.
- Passwords hashed with bcrypt; sessions are httpOnly, `secure` in production, and revocable.

---

Built clean and easy to extend. Not implemented by design (out of MVP scope): online payments,
chat, push notifications, native apps.
