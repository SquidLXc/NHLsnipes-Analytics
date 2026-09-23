import {
  GetAuditResponse,
  GetDashboardSummaryResponse,
  GetGameResponse,
  GetGamesResponse,
  GetGoaliesResponse,
  GetLiveAlertsResponse,
  GetMatchupResponse,
  GetMatchupsResponse,
  GetModelPerformanceResponse,
  GetOddsResponse,
  GetPlayerResponse,
  GetPlayersResponse,
  GetPropsByMarketResponse,
  GetPropsResponse,
  GetSnipesResponse,
  GetTeamResponse,
  GetTeamsResponse,
} from "@workspace/api-zod";
import { db, gamesTable, playersTable, teamsTable } from "@workspace/db";
import { z } from "zod";

export type ProviderData = {
  dashboard: z.infer<typeof GetDashboardSummaryResponse>;
  games: z.infer<typeof GetGamesResponse>;
  game: z.infer<typeof GetGameResponse>;
  matchup: z.infer<typeof GetMatchupResponse>;
  players: z.infer<typeof GetPlayersResponse>;
  player: z.infer<typeof GetPlayerResponse>;
  teams: z.infer<typeof GetTeamsResponse>;
  team: z.infer<typeof GetTeamResponse>;
  goalies: z.infer<typeof GetGoaliesResponse>;
  props: z.infer<typeof GetPropsResponse>;
  propsByMarket: z.infer<typeof GetPropsByMarketResponse>;
  matchups: z.infer<typeof GetMatchupsResponse>;
  odds: z.infer<typeof GetOddsResponse>;
  snipes: z.infer<typeof GetSnipesResponse>;
  audit: z.infer<typeof GetAuditResponse>;
  performance: z.infer<typeof GetModelPerformanceResponse>;
  liveAlerts: z.infer<typeof GetLiveAlertsResponse>;
};

export type SyncReport = {
  provider: string;
  startedAt: string;
  completedAt: string;
  teamsImported: number;
  gamesImported: number;
  playersImported: number;
  playerStatsImported: number;
  goalieStatsImported: number;
  errors: string[];
};

export type DataHealth = {
  provider: string;
  connection: "connected" | "error" | "not configured";
  lastSuccessfulSync: string | null;
  lastAttemptedSync: string | null;
  teamsImported: number;
  gamesImported: number;
  playersImported: number;
  playerStatsImported: number;
  goalieStatsImported: number;
  errors: string[];
};

export interface NhlDataProvider {
  readonly name: string;
  getDashboard(): Promise<ProviderData["dashboard"]>;
  getGames(date?: string): Promise<ProviderData["games"]>;
  getFutureGames(): Promise<ProviderData["games"]>;
  getLiveAlerts(): Promise<ProviderData["liveAlerts"]>;
  getGame(gameId: string): Promise<ProviderData["game"] | null>;
  getMatchup(gameId: string): Promise<ProviderData["matchup"] | null>;
  getPlayers(search?: string, team?: string): Promise<ProviderData["players"]>;
  getPlayer(playerId: string): Promise<ProviderData["player"] | null>;
  getTeams(): Promise<ProviderData["teams"]>;
  getTeam(teamId: string): Promise<ProviderData["team"] | null>;
  getGoalies(): Promise<ProviderData["goalies"]>;
  getProps(market?: string): Promise<ProviderData["props"]>;
  getPropsByMarket(market: string): Promise<ProviderData["propsByMarket"]>;
  getMatchups(): Promise<ProviderData["matchups"]>;
  getOdds(): Promise<ProviderData["odds"]>;
  getSnipes(market?: string): Promise<ProviderData["snipes"]>;
  getAudit(): Promise<ProviderData["audit"]>;
  getPerformance(): Promise<ProviderData["performance"]>;
  sync(): Promise<SyncReport>;
}

type ZodSchema<T> = { parse: (value: unknown) => T };
type RawTeam = {
  id?: number;
  abbrev?: string;
  logo?: string;
  darkLogo?: string;
  name?: { default?: string };
  commonName?: { default?: string };
  placeName?: { default?: string };
  teamName?: { default?: string };
  teamAbbrev?: { default?: string };
  teamLogo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  conferenceName?: string;
  divisionName?: string;
};
type RawGame = {
  id: number | string;
  gameDate?: string;
  startTimeUTC?: string;
  venue?: { default?: string };
  gameState?: string;
  awayTeam: RawTeam & { score?: number };
  homeTeam: RawTeam & { score?: number };
};
type RawGoal = {
  eventId?: number;
  playerId?: number;
  firstName?: { default?: string };
  lastName?: { default?: string };
  name?: { default?: string };
  teamAbbrev?: string;
  sweaterNumber?: number;
  headshot?: string;
  timeInPeriod?: string;
  awayScore?: number;
  homeScore?: number;
  strength?: string;
};
type RawGameLanding = RawGame & {
  summary?: {
    scoring?: Array<{
      periodDescriptor?: {
        number?: number;
        periodType?: string;
      };
      goals?: RawGoal[];
    }>;
  };
};
type RawOddsEvent = {
  id: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers?: Array<{
    key?: string;
    title?: string;
    last_update?: string;
    markets?: Array<{
      key?: string;
      outcomes?: Array<{ name?: string; price?: number; point?: number }>;
    }>;
  }>;
};
type RawPlayer = {
  id: number;
  firstName?: { default?: string };
  lastName?: { default?: string };
  headshot?: string;
  sweaterNumber?: number;
  positionCode?: string;
  position?: string;
};
type NormalizedTeam = z.infer<typeof GetTeamsResponse>[number];

const NHL_API_BASE_URL =
  process.env.NHLSNIPES_NHL_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api-web.nhle.com/v1";
const ASSET_BASE_URL =
  process.env.NHLSNIPES_ASSET_BASE_URL?.replace(/\/$/, "") || null;
const NHL_SEASON_START_DATE =
  process.env.NHLSNIPES_SEASON_START_DATE || "2026-09-29";
const INCLUDE_PRESEASON =
  process.env.NHLSNIPES_INCLUDE_PRESEASON !== "false";
const syncHealth: DataHealth = {
  provider: "NHL Web API",
  connection: "connected",
  lastSuccessfulSync: null,
  lastAttemptedSync: null,
  teamsImported: 0,
  gamesImported: 0,
  playersImported: 0,
  playerStatsImported: 0,
  goalieStatsImported: 0,
  errors: [],
};

const teamCache = new Map<string, ProviderData["teams"][number]>();
let playersCache: ProviderData["players"] | null = null;
let playersCacheAt = 0;
let oddsCache: { expiresAt: number; data: ProviderData["odds"] } | null = null;

function text(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function canonicalTeamName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
}

function assetUrl(value?: string) {
  const reference = value?.trim();
  if (!reference) return null;
  if (/^https?:\/\//i.test(reference)) return reference;
  if (!ASSET_BASE_URL) return null;
  return `${ASSET_BASE_URL}/${reference.replace(/^\/+/, "")}`;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateOnly(date);
}

function status(value?: string): "scheduled" | "live" | "final" | "postponed" | "unknown" {
  if (value === "FUT" || value === "PRE") return "scheduled";
  if (value === "LIVE" || value === "CRIT") return "live";
  if (value === "OFF" || value === "FINAL") return "final";
  if (value === "PPD") return "postponed";
  return "unknown";
}

function periodLabel(number: number, periodType?: string) {
  if (periodType === "OT") return "OT";
  if (periodType === "SO") return "SO";
  if (number === 1) return "1st";
  if (number === 2) return "2nd";
  if (number === 3) return "3rd";
  return `P${number}`;
}

function teamFromRaw(raw: RawTeam, fallbackId?: string): NormalizedTeam {
  const abbreviation = text(raw.abbrev || raw.teamAbbrev?.default, "UNK");
  const existing = teamCache.get(abbreviation);
  const id = existing?.id ?? String(raw.id ?? fallbackId ?? abbreviation);
  const name = text(
    raw.teamName?.default || raw.name?.default,
    text(raw.commonName?.default, text(raw.placeName?.default, abbreviation)),
  );
  const team: NormalizedTeam = {
    id,
    name,
    city: raw.placeName?.default ?? null,
    abbreviation,
    conference: raw.conferenceName ?? null,
    division: raw.divisionName ?? null,
    logoUrl: assetUrl(raw.logo || raw.teamLogo || raw.darkLogo),
    primaryColor: raw.primaryColor ?? null,
    secondaryColor: raw.secondaryColor ?? null,
  };
  teamCache.set(id, team);
  teamCache.set(abbreviation, team);
  return team;
}

function gameFromRaw(raw: RawGame) {
  const awayTeam = teamFromRaw(raw.awayTeam);
  const homeTeam = teamFromRaw(raw.homeTeam);
  return {
    id: String(raw.id),
    gameDate: raw.startTimeUTC || `${raw.gameDate}T00:00:00Z`,
    awayTeam,
    homeTeam,
    venue: raw.venue?.default ?? null,
    status: status(raw.gameState),
    statusDetail: raw.gameState ?? null,
    matchupScore:
      typeof raw.awayTeam.score === "number" && typeof raw.homeTeam.score === "number"
        ? raw.awayTeam.score + raw.homeTeam.score
        : null,
    goalEnvironment: null,
    shotEnvironment: null,
    powerPlayEdge: null,
    goaltendingEdge: null,
  };
}

class NhlWebApiProvider implements NhlDataProvider {
  readonly name = "NHL Web API";

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${NHL_API_BASE_URL}/${path.replace(/^\//, "")}`, {
      headers: { accept: "application/json", "user-agent": "NHLsnipes/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`NHL Web API returned HTTP ${response.status} for ${path}`);
    return (await response.json()) as T;
  }

  private async loadTeams() {
    const raw = await this.fetchJson<{ standings?: RawTeam[] }>("standings/now");
    for (const standing of raw.standings ?? []) teamFromRaw(standing);
    return Array.from(new Map(Array.from(teamCache.values()).map((team) => [team.id, team])).values());
  }

  private async loadPlayers() {
    if (playersCache && Date.now() - playersCacheAt < 300_000) return playersCache;
    const teams = await this.loadTeams();
    const rosters = await Promise.all(
      teams.map(async (team) => {
        try {
          const raw = await this.fetchJson<{ forwards?: RawPlayer[]; defensemen?: RawPlayer[]; goalies?: RawPlayer[] }>(
            `roster/${team.abbreviation}/current`,
          );
          return [...(raw.forwards ?? []), ...(raw.defensemen ?? []), ...(raw.goalies ?? [])].map((player) => ({
            id: String(player.id),
            firstName: text(player.firstName?.default, ""),
            lastName: text(player.lastName?.default, ""),
            fullName: `${text(player.firstName?.default, "")} ${text(player.lastName?.default, "")}`.trim(),
            teamId: team.id,
            team,
            position: text(player.positionCode || player.position, "—"),
            jerseyNumber: player.sweaterNumber ?? null,
            headshotUrl: assetUrl(player.headshot),
          }));
        } catch {
          return [];
        }
      }),
    );
    playersCache = GetPlayersResponse.parse(
      Array.from(new Map(rosters.flat().map((player) => [player.id, player])).values()),
    );
    playersCacheAt = Date.now();
    return playersCache;
  }

  async getTeams() {
    return GetTeamsResponse.parse(await this.loadTeams());
  }

  async getGames(date?: string) {
    const raw = await this.fetchJson<{ games?: RawGame[] }>(date ? `score/${date}` : "score/now");
    const verifiedGames = (raw.games ?? []).filter((game) => {
      const gameDate = (game.gameDate || game.startTimeUTC || "").slice(0, 10);
      return INCLUDE_PRESEASON || gameDate >= NHL_SEASON_START_DATE;
    });
    return GetGamesResponse.parse(verifiedGames.map(gameFromRaw));
  }

  async getFutureGames() {
    const today = dateOnly(new Date());
    const firstDate = INCLUDE_PRESEASON
      ? addDays(today, 1)
      : today >= NHL_SEASON_START_DATE
        ? addDays(today, 1)
        : NHL_SEASON_START_DATE;
    for (let offset = 0; offset < 14; offset += 1) {
      const games = await this.getGames(addDays(firstDate, offset));
      if (games.length) return games;
    }
    return GetGamesResponse.parse([]);
  }

  async getLiveAlerts() {
    const liveGames = (await this.getGames()).filter((game) => game.status === "live");
    if (!liveGames.length) {
      return GetLiveAlertsResponse.parse({
        state: "waiting",
        updatedAt: new Date().toISOString(),
        alerts: [],
      });
    }

    const players = await this.getPlayers();
    const playersById = new Map(players.map((player) => [player.id, player]));
    const alertsByGame = await Promise.all(
      liveGames.map(async (game) => {
        const landing = await this.fetchJson<RawGameLanding>(
          `gamecenter/${encodeURIComponent(game.id)}/landing`,
        );
        const scoring = landing.summary?.scoring ?? [];
        return scoring.flatMap((period) => {
          const periodNumber = period.periodDescriptor?.number ?? 0;
          return (period.goals ?? []).flatMap((goal) => {
            if (goal.eventId === undefined || goal.playerId === undefined || !goal.teamAbbrev) return [];
            const scoringTeam = [game.awayTeam, game.homeTeam].find(
              (team) => team.abbreviation.toLowerCase() === goal.teamAbbrev?.toLowerCase(),
            );
            if (!scoringTeam) return [];
            const player = playersById.get(String(goal.playerId));
            const fullName =
              goal.name?.default ||
              `${goal.firstName?.default ?? ""} ${goal.lastName?.default ?? ""}`.trim() ||
              "Unknown scorer";
            return [{
              id: `${game.id}:${goal.eventId}`,
              gameId: game.id,
              gameDate: game.gameDate,
              awayTeam: game.awayTeam,
              homeTeam: game.homeTeam,
              scoringTeam,
              scorer: {
                id: String(goal.playerId),
                fullName,
                jerseyNumber: goal.sweaterNumber ?? player?.jerseyNumber ?? null,
                headshotUrl: assetUrl(goal.headshot) ?? player?.headshotUrl ?? null,
              },
              periodNumber,
              periodLabel: periodLabel(periodNumber, period.periodDescriptor?.periodType),
              timeInPeriod: goal.timeInPeriod ?? "time unavailable",
              awayScore: goal.awayScore ?? null,
              homeScore: goal.homeScore ?? null,
              strength: goal.strength ?? null,
            }];
          });
        });
      }),
    );

    return GetLiveAlertsResponse.parse({
      state: "live",
      updatedAt: new Date().toISOString(),
      alerts: alertsByGame.flat(),
    });
  }

  async getGame(gameId: string) {
    const raw = await this.fetchJson<RawGame>(`gamecenter/${encodeURIComponent(gameId)}/landing`);
    return GetGameResponse.parse({ ...gameFromRaw(raw), notes: [] });
  }

  async getMatchup(gameId: string) {
    const game = await this.getGame(gameId);
    if (!game) return null;
    const loadRosterStats = async (team: NormalizedTeam) => {
      const roster = await this.getPlayers(undefined, team.abbreviation);
      return Promise.all(
        roster.map(async (player) => {
          try {
            const detail = await this.getPlayer(player.id);
            return { ...player, seasonStats: detail?.seasonStats ?? null };
          } catch {
            return { ...player, seasonStats: null };
          }
        }),
      );
    };
    const [awayPlayers, homePlayers] = await Promise.all([
      loadRosterStats(game.awayTeam),
      loadRosterStats(game.homeTeam),
    ]);
    return GetMatchupResponse.parse({
      game,
      away: { team: game.awayTeam, players: awayPlayers },
      home: { team: game.homeTeam, players: homePlayers },
    });
  }

  async getPlayers(search?: string, team?: string) {
    let players = await this.loadPlayers();
    if (search) players = players.filter((player) => player.fullName.toLowerCase().includes(search.toLowerCase()));
    if (team) players = players.filter((player) => player.team.id === team || player.team.abbreviation.toLowerCase() === team.toLowerCase());
    return GetPlayersResponse.parse(players);
  }

  async getPlayer(playerId: string) {
    const raw = await this.fetchJson<{
      playerId: number;
      firstName?: { default?: string };
      lastName?: { default?: string };
      currentTeamId?: number;
      currentTeamAbbrev?: string;
      headshot?: string;
      position?: string;
      sweaterNumber?: number;
      featuredStats?: { regularSeason?: { subSeason?: Record<string, number> } };
      last5Games?: Array<Record<string, number>>;
    }>(`player/${encodeURIComponent(playerId)}/landing`);
    const team = teamCache.get(raw.currentTeamAbbrev ?? "") ?? teamFromRaw({ id: raw.currentTeamId, abbrev: raw.currentTeamAbbrev });
    const toLine = (label: string, value: Record<string, number> | undefined, games = 0) => ({
      label,
      games: value?.gamesPlayed ?? games,
      goals: value?.goals ?? 0,
      sog: value?.shots ?? 0,
      points: value?.points ?? 0,
      assists: value?.assists ?? 0,
      toi: 0,
      ppToi: 0,
    });
    return GetPlayerResponse.parse({
      id: String(raw.playerId),
      firstName: text(raw.firstName?.default, ""),
      lastName: text(raw.lastName?.default, ""),
      fullName: `${text(raw.firstName?.default, "")} ${text(raw.lastName?.default, "")}`.trim(),
      teamId: team.id,
      team,
      position: text(raw.position, "—"),
      jerseyNumber: raw.sweaterNumber ?? null,
      headshotUrl: assetUrl(raw.headshot),
      seasonStats: toLine("Season", raw.featuredStats?.regularSeason?.subSeason),
      recentStats: (raw.last5Games ?? []).map((game, index) => toLine(`Game ${index + 1}`, game, 1)),
      splits: [],
    });
  }

  async getTeam(teamId: string) {
    const team = (await this.getTeams()).find((item) => item.id === teamId || item.abbreviation === teamId);
    if (!team) return null;
    return GetTeamResponse.parse({
      ...team,
      roster: await this.getPlayers(undefined, team.abbreviation),
      profile: {
        team,
        offense: null,
        defense: null,
        goaltending: null,
        powerPlay: null,
        penaltyKill: null,
        shotGeneration: null,
        shotSuppression: null,
        expectedGoals: null,
      },
    });
  }

  async getGoalies() {
    const players = await this.getPlayers();
    let games = await this.getGames();
    if (!games.length) games = await this.getFutureGames();
    const opponentByTeam = new Map<string, ReturnType<typeof teamFromRaw>>();
    games.forEach((game) => {
      opponentByTeam.set(game.homeTeam.id, game.awayTeam);
      opponentByTeam.set(game.awayTeam.id, game.homeTeam);
    });
    return GetGoaliesResponse.parse(
      players.filter((player) => player.position === "G").map((player) => ({
        id: player.id,
        fullName: player.fullName,
         firstName: player.firstName,
         lastName: player.lastName,
         jerseyNumber: player.jerseyNumber,
         headshotUrl: player.headshotUrl,
        team: player.team,
        opponent: opponentByTeam.get(player.team.id) ?? null,
        status: "unknown",
        projectedSaves: null,
        projectedShotsAgainst: null,
        savePercentage: null,
        goalsAgainst: null,
        winProbability: null,
        shutoutProbability: null,
        saves25Plus: null,
        saves30Plus: null,
        saves35Plus: null,
      })),
    );
  }

  async getProps() {
    return GetPropsResponse.parse([]);
  }

  async getPropsByMarket() {
    return GetPropsByMarketResponse.parse([]);
  }

  async getMatchups() {
    const games = await this.getGames();
    return GetMatchupsResponse.parse(
      games.map((game) => ({
        game,
        away: { team: game.awayTeam, offense: null, defense: null, goaltending: null, powerPlay: null, penaltyKill: null, shotGeneration: null, shotSuppression: null, expectedGoals: null },
        home: { team: game.homeTeam, offense: null, defense: null, goaltending: null, powerPlay: null, penaltyKill: null, shotGeneration: null, shotSuppression: null, expectedGoals: null },
      })),
    );
  }

  async getOdds() {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) return GetOddsResponse.parse({ provider: "The Odds API", configured: false, lastUpdated: null, games: [] });
    if (oddsCache && oddsCache.expiresAt > Date.now()) return oddsCache.data;

    const url = new URL("https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds");
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("regions", "us");
    url.searchParams.set("markets", "h2h,spreads,totals");
    url.searchParams.set("oddsFormat", "american");
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Odds provider returned HTTP ${response.status}`);
    const rawEvents = (await response.json()) as RawOddsEvent[];
    const [currentGames, futureGames] = await Promise.all([this.getGames(), this.getFutureGames()]);
    const verifiedGames = [...currentGames, ...futureGames];
    const games = rawEvents.flatMap((event) => {
      const away = canonicalTeamName(event.away_team || "");
      const home = canonicalTeamName(event.home_team || "");
      const game = verifiedGames.find((candidate) => canonicalTeamName(candidate.awayTeam.name) === away && canonicalTeamName(candidate.homeTeam.name) === home);
      if (!game) return [];
      const sportsbooks = (event.bookmakers || []).flatMap((bookmaker) => {
        const markets = (bookmaker.markets || []).flatMap((market) => {
          if (!market.key || !market.outcomes?.length) return [];
          return [{
            key: market.key,
            label: market.key === "h2h" ? "Moneyline" : market.key === "spreads" ? "Puck line" : "Total",
            outcomes: market.outcomes.filter((outcome) => outcome.name && typeof outcome.price === "number").map((outcome) => ({
              name: outcome.name!,
              price: outcome.price!,
              point: outcome.point ?? null,
            })),
          }];
        });
        if (!bookmaker.key || !bookmaker.title || !markets.length) return [];
        return [{ key: bookmaker.key, title: bookmaker.title, lastUpdate: bookmaker.last_update ?? null, markets }];
      });
      return sportsbooks.length ? [{ game, sportsbooks }] : [];
    });
    const data = GetOddsResponse.parse({ provider: "The Odds API", configured: true, lastUpdated: new Date().toISOString(), games });
    oddsCache = { expiresAt: Date.now() + 60_000, data };
    return data;
  }

  async getSnipes() {
    return GetSnipesResponse.parse([]);
  }

  async getAudit() {
    return GetAuditResponse.parse([]);
  }

  async getPerformance() {
    return GetModelPerformanceResponse.parse([]);
  }

  async getDashboard() {
    const [games, players] = await Promise.all([this.getGames(), this.getPlayers()]);
    return GetDashboardSummaryResponse.parse({
      dataStatus: {
        state: games.length > 0 ? "live" : "partial",
        provider: this.name,
        lastUpdated: new Date().toISOString(),
        message: games.length > 0
          ? `Official NHL schedule, including preseason when available, standings, roster and player data is available. ${process.env.ODDS_API_KEY ? "Sportsbook odds are connected." : "Sportsbook odds are not configured."} Model feed is not configured.`
          : `Official NHL data is connected, but no verified games were returned for today's NHL date. ${INCLUDE_PRESEASON ? "Preseason is included when the provider publishes it." : `Preseason is excluded before ${NHL_SEASON_START_DATE}.`} ${process.env.ODDS_API_KEY ? "Sportsbook odds are connected when markets are posted." : "Sportsbook odds are not configured."} Model feed is not configured.`,
      },
      games: games.length,
      snipes: 0,
      playersAnalyzed: players.length,
      topConfidence: null,
      modelVersion: "data-only",
      marketPerformance: [],
    });
  }

  async sync(): Promise<SyncReport> {
    const startedAt = new Date().toISOString();
    syncHealth.lastAttemptedSync = startedAt;
    syncHealth.errors = [];
    try {
      const [teams, currentGames, players, futureGames] = await Promise.all([
        this.getTeams(),
        this.getGames(),
        this.getPlayers(),
        this.getFutureGames(),
      ]);
      const games = Array.from(new Map([...currentGames, ...futureGames].map((game) => [game.id, game])).values());
      await db.insert(teamsTable).values(
        teams.map((team) => ({
          id: team.id,
          name: team.name,
           city: team.city,
          abbreviation: team.abbreviation,
          conference: team.conference,
          division: team.division,
           logoUrl: team.logoUrl,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
        })),
      ).onConflictDoUpdate({
        target: teamsTable.id,
          set: { name: teamsTable.name, city: teamsTable.city, abbreviation: teamsTable.abbreviation, conference: teamsTable.conference, division: teamsTable.division, logoUrl: teamsTable.logoUrl, primaryColor: teamsTable.primaryColor, secondaryColor: teamsTable.secondaryColor, updatedAt: new Date() },
      });
      if (games.length) {
        await db.insert(gamesTable).values(
          games.map((game) => ({
            id: game.id,
            gameDate: new Date(game.gameDate),
            awayTeamId: game.awayTeam.id,
            homeTeamId: game.homeTeam.id,
            venue: game.venue,
            status: game.status,
            statusDetail: game.statusDetail,
            rawPayload: game,
          })),
        ).onConflictDoUpdate({
          target: gamesTable.id,
          set: { gameDate: gamesTable.gameDate, status: gamesTable.status, statusDetail: gamesTable.statusDetail, venue: gamesTable.venue, rawPayload: gamesTable.rawPayload, updatedAt: new Date() },
        });
      }
      if (players.length) {
        await db.insert(playersTable).values(
          players.map((player) => ({
            id: player.id,
            teamId: player.team.id,
            fullName: player.fullName,
             firstName: player.firstName,
             lastName: player.lastName,
            position: player.position,
            jerseyNumber: player.jerseyNumber,
            headshotUrl: player.headshotUrl,
            active: true,
          })),
        ).onConflictDoUpdate({
          target: playersTable.id,
          set: { teamId: playersTable.teamId, fullName: playersTable.fullName, firstName: playersTable.firstName, lastName: playersTable.lastName, position: playersTable.position, jerseyNumber: playersTable.jerseyNumber, headshotUrl: playersTable.headshotUrl, updatedAt: new Date() },
        });
      }
      const completedAt = new Date().toISOString();
      Object.assign(syncHealth, { connection: "connected", lastSuccessfulSync: completedAt, teamsImported: teams.length, gamesImported: games.length, playersImported: players.length, playerStatsImported: 0, goalieStatsImported: 0 });
      return { provider: this.name, startedAt, completedAt, teamsImported: teams.length, gamesImported: games.length, playersImported: players.length, playerStatsImported: 0, goalieStatsImported: 0, errors: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown synchronization error";
      syncHealth.connection = "error";
      syncHealth.errors = [message];
      throw error;
    }
  }
}

export function getNhlProvider(): NhlDataProvider {
  return new NhlWebApiProvider();
}

export function getDataHealth(): DataHealth {
  return { ...syncHealth, errors: [...syncHealth.errors] };
}