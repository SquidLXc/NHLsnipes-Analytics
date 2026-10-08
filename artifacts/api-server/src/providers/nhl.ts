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
import { databaseConfigured, db, gamesTable, playersTable, teamsTable } from "@workspace/db";
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
  teamAbbrev?: string | { default?: string };
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

// OddsPapi types
type OddsPapiFixture = {
  fixtureId: string;
  participant1Id: number;
  participant2Id: number;
  sportId: number;
  tournamentId: number;
  seasonId: number;
  statusId: number;
  hasOdds: boolean;
  startTime: string;
  participant1Name: string;
  participant1ShortName: string;
  participant1Abbr: string;
  participant2Name: string;
  participant2ShortName: string;
  participant2Abbr: string;
  sportName: string;
  tournamentName: string;
  odds?: {
    bookmakerOdds: any;
  };
};

type OddsPapiMarket = {
  marketId: number;
  marketName: string;
  playerProp: boolean;
};

type OddsPapiOddsResponse = {
  fixtureId: string;
  bookmakerOdds: Record<string, {
    bookmakerIsActive: boolean;
    markets: Record<string, {
      marketActive: boolean;
      outcomes: Record<string, {
        players: Record<string, {
          playerName?: string;
          price?: number;
          priceAmerican?: number;
          line?: number;
          active: boolean;
        }>;
      }>;
    }>;
  }>;
};

const NHL_API_BASE_URL =
  process.env.NHLSNIPES_NHL_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api-web.nhle.com/v1";
const ASSET_BASE_URL =
  process.env.NHLSNIPES_ASSET_BASE_URL?.replace(/\/$/, "") || null;
const NHL_SEASON_START_DATE =
  process.env.NHLSNIPES_SEASON_START_DATE || "2026-09-29";
const INCLUDE_PRESEASON =
  process.env.NHLSNIPES_INCLUDE_PRESEASON !== "false";
const ODDSPAPI_API_KEY = process.env.ODDSPAPI_API_KEY;
const ODDSPAPI_BASE_URL = "https://api.oddspapi.io/v4";
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
let tournamentsCache: { expiresAt: number; data: any } | null = null;
let fixturesCache: { expiresAt: number; data: any } | null = null;

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
    awayScore: raw.awayTeam.score ?? null,
    homeScore: raw.homeTeam.score ?? null,
    period: (raw as any).periodDescriptor?.periodType ?? (raw as any).period?.periodLabel ?? null,
    clock: (raw as any).clock?.timeRemaining ?? (raw as any).periodDescriptor?.clock ?? null,
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

  private async fetchOddsPapiJson<T>(path: string): Promise<T> {
    if (!ODDSPAPI_API_KEY) throw new Error("OddsPapi API key not configured");
    const url = new URL(`${ODDSPAPI_BASE_URL}/${path.replace(/^\//, "")}`);
    url.searchParams.set("apiKey", ODDSPAPI_API_KEY);
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("OddsPapi authentication failed - check API key");
    }
    if (response.status === 429) {
      throw new Error("OddsPapi rate limit exceeded");
    }
    if (!response.ok) {
      console.error(`OddsPapi returned HTTP ${response.status} for ${path}`);
      throw new Error(`OddsPapi returned HTTP ${response.status} for ${path}`);
    }
    try {
      return (await response.json()) as T;
    } catch (error) {
      console.error(`Failed to parse OddsPapi JSON response for ${path}:`, error);
      throw error;
    }
  }

  private async loadTeams() {
    const raw = await this.fetchJson<{ standings?: RawTeam[] }>("standings/now");
    for (const standing of raw.standings ?? []) teamFromRaw(standing);
    return Array.from(new Map(Array.from(teamCache.values()).map((team) => [team.id, team])).values());
  }

  private async getOddsPapiFixtures(): Promise<any[]> {
    try {
      console.log("=== OddsPapi Integration Debug ===");
      console.log("API Key configured:", !!ODDSPAPI_API_KEY);
      
      // Use cached fixtures if available to avoid rate limiting
      if (fixturesCache && fixturesCache.expiresAt > Date.now()) {
        console.log("Using cached fixtures");
        return fixturesCache.data;
      }
      
      // Get date range for fixtures (yesterday to tomorrow to include live games)
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const from = yesterday.toISOString().split('T')[0];
      const to = tomorrow.toISOString().split('T')[0];
      
      console.log(`Fetching NHL fixtures from ${from} to ${to}...`);
      
      // Get NHL fixtures with odds (tournamentId=234 is NHL)
      const fixtures = await this.fetchOddsPapiJson<any>(
        `fixtures?sportId=15&tournamentId=234&from=${from}&to=${to}`
      );
      
      console.log(`OddsPapi fixtures response type:`, typeof fixtures);
      console.log(`OddsPapi fixtures is array:`, Array.isArray(fixtures));
      console.log(`OddsPapi fixtures length:`, Array.isArray(fixtures) ? fixtures.length : 'N/A');
      
      if (!Array.isArray(fixtures) || fixtures.length === 0) {
        console.log("No fixtures returned");
        fixturesCache = { expiresAt: Date.now() + 300_000, data: [] };
        return [];
      }
      
      // Filter for fixtures with odds and not finished
      const fixturesWithOdds = fixtures.filter((f: any) => f.hasOdds && f.statusId !== 2);
      console.log(`Filtered to ${fixturesWithOdds.length} fixtures with odds (not finished)`);
      
      if (fixturesWithOdds.length === 0) {
        console.log("No current fixtures with odds available");
        fixturesCache = { expiresAt: Date.now() + 300_000, data: [] };
        return [];
      }
      
      // Try to get odds for fixtures with rate limiting (limit to 1 to avoid quota burn)
      console.log(`Fetching odds for up to 1 fixture...`);
      const fixturesWithOddsData = await Promise.all(
        fixturesWithOdds.slice(0, 1).map(async (fixture: any) => {
          try {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit protection
            const fixtureId = fixture.fixtureId;
            console.log(`Fetching odds for fixture ${fixtureId} (${fixture.participant1Name} vs ${fixture.participant2Name})...`);
            const fixtureOdds = await this.fetchOddsPapiJson<any>(
              `odds?fixtureId=${fixtureId}`
            );
            return { ...fixture, odds: fixtureOdds };
          } catch (error) {
            console.log(`Failed to get odds for fixture:`, error instanceof Error ? error.message : String(error));
            return { ...fixture, odds: null };
          }
        })
      );
      
      console.log(`Returning ${fixturesWithOddsData.length} fixtures with odds data`);
      fixturesCache = { expiresAt: Date.now() + 300_000, data: fixturesWithOddsData };
      return fixturesWithOddsData;
    } catch (error) {
      console.error("Failed to fetch OddsPapi fixtures:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  private async getOddsPapiMarkets(): Promise<OddsPapiMarket[]> {
    // No longer needed with the new odds-by-tournaments approach
    return [];
  }

  private extractPlayerPropsFromBookmakerOdds(bookmakerOdds: any, playerProps: any[]) {
    // Only extract from DraftKings and a few major sportsbooks to save quota
    const priorityBookmakers = ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet', 'bet365'];
    
    for (const [bookmakerName, bookmakerData] of Object.entries(bookmakerOdds)) {
      // Skip if not a priority bookmaker
      if (!priorityBookmakers.some(b => bookmakerName.toLowerCase().includes(b))) {
        continue;
      }
      
      const bookmaker = bookmakerData as any;
      if (!bookmaker.markets) {
        continue;
      }

      console.log(`Processing bookmaker ${bookmakerName} with ${Object.keys(bookmaker.markets).length} markets`);

      for (const [marketId, marketData] of Object.entries(bookmaker.markets)) {
        const market = marketData as any;
        if (!market.outcomes) {
          continue;
        }

        // Look for player props (markets with playerName in outcomes)
        for (const [outcomeId, outcomeData] of Object.entries(market.outcomes)) {
          const outcome = outcomeData as any;
          if (!outcome.players) {
            continue;
          }

          for (const [playerId, playerData] of Object.entries(outcome.players)) {
            const player = playerData as any;
            
            // Only extract if we have player name and price
            if (player.playerName && player.price) {
              // Use American odds (priceAmerican) as it's more common in sports betting
              const americanOdds = player.priceAmerican || this.decimalToAmerican(player.price);
              
              playerProps.push({
                playerName: player.playerName,
                market: marketId,
                odds: americanOdds,
                bookmaker: bookmakerName,
                line: player.line || null,
              });
            }
          }
        }
      }
    }
  }

  private decimalToAmerican(decimalOdds: number): number {
    if (decimalOdds >= 2) {
      return Math.round((decimalOdds - 1) * 100);
    } else {
      return Math.round(-100 / (decimalOdds - 1));
    }
  }

  private async getOddsPapiOdds(fixtureId: number): Promise<OddsPapiOddsResponse | null> {
    // No longer needed with the new odds-by-tournaments approach
    return null;
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
    try {
      playersCache = GetPlayersResponse.parse(
        Array.from(new Map(rosters.flat().map((player) => [player.id, player])).values()),
      );
    } catch (error) {
      console.error("Failed to parse players response:", error);
      playersCache = GetPlayersResponse.parse([]);
    }
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
    try {
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
    } catch (error) {
      console.error("getFutureGames error:", error);
      return GetGamesResponse.parse([]);
    }
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
        try {
          // Try new API first
          const landing = await this.fetchJson<RawGameLanding>(
            `gamecenter/${encodeURIComponent(game.id)}/landing`,
          );
          const scoring = landing.summary?.scoring ?? [];
          return scoring.flatMap((period) => {
            const periodNumber = period.periodDescriptor?.number ?? 0;
            return (period.goals ?? []).flatMap((goal) => {
              if (goal.eventId === undefined || goal.playerId === undefined || !goal.teamAbbrev) return [];
              const teamAbbrev = typeof goal.teamAbbrev === 'string' ? goal.teamAbbrev : goal.teamAbbrev?.default;
              if (!teamAbbrev) return [];
              const scoringTeam = [game.awayTeam, game.homeTeam].find(
                (team) => team.abbreviation.toLowerCase() === teamAbbrev.toLowerCase(),
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
        } catch (error) {
          // Fallback to old NHL API if new API fails
          try {
            const oldApiUrl = `https://statsapi.web.nhl.com/api/v1/game/${game.id}/feed/live`;
            const response = await fetch(oldApiUrl);
            if (!response.ok) return [];
            const data: any = await response.json();
            const scoringPlays = data.liveData?.plays?.scoringPlays || [];
            const allPlays = data.liveData?.plays?.allPlays || [];
            
            return scoringPlays.flatMap((playIndex: number) => {
              const play = allPlays[playIndex];
              if (!play || !play.result?.event || play.result.event !== 'Goal') return [];
              
              const scorer = play.players?.find((p: any) => p.playerType === 'Scorer');
              if (!scorer) return [];
              
              const scoringTeam = [game.awayTeam, game.homeTeam].find(
                (team) => team.id === String(play.team?.id),
              );
              if (!scoringTeam) return [];
              
              const player = playersById.get(String(scorer.player.id));
              
              return [{
                id: `${game.id}:${play.about?.eventId || playIndex}`,
                gameId: game.id,
                gameDate: game.gameDate,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                scoringTeam,
                scorer: {
                  id: String(scorer.player.id),
                  fullName: scorer.player.fullName || "Unknown",
                  jerseyNumber: player?.jerseyNumber ?? null,
                  headshotUrl: player?.headshotUrl ?? null,
                },
                periodNumber: play.about?.period || 0,
                periodLabel: periodLabel(play.about?.period || 0, play.about?.periodType),
                timeInPeriod: play.about?.periodTime || "time unavailable",
                awayScore: play.about?.goals?.away ?? null,
                homeScore: play.about?.goals?.home ?? null,
                strength: play.result?.strength?.code ?? null,
              }];
            });
          } catch (fallbackError) {
            console.error(`Failed to fetch live alerts for game ${game.id}:`, fallbackError);
            return [];
          }
        }
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
    try {
      const [games, players, playerPropsOdds] = await Promise.all([
        this.getGames(),
        this.getPlayers(),
        this.getPlayerPropsOdds(),
      ]);

      if (!games.length || !players.length) {
        return GetPropsResponse.parse([]);
      }

      // Build opponent map
      const opponentByTeam = new Map<string, ReturnType<typeof teamFromRaw>>();
      games.forEach((game) => {
        opponentByTeam.set(game.homeTeam.id, game.awayTeam);
        opponentByTeam.set(game.awayTeam.id, game.homeTeam);
      });

      // Limit to players in today's games to avoid timeouts
      const todayTeamIds = new Set(games.flatMap(g => [g.homeTeam.id, g.awayTeam.id]));
      const relevantPlayers = players.filter(p => todayTeamIds.has(p.team.id));

      // Create a map of canonical player names to odds for faster lookup
      const canonicalPlayerName = (name: string) =>
        name.toLowerCase().replace(/[^a-z]/g, "");
      
      const oddsMap = new Map<string, { odds: number; line: number | null; bookmaker: string }>();
      for (const prop of playerPropsOdds) {
        const propCanonical = canonicalPlayerName(prop.playerName);
        oddsMap.set(propCanonical, { odds: prop.odds, line: prop.line, bookmaker: prop.bookmaker });
        
        // Also store variations for better matching
        // If name has comma, it's "Last, First" format, add "First Last" variant
        if (prop.playerName.includes(',')) {
          const parts = prop.playerName.split(',').map(p => p.trim());
          if (parts.length === 2) {
            const firstLast = canonicalPlayerName(`${parts[1]} ${parts[0]}`);
            oddsMap.set(firstLast, { odds: prop.odds, line: prop.line, bookmaker: prop.bookmaker });
          }
        }
      }
      
      // Debug: log sample odds
      console.log(`=== OddsPapi Player Props Debug ===`);
      console.log(`Total odds entries: ${oddsMap.size}`);
      console.log(`Sample odds:`, Array.from(oddsMap.entries()).slice(0, 10).map(([k, v]) => `${k} -> ${v.bookmaker} @ ${v.odds}`));
      console.log(`Sample players:`, relevantPlayers.slice(0, 5).map(p => p.fullName));

      // Calculate predictions for each player
      const props = await Promise.all(
        relevantPlayers.map(async (player) => {
          const opponent = opponentByTeam.get(player.team.id);
          if (!opponent) return null;

          // Skip detailed player stats to avoid timeouts
          // Use basic season stats from player object
          const seasonStats = player.seasonStats || { games: 1, goals: 0, sog: 0, points: 0, assists: 0 };
          const seasonGames = seasonStats.games || 1;

          const seasonGoalsPerGame = seasonStats.goals / seasonGames;
          const seasonShotsPerGame = seasonStats.sog / seasonGames;

          // Calculate probability based on player performance - make it more realistic
        const baseProbability = Math.min(0.6, seasonGoalsPerGame * 1.2); // Base probability based on goals per game
        const positionBonus = player.position === 'C' ? 0.08 : player.position === 'W' ? 0.05 : player.position === 'D' ? 0.02 : 0; // Bonus for offensive positions
        const minProbability = 0.15; // Minimum probability for any player
        const overProbability = Math.min(0.8, Math.max(minProbability, baseProbability + positionBonus));
        const underProbability = 1 - overProbability;
        const modelProjection = seasonGoalsPerGame;

        // Find matching odds for this player using the map
        const playerCanonical = canonicalPlayerName(player.fullName);
        const playerLastFirst = canonicalPlayerName(`${player.lastName}, ${player.firstName}`);
        
        // Try exact match first
        let matchingOdds = oddsMap.get(playerCanonical) || oddsMap.get(playerLastFirst);
        
        // If no exact match, try finding by partial match
        if (!matchingOdds) {
          for (const [key, value] of oddsMap.entries()) {
            if (key.includes(playerCanonical) || key.includes(playerLastFirst) ||
                playerCanonical.includes(key) || playerLastFirst.includes(key)) {
              matchingOdds = value;
              break;
            }
          }
        }

        const odds = matchingOdds?.odds ?? null;
        const line = matchingOdds?.line ?? null;

        // Calculate edge only if we have real odds from OddsPapi
        let edge = null;
        if (odds !== null) {
          // Convert American odds to implied probability
          const impliedProb = odds > 0
            ? 100 / (odds + 100)
            : Math.abs(odds) / (Math.abs(odds) + 100);
          
          edge = overProbability - impliedProb;
        }
        // No edge without real odds - this ensures we only show real betting opportunities

        const { confidenceFromEdge } = await import("../models/confidence");
        const confidence = confidenceFromEdge(edge, seasonGames);

        return {
          id: `${player.id}-anytime-goal`,
          player: {
            id: player.id,
            fullName: player.fullName,
            firstName: player.firstName,
            lastName: player.lastName,
            teamId: player.team.id,
            team: player.team,
            position: player.position,
            jerseyNumber: player.jerseyNumber,
            headshotUrl: player.headshotUrl,
          },
          opponent,
          market: "Anytime Goal Scorer",
          line,
          lineStatus: odds !== null ? ("available" as const) : ("unavailable" as const),
          modelProjection: seasonGoalsPerGame,
          overProbability,
          underProbability,
          edge,
          confidence,
          source: matchingOdds?.bookmaker ?? null,
        };
      })
    );

    // Filter out nulls and sort by edge
    const validProps = props.filter((p): p is NonNullable<typeof p> => p !== null);
    validProps.sort((a, b) => (b.edge ?? -1) - (a.edge ?? -1));

    try {
      return GetPropsResponse.parse(validProps);
    } catch (error) {
      console.error("Failed to parse props response:", error);
      return GetPropsResponse.parse([]);
    }
    } catch (error) {
      console.error("getProps error:", error);
      return GetPropsResponse.parse([]);
    }
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
    if (!ODDSPAPI_API_KEY) {
      console.warn("ODDSPAPI_API_KEY not configured, returning unconfigured odds response");
      return GetOddsResponse.parse({ provider: "OddsPapi", configured: false, lastUpdated: null, games: [] });
    }
    if (oddsCache && oddsCache.expiresAt > Date.now()) return oddsCache.data;

    try {
      const [oddsPapiFixtures, currentGames, futureGames] = await Promise.all([
        this.getOddsPapiFixtures(),
        this.getGames(),
        this.getFutureGames(),
      ]);
      const verifiedGames = [...currentGames, ...futureGames];

      // Match OddsPapi fixtures to NHL games by team names
      const games = oddsPapiFixtures.flatMap((fixture) => {
        const away = canonicalTeamName(fixture.participant1Name);
        const home = canonicalTeamName(fixture.participant2Name);
        const game = verifiedGames.find((candidate) =>
          canonicalTeamName(candidate.awayTeam.name) === away &&
          canonicalTeamName(candidate.homeTeam.name) === home
        );
        if (!game) return [];

        // Return basic game odds structure (OddsPapi focuses on player props)
        return [{
          game,
          sportsbooks: [{
            key: "oddspapi",
            title: "OddsPapi",
            lastUpdate: new Date().toISOString(),
            markets: []
          }]
        }];
      });

      const data = GetOddsResponse.parse({
        provider: "OddsPapi",
        configured: true,
        lastUpdated: new Date().toISOString(),
        games
      });
      oddsCache = { expiresAt: Date.now() + 60_000, data };
      return data;
    } catch (error) {
      console.error("OddsPapi odds fetch error:", error);
      // Return gracefully degraded response instead of throwing
      return GetOddsResponse.parse({
        provider: "OddsPapi",
        configured: true,
        lastUpdated: null,
        games: []
      });
    }
  }

  async getPlayerPropsOdds() {
    if (!ODDSPAPI_API_KEY) return [];

    try {
      console.log("=== getPlayerPropsOdds Debug ===");
      
      // Get OddsPapi fixtures (which now includes odds data)
      const oddsPapiFixtures = await this.getOddsPapiFixtures();
      if (!oddsPapiFixtures.length) {
        console.log("No OddsPapi fixtures returned");
        return [];
      }

      console.log(`Processing ${oddsPapiFixtures.length} OddsPapi fixtures with odds`);

      // Extract player props from all fixtures
      const playerProps: Array<{
        playerName: string;
        market: string;
        odds: number;
        bookmaker: string;
        line?: number;
      }> = [];

      for (const fixture of oddsPapiFixtures) {
        console.log(`Processing fixture ${fixture.fixtureId} (${fixture.participant1Name} vs ${fixture.participant2Name})`);
        
        // Handle the odds structure from the new implementation
        const bookmakerOdds = fixture.odds?.bookmakerOdds;
        
        if (!bookmakerOdds) {
          console.log(`No bookmakerOdds for fixture ${fixture.fixtureId}`);
          continue;
        }

        console.log(`Extracting player props from ${Object.keys(bookmakerOdds).length} bookmakers`);
        this.extractPlayerPropsFromBookmakerOdds(bookmakerOdds, playerProps);
      }

      console.log(`=== Final count: Extracted ${playerProps.length} player props from OddsPapi ===`);
      return playerProps;
    } catch (error) {
      console.error("Error fetching player props from OddsPapi:", error);
      console.error("Error details:", error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  async getSnipes() {
    try {
      const props = await this.getProps();
      // Return top props as snipes (any with edge > 0)
      const snipes = props.filter(p => p.edge !== null && p.edge > 0).slice(0, 10);
      
      // Map props to snipes schema format
      const snipesMapped = snipes.map(p => ({
        ...p,
        score: p.modelProjection || 0,
        goalProbability: p.overProbability || 0,
        sogProjection: null,
        pointProbability: null,
        assistProbability: null,
        factors: []
      }));
      
      try {
        return GetSnipesResponse.parse(snipesMapped);
      } catch (error) {
        console.error("Failed to parse snipes response - schema mismatch, returning empty array:", error);
        return GetSnipesResponse.parse([]);
      }
    } catch (error) {
      console.error("getSnipes error:", error);
      return GetSnipesResponse.parse([]);
    }
  }

  async getAudit() {
    try {
      const props = await this.getProps();
      // Generate audit records from props with proper schema
      const auditRecords = props.slice(0, 20).map(p => ({
        id: `${p.id}-${Date.now()}`,
        createdAt: new Date(),
        playerName: p.player.fullName,
        market: p.market,
        line: p.line,
        projection: p.modelProjection,
        probability: p.overProbability,
        confidence: p.confidence,
        modelVersion: "data-only",
        actual: null,
        result: 'pending' as const
      }));
      try {
        return GetAuditResponse.parse(auditRecords);
      } catch (error) {
        console.error("Failed to parse audit response:", error);
        return GetAuditResponse.parse([]);
      }
    } catch (error) {
      console.error("getAudit error:", error);
      return GetAuditResponse.parse([]);
    }
  }

  async getPerformance() {
    return GetModelPerformanceResponse.parse([]);
  }

  async getDashboard() {
    try {
      const [games, players, snipes] = await Promise.all([
        this.getGames(),
        this.getPlayers(),
        this.getSnipes()
      ]);
      const topConfidence = snipes.length > 0 ? snipes[0] : null;
      try {
        return GetDashboardSummaryResponse.parse({
          dataStatus: {
            state: games.length > 0 ? "live" : "partial",
            provider: this.name,
            lastUpdated: new Date().toISOString(),
            message: games.length > 0
              ? `Official NHL schedule, including preseason when available, standings, roster and player data is available. ${ODDSPAPI_API_KEY ? "Sportsbook odds are connected via OddsPapi." : "Sportsbook odds are not configured."} Model feed is not configured.`
              : `Official NHL data is connected, but no verified games were returned for today's NHL date. ${INCLUDE_PRESEASON ? "Preseason is included when the provider publishes it." : `Preseason is excluded before ${NHL_SEASON_START_DATE}.`} ${ODDSPAPI_API_KEY ? "Sportsbook odds are connected via OddsPapi when markets are posted." : "Sportsbook odds are not configured."} Model feed is not configured.`,
          },
          games: games.length,
          snipes: snipes.length,
          playersAnalyzed: players.length,
          topConfidence,
          modelVersion: "data-only",
          marketPerformance: [],
        });
      } catch (error) {
        console.error("Failed to parse dashboard response:", error);
        return GetDashboardSummaryResponse.parse({
          dataStatus: {
            state: "partial",
            provider: this.name,
            lastUpdated: new Date().toISOString(),
            message: "Dashboard parsing error"
          },
          games: games.length,
          snipes: snipes.length,
          playersAnalyzed: players.length,
          topConfidence: null,
          modelVersion: "data-only",
          marketPerformance: [],
        });
      }
    } catch (error) {
      console.error("getDashboard error:", error);
      return GetDashboardSummaryResponse.parse({
        dataStatus: {
          state: "partial",
          provider: this.name,
          lastUpdated: new Date().toISOString(),
          message: "Dashboard data unavailable due to error"
        },
        games: 0,
        snipes: 0,
        playersAnalyzed: 0,
        topConfidence: null,
        modelVersion: "data-only",
        marketPerformance: [],
      });
    }
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
      
      // Only insert into database if configured
      if (databaseConfigured) {
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