/**
 * Standings computation from played games.
 * Win = 3 pts, draw = 1, loss = 0. Ranked by points, then goal difference, then goals for.
 */

export type GameInput = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
};

export type TeamRow = {
  teamId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
};

export function computeStandings(teamIds: string[], games: GameInput[]): TeamRow[] {
  const table = new Map<string, TeamRow>();
  for (const id of teamIds) {
    table.set(id, {
      teamId: id,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const g of games) {
    const home = table.get(g.homeTeamId);
    const away = table.get(g.awayTeamId);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += g.homeScore;
    home.goalsAgainst += g.awayScore;
    away.goalsFor += g.awayScore;
    away.goalsAgainst += g.homeScore;

    if (g.homeScore > g.awayScore) {
      home.wins++;
      home.points += 3;
      away.losses++;
    } else if (g.homeScore < g.awayScore) {
      away.wins++;
      away.points += 3;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
      home.points += 1;
      away.points += 1;
    }
  }

  const rows = [...table.values()];
  for (const r of rows) r.goalDiff = r.goalsFor - r.goalsAgainst;
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor
  );
  return rows;
}
