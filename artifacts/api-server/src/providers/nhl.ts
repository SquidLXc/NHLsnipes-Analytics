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

const NHL_API_BASE_URL =
  process.env.NHLSNIPES_NHL_API_BASE_URL?.replace(/\/$/, "") ||
  "https://api-web.nhle.com/v1";
const ASSET_BASE_URL =
  process.env.NHLSNIPES_ASSET_BASE_URL?.replace(/\/$/, "") || null;
const NHL_SEASON_START_DATE =
  process.env.NHLSNIPES_SEASON_START_DATE || "2026-09-29";
const INCLUDE_PRESEASON =
  process.env.NHLSNIPES_INCLUDE_PRESEASON !== "false";
const THERUNDOWN_API_KEY = process.env.THERUNDOWN_API_KEY;
const THERUNDOWN_BASE_URL = "https://therundown.io/api/v2";
const NHL_SPORT_ID = 6;
// Let the API return available markets rather than hardcoding sport-specific prop IDs
// TheRundown documentation states each sport has its own set of prop markets
const NHL_CORE_MARKET_IDS = "1,2,3,563"; // Moneyline, spread, total, 3-way regulation
const PRIORITY_AFFILIATE_IDS = "19,23,22,3"; // DraftKings, FanDuel, BetMGM, Pinnacle

// Parlay API configuration for player props
const PARLAY_API_KEY = process.env.PARLAY_API_KEY;
const PUCKAPI_API_KEY = process.env.PUCKAPI_API_KEY;
const PARLAY_BASE_URL = "https://parlay-api.com/v1";
const PARLAY_NHL_SPORT_KEY = "icehockey_nhl";
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
let teamsCache: { expiresAt: number; data: ProviderData["teams"] } | null = null;
let playersCache: ProviderData["players"] | null = null;
let playersCacheAt = 0;
let oddsCache: { expiresAt: number; data: ProviderData["odds"] } | null = null;
let therundownEventsCache: { expiresAt: number; data: any } | null = null;
let therundownEventsPromise: Promise<any> | null = null; // Deduplication for concurrent requests
let parlayPropsCache: { expiresAt: number; data: any } | null = null;
let parlayPropsPromise: Promise<any> | null = null; // Deduplication for concurrent requests

function text(value: string | undefined, fallback: string) {
  return value?.trim() || fallback;
}

function canonicalTeamName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
}

// Map TheRundown team names/abbreviations to NHL team abbreviations
const therundownTeamMapping: Record<string, string> = {
  "florida": "FLA",
  "fla": "FLA",
  "buffalo": "BUF",
  "buf": "BUF",
  "ottawa": "OTT",
  "ott": "OTT",
  "newjersey": "NJD",
  "nj": "NJD",
  "vegas": "VGK",
  "las": "VGK",
  "minnesota": "MIN",
  "min": "MIN",
};

function mapTheRundownTeamToNHL(theRundownName: string, theRundownAbbr: string): string {
  const canonical = canonicalTeamName(theRundownName);
  const abbrLower = theRundownAbbr.toLowerCase();

  // Check mapping first
  if (therundownTeamMapping[canonical]) return therundownTeamMapping[canonical];
  if (therundownTeamMapping[abbrLower]) return therundownTeamMapping[abbrLower];

  // Return abbreviation as-is if no mapping
  return theRundownAbbr.toUpperCase();
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

// Parlay API helper
async function fetchParlayJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!PARLAY_API_KEY) {
    throw new Error("PARLAY_API_KEY not configured");
  }

  const url = new URL(`${PARLAY_BASE_URL}${path}`, PARLAY_BASE_URL);
  url.searchParams.append("apiKey", PARLAY_API_KEY);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, value);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000); // Increased to 120s for slow Render network

  try {
    // Log URL without API key for security
    const safeUrl = url.toString().replace(/apiKey=[^&]+/, 'apiKey=REDACTED');
    console.log(`Parlay API request: ${safeUrl}`);
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Parlay API returned HTTP ${response.status}`);
      const errorText = await response.text();
      throw new Error(`Parlay API returned HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Parlay API request timeout");
    }
    throw error;
  }
}

// TheRundown API types
type TheRundownEvent = {
  event_id: string;
  sport_id: number;
  event_date: string;
  teams: Array<{
    id: number;
    name: string;
    abbreviation: string;
  }>;
  score?: {
    event_status: string;
    event_status_detail: string;
    away_score: number;
    home_score: number;
  };
  markets: Array<{
    market_id: number;
    name: string;
    participants: Array<{
      id: number;
      type: string;
      name: string;
      lines: Array<{
        value: string;
        prices: Record<string, {
          price: number;
          updated_at: string;
        }>;
      }>;
    }>;
  }>;
};

// Parlay API types
type ParlayProp = {
  event_id: string;
  canonical_event_id: string;
  sport_key: string;
  game_date: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmaker: string;
  bookmaker_title: string;
  player: string;
  market_key: string;
  market: string;
  period: string;
  line: number;
  over_price: number | null;
  under_price: number | null;
  implied_probability: number | null;
  last_update: string;
};

type TheRundownResponse = {
  events: TheRundownEvent[];
  meta?: {
    delta_last_id?: number;
  };
};

async function fetchTheRundownJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  if (!THERUNDOWN_API_KEY) throw new Error("TheRundown API key not configured");
  const url = new URL(`${THERUNDOWN_BASE_URL}/${path.replace(/^\//, "")}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  const response = await fetch(url, {
    headers: { "X-TheRundown-Key": THERUNDOWN_API_KEY, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("TheRundown authentication failed - check API key");
  }
  if (response.status === 429) {
    throw new Error("TheRundown rate limit exceeded");
  }
  if (!response.ok) {
    console.error(`TheRundown returned HTTP ${response.status} for ${path}`);
    throw new Error(`TheRundown returned HTTP ${response.status} for ${path}`);
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Failed to parse TheRundown JSON response for ${path}:`, error);
    throw error;
  }
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
    // Add a hard timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`NHL API request to ${path} timed out after 90s`)), 90_000)
    );

    const fetchPromise = (async () => {
      const response = await fetch(`${NHL_API_BASE_URL}/${path.replace(/^\//, "")}`, {
        headers: { accept: "application/json", "user-agent": "NHLsnipes/1.0" },
        signal: AbortSignal.timeout(120_000), // Increased to 120s for slow NHL API on Render
      });
      if (!response.ok) throw new Error(`NHL Web API returned HTTP ${response.status} for ${path}`);
      return (await response.json()) as T;
    })();

    return Promise.race([fetchPromise, timeoutPromise]);
  }

  private async getTheRundownEvents(includePlayerProps: boolean = true): Promise<TheRundownEvent[]> {
    try {
      // Use cached events if available to avoid rate limiting
      if (therundownEventsCache && therundownEventsCache.expiresAt > Date.now()) {
        console.log("Using cached TheRundown events");
        return therundownEventsCache.data;
      }

      // If a request is already in progress, wait for it
      if (therundownEventsPromise) {
        console.log("Waiting for in-progress TheRundown events request");
        return therundownEventsPromise;
      }

      // If cache exists but is expired, log it
      if (therundownEventsCache) {
        console.log("Cache expired, fetching fresh TheRundown events");
      }

      // Start the fetch and store the promise for deduplication
      therundownEventsPromise = (async () => {
        try {
          // Get date range for events (yesterday to tomorrow to include live games)
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const date = today.toISOString().split('T')[0];

          console.log(`Fetching NHL events from TheRundown for ${date}...`);

          // Note: Player props require Starter plan or higher ($49/mo)
          // Free tier only gets core markets (moneyline, spread, total)
          const marketIds = NHL_CORE_MARKET_IDS;

          const response = await fetchTheRundownJson<TheRundownResponse>(
            `sports/${NHL_SPORT_ID}/events/${date}`,
            {
              market_ids: marketIds,
              affiliate_ids: PRIORITY_AFFILIATE_IDS,
              main_line: "true",
              offset: "300", // Align with US Central Time
            }
          );

          if (!response.events || response.events.length === 0) {
            console.log("No TheRundown events returned");
            therundownEventsCache = { expiresAt: Date.now() + 600_000, data: [] };
            return [];
          }

          console.log(`Fetched ${response.events.length} NHL events from TheRundown`);
          therundownEventsCache = { expiresAt: Date.now() + 600_000, data: response.events }; // 10 minute cache
          return response.events;
        } catch (error) {
          console.error("Failed to fetch TheRundown events:", error);

          // If rate limited and we have cached data, return it
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('rate limit') && therundownEventsCache && therundownEventsCache.data.length > 0) {
            console.log("Rate limit hit on TheRundown endpoint, returning cached data");
            return therundownEventsCache.data;
          }

          return [];
        } finally {
          // Clear the promise after completion
          therundownEventsPromise = null;
        }
      })();

      return therundownEventsPromise;
    } catch (error) {
      console.error("getTheRundownEvents error:", error);
      return [];
    }
  }

  private async getParlayPlayerProps(): Promise<ParlayProp[]> {
    try {
      // Use cached props if available to avoid rate limiting
      if (parlayPropsCache && parlayPropsCache.expiresAt > Date.now()) {
        console.log("Using cached Parlay props");
        return parlayPropsCache.data;
      }

      // If a request is already in progress, wait for it
      if (parlayPropsPromise) {
        console.log("Waiting for in-progress Parlay request");
        return parlayPropsPromise;
      }

      // Start the fetch and store the promise for deduplication
      parlayPropsPromise = (async () => {
        try {
          console.log("Fetching NHL player props from Parlay API...");

          // Add a hard timeout for the entire operation
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Parlay API operation timed out after 90s")), 90_000)
          );

          const response = await Promise.race([
            fetchParlayJson<ParlayProp[]>(
              `/sports/${PARLAY_NHL_SPORT_KEY}/props`,
              {
                bookmakers: "draftkings,fanduel,betmgm", // Priority sportsbooks
                limit: "10000", // Get all available props
              }
            ),
            timeoutPromise
          ]);

          if (!response || response.length === 0) {
            console.log("No Parlay props returned");
            parlayPropsCache = { expiresAt: Date.now() + 600_000, data: [] };
            return [];
          }

          console.log(`Fetched ${response.length} NHL player props from Parlay API`);
          // Debug: Log raw sample props to see actual structure
          console.log(`Raw sample Parlay props:`, JSON.stringify(response.slice(0, 2), null, 2));
          // Log all keys in the first prop to see available fields
          if (response.length > 0) {
            console.log(`Available fields in Parlay response:`, Object.keys(response[0]));
            // Log a sample of the data structure
            console.log(`First prop structure:`, response[0]);
          }
          parlayPropsCache = { expiresAt: Date.now() + 600_000, data: response }; // 10 minute cache
          return response;
        } catch (error) {
          console.error("Failed to fetch Parlay props:", error);

          // If we have cached data, return it even on timeout
          if (parlayPropsCache && parlayPropsCache.data.length > 0) {
            console.log("Parlay API failed, returning cached data");
            return parlayPropsCache.data;
          }

          console.log("Parlay API failed and no cached data available, returning empty array");
          return [];
        } finally {
          // Clear the promise after completion
          parlayPropsPromise = null;
        }
      })();

      return parlayPropsPromise;
    } catch (error) {
      console.error("getParlayPlayerProps error:", error);
      return [];
    }
  }

  private async loadTeams() {
    // Use cached teams if available (30 minute cache)
    if (teamsCache && Date.now() < teamsCache.expiresAt) {
      return teamsCache.data;
    }

    try {
      const raw = await this.fetchJson<{ standings?: RawTeam[] }>("standings/now");
      for (const standing of raw.standings ?? []) teamFromRaw(standing);
      const teams = Array.from(new Map(Array.from(teamCache.values()).map((team) => [team.id, team])).values());
      teamsCache = { expiresAt: Date.now() + 1800_000, data: teams }; // 30 minute cache
      return teams;
    } catch (error) {
      console.error("loadTeams error:", error);
      // Return cached data if available
      if (teamsCache) return teamsCache.data;
      return [];
    }
  }

  private async loadPlayers() {
    if (playersCache && Date.now() - playersCacheAt < 1800_000) return playersCache; // Increased to 30 minutes to reduce NHL API calls

    try {
      const teams = await this.loadTeams();
      if (!teams.length) {
        console.log("No teams loaded, returning empty players");
        playersCache = GetPlayersResponse.parse([]);
        playersCacheAt = Date.now();
        return playersCache;
      }

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

      console.log(`loadPlayers: Loaded ${rosters.flat().length} players from rosters`);

      // Fetch stats for players - needed for prop calculations
      // Try multiple endpoints: landing first, then stats endpoint as fallback
      // Process in very small batches with shorter timeout to avoid Render network timeouts
      const batchSize = 5; // Reduced from 10 to 5 for Render's slower network
      const playersWithStats: any[] = [];
      let statsLogCount = 0;
      let totalStatsFetched = 0;
      let consecutiveFailures = 0;
      const MAX_CONSECUTIVE_FAILURES = 10; // Stop trying after 10 consecutive failures

      for (let i = 0; i < rosters.flat().length; i += batchSize) {
        // Stop fetching stats if we're hitting too many consecutive failures
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          console.log(`loadPlayers: Stopping stats fetch after ${consecutiveFailures} consecutive failures - proceeding without stats`);
          break;
        }

        const batch = rosters.flat().slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (player) => {
            try {
              let stats: any = null;

              // Try landing endpoint first
              try {
                const landingStats = await Promise.race([
                  this.fetchJson<{ skaterStats?: any; goalieStats?: any }>(
                    `player/${player.id}/landing`,
                  ),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Landing endpoint timeout")), 8000) // 8s timeout
                  )
                ]);
                stats = landingStats.skaterStats?.regular?.[0] || landingStats.goalieStats?.regular?.[0];
                if (stats) {
                  totalStatsFetched++;
                  consecutiveFailures = 0;
                  if (statsLogCount < 3) {
                    console.log(`Got stats from landing for ${player.fullName}:`, stats);
                    statsLogCount++;
                  }
                }
              } catch (e) {
                // Landing failed, try stats endpoint as fallback
                try {
                  const statsData = await Promise.race([
                    this.fetchJson<{ stats?: any }>(
                      `player/${player.id}/stats`,
                    ),
                    new Promise<never>((_, reject) =>
                      setTimeout(() => reject(new Error("Stats endpoint timeout")), 8000) // 8s timeout
                    )
                  ]);
                  // Stats endpoint has different structure - try to extract from it
                  if (statsData.stats && statsData.stats.length > 0) {
                    stats = statsData.stats[0]; // First entry should be current season
                    if (stats) {
                      totalStatsFetched++;
                      consecutiveFailures = 0;
                      if (statsLogCount < 3) {
                        console.log(`Got stats from stats endpoint for ${player.fullName}:`, stats);
                        statsLogCount++;
                      }
                    }
                  }
                } catch (e2) {
                  consecutiveFailures++;
                  if (statsLogCount < 3) {
                    console.log(`Failed to fetch stats for ${player.fullName} (both endpoints):`, e instanceof Error ? e.message : String(e));
                    statsLogCount++;
                  }
                }
              }

              return {
                ...player,
                seasonStats: stats || null,
              };
            } catch {
              consecutiveFailures++;
              return {
                ...player,
                seasonStats: null,
              };
            }
          })
        );
        playersWithStats.push(...batchResults);
      }

      const playersWithStatsCount = playersWithStats.filter(p => p.seasonStats && p.seasonStats.goals > 0).length;
      console.log(`loadPlayers: ${playersWithStatsCount} players with actual stats (${totalStatsFetched} stats fetched), ${playersWithStats.length - playersWithStatsCount} without stats`);

      // If we got 0 stats but fetched many requests, the endpoint might be returning empty stats
      // Log a warning if this happens
      if (totalStatsFetched > 0 && playersWithStatsCount === 0) {
        console.warn(`WARNING: Fetched ${totalStatsFetched} stats responses but 0 players with goals > 0. Stats structure may have changed.`);
      }

      // If we have very few stats overall, log a warning
      if (playersWithStatsCount < 10 && rosters.flat().length > 50) {
        console.warn(`WARNING: Only ${playersWithStatsCount} players with stats out of ${rosters.flat().length}. NHL stats endpoint may be unreliable.`);
      }

      try {
        playersCache = GetPlayersResponse.parse(
          Array.from(new Map(playersWithStats.map((player) => [player.id, player])).values()),
        );
      } catch (error) {
        console.error("Failed to parse players response:", error);
        playersCache = GetPlayersResponse.parse([]);
      }
      playersCacheAt = Date.now();
      return playersCache;
    } catch (error) {
      console.error("loadPlayers error:", error);
      // Return cached data if available, otherwise empty
      if (playersCache) return playersCache;
      playersCache = GetPlayersResponse.parse([]);
      playersCacheAt = Date.now();
      return playersCache;
    }
  }

  async getTeams() {
    try {
      return GetTeamsResponse.parse(await this.loadTeams());
    } catch (error) {
      console.error("getTeams error:", error);
      return GetTeamsResponse.parse([]);
    }
  }

  async getGames(date?: string) {
    try {
      const raw = await this.fetchJson<{ games?: RawGame[] }>(date ? `score/${date}` : "score/now");
      const verifiedGames = (raw.games ?? []).filter((game) => {
        const gameDate = (game.gameDate || game.startTimeUTC || "").slice(0, 10);
        return INCLUDE_PRESEASON || gameDate >= NHL_SEASON_START_DATE;
      });
      return GetGamesResponse.parse(verifiedGames.map(gameFromRaw));
    } catch (error) {
      console.error("getGames error:", error);
      return GetGamesResponse.parse([]);
    }
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
    try {
      console.log(`getMatchup: Fetching game ${gameId}`);
      const game = await this.getGame(gameId);
      if (!game) {
        console.error(`getMatchup: Game ${gameId} not found`);
        return null;
      }

      console.log(`getMatchup: Fetching rosters for ${game.awayTeam.abbreviation} and ${game.homeTeam.abbreviation}`);
      // Use loadPlayers() which already has cached data - no need to call getPlayer() for each player
      const allPlayers = await this.loadPlayers();
      const awayPlayers = allPlayers.filter(p => p.team.abbreviation === game.awayTeam.abbreviation);
      const homePlayers = allPlayers.filter(p => p.team.abbreviation === game.homeTeam.abbreviation);

      console.log(`getMatchup: ${awayPlayers.length} away players, ${homePlayers.length} home players`);
      return GetMatchupResponse.parse({
        game,
        away: { team: game.awayTeam, players: awayPlayers },
        home: { team: game.homeTeam, players: homePlayers },
      });
    } catch (error) {
      console.error(`getMatchup error for game ${gameId}:`, error);
      return null;
    }
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
    try {
      const players = await this.getPlayers();
      console.log(`getGoalies: Total players loaded: ${players.length}`);

      let games = await this.getGames();
      if (!games.length) games = await this.getFutureGames();
      console.log(`getGoalies: Games loaded: ${games.length}`);

      const opponentByTeam = new Map<string, ReturnType<typeof teamFromRaw>>();
      games.forEach((game) => {
        opponentByTeam.set(game.homeTeam.id, game.awayTeam);
        opponentByTeam.set(game.awayTeam.id, game.homeTeam);
      });

      const goalies = players.filter((player) => player.position === "G");
      console.log(`getGoalies: Goalies found: ${goalies.length}`);

      const goalieData = goalies.map((player) => {
        const seasonStats = (player as any).seasonStats;
        const seasonGames = Math.max(1, seasonStats?.games || 1);

        let savesPerGame, shotsAgainstPerGame, savePercentage, goalsAgainstPerGame, winRate, shutoutRate;

        if (seasonStats && seasonStats.saves > 0) {
          // Use actual stats
          savesPerGame = seasonStats.saves / seasonGames;
          shotsAgainstPerGame = (seasonStats.shotsAgainst || 0) / seasonGames;
          savePercentage = shotsAgainstPerGame > 0 ? seasonStats.saves / shotsAgainstPerGame : 0;
          goalsAgainstPerGame = (seasonStats.goalsAgainst || 0) / seasonGames;
          winRate = (seasonStats.wins || 0) / seasonGames;
          shutoutRate = (seasonStats.shutouts || 0) / seasonGames;
        } else {
          // Fallback to league averages with goalie ID variation
          const goalieIdHash = parseInt(player.id) % 100;
          const variation = 1 + ((goalieIdHash - 50) / 200);

          const avgSavesPerGame = 28.5;
          const avgShotsAgainstPerGame = 31.0;
          const avgSavePercentage = 0.912;
          const avgGoalsAgainstPerGame = 2.75;
          const avgWinRate = 0.52;
          const avgShutoutRate = 0.04;

          savesPerGame = Math.max(20, avgSavesPerGame * variation);
          shotsAgainstPerGame = Math.max(22, avgShotsAgainstPerGame * variation);
          savePercentage = Math.min(0.95, Math.max(0.88, avgSavePercentage * variation));
          goalsAgainstPerGame = Math.max(1.5, avgGoalsAgainstPerGame * (2 - variation));
          winRate = Math.min(0.65, Math.max(0.35, avgWinRate * variation));
          shutoutRate = Math.min(0.10, Math.max(0.01, avgShutoutRate * variation));
        }

        return {
          id: player.id,
          fullName: player.fullName,
           firstName: player.firstName,
           lastName: player.lastName,
           jerseyNumber: player.jerseyNumber,
           headshotUrl: player.headshotUrl,
          team: player.team,
          opponent: opponentByTeam.get(player.team.id) ?? null,
          status: "unknown",
          projectedSaves: Math.round(savesPerGame * 10) / 10 || null,
          projectedShotsAgainst: Math.round(shotsAgainstPerGame * 10) / 10 || null,
          savePercentage: Math.round(savePercentage * 1000) / 1000 || null,
          goalsAgainst: Math.round(goalsAgainstPerGame * 10) / 10 || null,
          winProbability: Math.round(winRate * 100) / 100 || null,
          shutoutProbability: Math.round(shutoutRate * 100) / 100 || null,
          saves25Plus: savesPerGame >= 25 ? 1 : 0,
          saves30Plus: savesPerGame >= 30 ? 1 : 0,
          saves35Plus: savesPerGame >= 35 ? 1 : 0,
        };
      });

      console.log(`getGoalies: Parsed ${goalieData.length} goalies`);
      return GetGoaliesResponse.parse(goalieData);
    } catch (error) {
      console.error("getGoalies error:", error);
      // Return empty array on error to prevent 503
      return GetGoaliesResponse.parse([]);
    }
  }

  async getProps() {
    console.log(`=== getProps called ===`);
    try {
      const [games, players, playerPropsOdds] = await Promise.all([
        this.getGames().catch(() => GetGamesResponse.parse([])), // Handle timeout gracefully
        this.getPlayers().catch(() => GetPlayersResponse.parse([])), // Handle timeout gracefully
        this.getPlayerPropsOdds(),
      ]);

      console.log(`=== About to call PuckAPI ===`);
      // Fetch PuckAPI odds separately - don't fail if it errors
      let puckapiOdds = new Map<string, Array<{ odds: number; line: number | null; bookmaker: string }>>();
      try {
        puckapiOdds = await this.getPuckapiPlayerProps();
      } catch (error) {
        console.error("PuckAPI fetch failed, continuing without it:", error);
      }
      console.log(`=== PuckAPI call complete, got ${puckapiOdds.size} players ===`);

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
      
      let matchedPlayersCount = 0;

      // Create a map of canonical player names to odds for faster lookup
      const canonicalPlayerName = (name: string) =>
        name.toLowerCase().replace(/[^a-z]/g, "");
      
      const oddsMap = new Map<string, { odds: number; line: number | null; bookmaker: string }>();
      const bookmakerOddsMap = new Map<string, Array<{ odds: number; line: number | null; bookmaker: string }>>();

      for (const prop of playerPropsOdds) {
        const propCanonical = canonicalPlayerName(prop.playerName);
        oddsMap.set(propCanonical, { odds: prop.odds, line: prop.line ?? null, bookmaker: prop.bookmaker });

        // Also add to bookmakerOddsMap for multi-bookmaker support
        if (!bookmakerOddsMap.has(propCanonical)) {
          bookmakerOddsMap.set(propCanonical, []);
        }
        bookmakerOddsMap.get(propCanonical)!.push({
          odds: prop.odds,
          line: prop.line ?? null,
          bookmaker: prop.bookmaker,
        });

        // Also store variations for better matching
        // If name has comma, it's "Last, First" format, add "First Last" variant
        if (prop.playerName.includes(',')) {
          const parts = prop.playerName.split(',').map(p => p.trim());
          if (parts.length === 2) {
            const firstLast = canonicalPlayerName(`${parts[1]} ${parts[0]}`);
            oddsMap.set(firstLast, { odds: prop.odds, line: prop.line ?? null, bookmaker: prop.bookmaker });
            if (!bookmakerOddsMap.has(firstLast)) {
              bookmakerOddsMap.set(firstLast, []);
            }
            bookmakerOddsMap.get(firstLast)!.push({
              odds: prop.odds,
              line: prop.line ?? null,
              bookmaker: prop.bookmaker,
            });
          }
        }
      }

      // Debug: log sample odds
      console.log(`=== TheRundown Player Props Debug ===`);
      console.log(`Total players with odds: ${oddsMap.size}`);
      console.log(`Sample players:`, Array.from(oddsMap.entries()).slice(0, 3).map(([k, v]) => `${k} -> ${v.bookmaker} @ ${v.odds}`));

      // Merge PuckAPI odds into bookmakerOddsMap (if available)
      if (puckapiOdds && puckapiOdds.size > 0) {
        console.log(`=== Merging PuckAPI odds ===`);
        for (const [canonicalName, puckapiOddsForPlayer] of puckapiOdds.entries()) {
          if (!bookmakerOddsMap.has(canonicalName)) {
            bookmakerOddsMap.set(canonicalName, []);
          }
          const existingOdds = bookmakerOddsMap.get(canonicalName)!;
          // Add PuckAPI odds that aren't duplicates
          for (const puckOdds of puckapiOddsForPlayer) {
            const isDuplicate = existingOdds.some(o => o.bookmaker === puckOdds.bookmaker && o.odds === puckOdds.odds);
            if (!isDuplicate) {
              existingOdds.push(puckOdds);
            }
          }
        }
        console.log(`After merge: ${bookmakerOddsMap.size} players with bookmaker odds`);
        console.log(`Sample merged:`, Array.from(bookmakerOddsMap.entries()).slice(0, 3).map(([k, v]) => `${k}: ${v.length} books`));
      } else {
        console.log(`No PuckAPI odds to merge, using Parlay API only`);
      }

      // Calculate predictions for each player
      const props = await Promise.all(
        relevantPlayers.map(async (player) => {
          const opponent = opponentByTeam.get(player.team.id);
          if (!opponent) return null;

          // Use actual season stats if available, otherwise use sportsbook-implied probability as fallback
          const seasonStats = (player as any).seasonStats;
          const seasonGames = Math.max(1, seasonStats?.games || seasonStats?.game || 1);

          let seasonGoalsPerGame, seasonShotsPerGame, seasonPointsPerGame;
          let hasValidStats = false;
          let usingSportsbookImplied = false;

          if (seasonStats && (seasonStats.goals > 0 || seasonStats.goals === 0)) {
            // Use actual stats (handle different field names from different endpoints)
            seasonGoalsPerGame = (seasonStats.goals || 0) / seasonGames;
            seasonShotsPerGame = (seasonStats.shots || seasonStats.sog || 0) / seasonGames;
            seasonPointsPerGame = (seasonStats.points || 0) / seasonGames;
            hasValidStats = true;
            console.log(`${player.fullName}: Using real stats - GPG=${seasonGoalsPerGame.toFixed(3)}, games=${seasonGames}`);
          } else {
            // No NHL stats available - try to use sportsbook implied probability from odds as fallback
            const matchingOddsForProbability = oddsMap.get(canonicalPlayerName(player.fullName)) ||
                                           oddsMap.get(canonicalPlayerName(`${player.lastName}, ${player.firstName}`));
            if (matchingOddsForProbability && matchingOddsForProbability.odds) {
              // Convert sportsbook odds to probability
              const sportsbookOdds = matchingOddsForProbability.odds;
              const sportsbookImplied = sportsbookOdds > 0
                ? 100 / (sportsbookOdds + 100)
                : Math.abs(sportsbookOdds) / (Math.abs(sportsbookOdds) + 100);
              
              // Use sportsbook implied as GPG estimate (conservative adjustment)
              seasonGoalsPerGame = sportsbookImplied;
              seasonShotsPerGame = sportsbookImplied * 10; // Rough estimate: 10 shots per goal
              seasonPointsPerGame = sportsbookImplied * 1.5; // Rough estimate
              hasValidStats = true;
              usingSportsbookImplied = true;
              console.log(`${player.fullName}: Using sportsbook-implied probability as fallback - ${sportsbookImplied.toFixed(3)}`);
            } else {
              // No stats at all - mark as unavailable
              seasonGoalsPerGame = 0;
              seasonShotsPerGame = 0;
              seasonPointsPerGame = 0;
              console.log(`${player.fullName}: No stats available (NHL or sportsbook), probability unavailable`);
            }
          }

          // Calculate probability based on goals per game
          let overProbability, underProbability, modelProjection;
          if (hasValidStats) {
            const baseProbability = seasonGoalsPerGame * 1.5;
            const minProbability = 0.03;
            const maxProbability = 0.70;
            overProbability = Math.min(maxProbability, Math.max(minProbability, baseProbability));
            underProbability = 1 - overProbability;
            modelProjection = seasonGoalsPerGame;
          } else {
            // No valid stats - probability unavailable
            overProbability = 0;
            underProbability = 0;
            modelProjection = 0;
          }

          // Debug logging for specific players with issues
          if (player.fullName === 'Nikolas Matinpalo' || player.fullName === 'Parker Wotherspoon' || player.fullName === 'Zach Metsa') {
            const baseProb = hasValidStats ? seasonGoalsPerGame * 1.5 : 0;
            console.log(`DEBUG ${player.fullName}: GPG=${seasonGoalsPerGame.toFixed(3)}, hasValidStats=${hasValidStats}, baseProb=${baseProb.toFixed(3)}, overProb=${(overProbability * 100).toFixed(1)}%`);
          }

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
        
        // Get all bookmaker odds for this player
        let allBookmakerOdds = bookmakerOddsMap.get(playerCanonical) || bookmakerOddsMap.get(playerLastFirst);
        if (!allBookmakerOdds) {
          for (const [key, value] of bookmakerOddsMap.entries()) {
            if (key.includes(playerCanonical) || key.includes(playerLastFirst) ||
                playerCanonical.includes(key) || playerLastFirst.includes(key)) {
              allBookmakerOdds = value;
              break;
            }
          }
        }
        
        // Count successful matches
        if (matchingOdds) {
          matchedPlayersCount++;
        }

        const odds = matchingOdds?.odds ?? null;
        const line = matchingOdds?.line ?? null;
        const bookmaker = matchingOdds?.bookmaker ?? null;

        // Don't skip players with invalid odds - just mark them as unavailable
        const hasValidOdds = odds !== null && odds !== 0 && odds !== undefined && !isNaN(odds);

        // Debug logging for players with odds issues
        if (player.fullName === 'Nicolas Deslauriers' || player.fullName === 'Mark Jankowski' ||
            player.fullName === 'Jesperi Kotkaniemi' || player.fullName === 'Eric Robinson' ||
            player.fullName === 'Sebastian Aho' || player.fullName === 'Connor McDavid' ||
            player.fullName === 'Mitch Marner' || player.fullName === 'Alexis Lafrenière') {
          console.log(`DEBUG ${player.fullName}: playerCanonical=${playerCanonical}, playerLastFirst=${playerLastFirst}, matchedOdds=${matchingOdds ? 'YES' : 'NO'}, selectedOdds=${bookmaker} @ ${odds}, allBookmakerOdds=${allBookmakerOdds?.length ?? 0}, hasValidOdds=${hasValidOdds}`);
          if (!matchingOdds) {
            // Show available keys that might match
            const similarKeys = Array.from(oddsMap.keys()).filter(k =>
              k.includes(playerCanonical) || k.includes(playerLastFirst) ||
              playerCanonical.includes(k) || playerLastFirst.includes(k)
            ).slice(0, 3);
            console.log(`  Similar keys in oddsMap:`, similarKeys);
          }
        }

        // Calculate edge if we have valid odds AND valid probability (either NHL stats or sportsbook-implied)
        let edge = null;
        if (hasValidOdds && hasValidStats) {
          // Convert American odds to implied probability
          const impliedProb = odds > 0
            ? 100 / (odds + 100)
            : Math.abs(odds) / (Math.abs(odds) + 100);

          edge = overProbability - impliedProb;
          const probSource = usingSportsbookImplied ? 'sportsbook-implied' : 'NHL-stats';
          console.log(`${player.fullName}: odds=${odds}, bookmaker=${bookmaker}, impliedProb=${(impliedProb * 100).toFixed(1)}%, overProb=${(overProbability * 100).toFixed(1)}%, edge=${(edge * 100).toFixed(1)}% (${probSource})`);
        } else {
          if (!hasValidOdds) {
            console.log(`${player.fullName}: No valid odds (odds=${odds}), edge=null`);
          }
          if (!hasValidStats) {
            console.log(`${player.fullName}: No valid stats, edge=null`);
          }
        }

        const { confidenceFromEdge } = await import("../models/confidence");
        // Allow confidence calculation even with sportsbook-implied stats, but not if probability is 0
        const confidence = (edge !== null && overProbability > 0) ? confidenceFromEdge(edge, seasonGames) : null;

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
          line, // This is the bet line (e.g., 0 for anytime goal, +6.5 for totals)
          lineStatus: hasValidOdds ? ("available" as const) : ("unavailable" as const),
          modelProjection: seasonGoalsPerGame,
          overProbability,
          underProbability,
          edge,
          confidence,
          source: usingSportsbookImplied ? `${bookmaker ?? 'Parlay'} (implied)` : (bookmaker ?? null),
          odds, // Add the actual odds/price (e.g., +2200, -150)
          bookmakerOdds: allBookmakerOdds || [], // All bookmaker odds for this player
        };
      })
    );

    // Log sample projections for debugging
    console.log(`=== Sample Player Projections ===`);
    props.slice(0, 5).forEach((p) => {
      if (p) {
        console.log(`${p.player.fullName}: projection=${p.modelProjection.toFixed(3)}, prob=${(p.overProbability * 100).toFixed(1)}%, edge=${(p.edge * 100).toFixed(1)}%`);
      }
    });

    // Filter out nulls and sort by edge
    const validProps = props.filter((p): p is NonNullable<typeof p> => p !== null);
    validProps.sort((a, b) => (b.edge ?? -1) - (a.edge ?? -1));

    const propsWithRealOdds = validProps.filter(p => p.lineStatus === 'available');
    const propsWithoutOdds = validProps.filter(p => p.lineStatus === 'unavailable');

    console.log(`=== Props Summary ===`);
    console.log(`Total players processed: ${relevantPlayers.length}`);
    console.log(`Players with matched odds in map: ${matchedPlayersCount}`);
    console.log(`Props with valid real odds: ${propsWithRealOdds.length}`);
    console.log(`Props without valid odds: ${propsWithoutOdds.length}`);

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
    if (!THERUNDOWN_API_KEY) {
      console.warn("THERUNDOWN_API_KEY not configured, returning unconfigured odds response");
      return GetOddsResponse.parse({ provider: "TheRundown", configured: false, lastUpdated: null, games: [] });
    }
    if (oddsCache && oddsCache.expiresAt > Date.now()) return oddsCache.data;

    try {
      const today = new Date().toISOString().slice(0, 10);
      const [therundownEvents, currentGames, futureGames, todayGames] = await Promise.all([
        this.getTheRundownEvents(false), // false = only core markets, not player props
        this.getGames(),
        this.getFutureGames(),
        this.getGames(today), // Today's games to match TheRundown events
      ]);
      const verifiedGames = [...currentGames, ...futureGames, ...todayGames];

      // Map affiliate IDs to bookmaker names for display
      const affiliateNames: Record<number, string> = {
        19: "DraftKings",
        23: "FanDuel",
        22: "BetMGM",
        3: "Pinnacle",
        32: "Circa Sports",
        7: "BookMaker",
        9: "BetCRIS",
        2: "Bovada",
        24: "theScore Bet",
        21: "Unibet",
        28: "HardRock",
        33: "Bet105",
        34: "Heritage Sports",
        6: "BetOnline",
        4: "SportsBetting",
        11: "LowVig",
        14: "Intertops",
        16: "Matchbook",
        18: "YouWager",
      };

      // Match TheRundown events to NHL games by team names
      const games = therundownEvents.flatMap((event) => {
        const awayAbbr = mapTheRundownTeamToNHL(event.teams[0].name, event.teams[0].abbreviation || "");
        const homeAbbr = mapTheRundownTeamToNHL(event.teams[1].name, event.teams[1].abbreviation || "");

        // Try matching by mapped abbreviation
        const game = verifiedGames.find((candidate) =>
          candidate.awayTeam.abbreviation === awayAbbr &&
          candidate.homeTeam.abbreviation === homeAbbr
        );

        if (!game) {
          return [];
        }

        // Build sportsbooks array from TheRundown markets
        const sportsbooks = new Map<number, {
          key: string;
          title: string;
          lastUpdate: string;
          markets: Array<{
            key: string;
            name: string;
            label: string; // Required by schema
            outcomes: Array<{
              name: string;
              price: number;
              point: number; // Required by schema
            }>;
          }>;
        }>();

        // Process each market
        for (const market of event.markets) {
          const marketName = market.name;

          for (const participant of market.participants) {
            for (const line of participant.lines) {
              // Extract line value if present (for spreads/totals)
              const lineValue = line.value ? parseFloat(line.value.replace(/[^\d.-]/g, '')) : null;

              // Process each affiliate (sportsbook)
              for (const [affiliateId, priceData] of Object.entries(line.prices)) {
                const affId = parseInt(affiliateId);
                if (!sportsbooks.has(affId)) {
                  sportsbooks.set(affId, {
                    key: affiliateNames[affId] || `affiliate_${affId}`,
                    title: affiliateNames[affId] || `Affiliate ${affId}`,
                    lastUpdate: priceData.updated_at,
                    markets: [],
                  });
                }

                const sportsbook = sportsbooks.get(affId)!;

                // Find or create market in this sportsbook
                let marketObj = sportsbook.markets.find(m => m.key === String(market.market_id));
                if (!marketObj) {
                  marketObj = {
                    key: String(market.market_id),
                    name: marketName,
                    label: marketName, // Add required label field
                    outcomes: [],
                  };
                  sportsbook.markets.push(marketObj);
                }

                // Add outcome with required point field
                marketObj.outcomes.push({
                  name: participant.name,
                  price: priceData.price,
                  point: lineValue ?? 0, // Default to 0 if no line value
                });
              }
            }
          }
        }

        return [{
          game,
          sportsbooks: Array.from(sportsbooks.values()),
        }];
      });

      const data = GetOddsResponse.parse({
        provider: "TheRundown & Parlay",
        configured: true,
        lastUpdated: new Date().toISOString(),
        games
      });
      oddsCache = { expiresAt: Date.now() + 60_000, data };
      return data;
    } catch (error) {
      console.error("TheRundown odds fetch error:", error);
      // Return gracefully degraded response instead of throwing
      return GetOddsResponse.parse({
        provider: "TheRundown",
        configured: true,
        lastUpdated: null,
        games: []
      });
    }
  }

  async getPlayerPropsOdds() {
    if (!PARLAY_API_KEY) return [];

    try {
      // Get player props from Parlay API
      const parlayProps = await this.getParlayPlayerProps();
      if (!parlayProps.length) {
        return [];
      }

      // Convert Parlay props to our internal format - keep all bookmakers
      const playerProps: Array<{
        playerName: string;
        odds: number;
        bookmaker: string;
        line?: number;
      }> = [];

      for (const prop of parlayProps) {
        // Filter to only anytime goal scorer market
        if (prop.market_key !== 'player_anytime_goal') {
          continue;
        }

        // Strip team suffix from player name (e.g., "Sebastian Aho (CAR)" -> "Sebastian Aho")
        let playerName = prop.player;
        const suffixMatch = playerName.match(/^(.+?)\s+\([A-Z]{3}\)$/);
        if (suffixMatch) {
          playerName = suffixMatch[1];
        }

        // Add over price if available
        if (prop.over_price !== null && prop.over_price !== 0) {
          playerProps.push({
            playerName,
            odds: prop.over_price,
            bookmaker: prop.bookmaker_title,
            line: prop.line,
          });
        }

        // Add under price if available
        if (prop.under_price !== null && prop.under_price !== 0) {
          playerProps.push({
            playerName,
            odds: prop.under_price,
            bookmaker: prop.bookmaker_title,
            line: prop.line,
          });
        }
      }

      console.log(`=== getPlayerPropsOdds Normalization ===`);
      console.log(`Total anytime-goal props from Parlay: ${playerProps.length}`);
      console.log(`Sample props:`, playerProps.slice(0, 5).map(p => `${p.playerName} @ ${p.odds} (${p.bookmaker})`));

      return playerProps;
    } catch (error) {
      console.error("Error fetching player props from Parlay API:", error);
      return [];
    }
  }

  async getPuckapiPlayerProps(): Promise<Map<string, Array<{ odds: number; line: number | null; bookmaker: string }>>> {
    console.log(`=== PuckAPI Check ===`);
    console.log(`PUCKAPI_API_KEY configured: ${!!PUCKAPI_API_KEY}`);
    console.log(`PUCKAPI_API_KEY length: ${PUCKAPI_API_KEY?.length || 0}`);
    
    // Temporarily disable PuckAPI due to 402/payment errors
    console.log("PuckAPI temporarily disabled due to authentication issues");
    return new Map();
    
    if (!PUCKAPI_API_KEY) {
      console.log("PUCKAPI_API_KEY not configured, skipping PuckAPI");
      return new Map();
    }

    try {
      // PuckAPI requires game_id, so we need to get today's games first
      const games = await this.getGames();
      if (!games.length) {
        console.log("No games available for PuckAPI");
        return new Map();
      }

      const bookmakerOddsMap = new Map<string, Array<{ odds: number; line: number | null; bookmaker: string }>>();

      // Fetch odds for each game (limit to first 1 game to save credits and avoid rate limits)
      for (const game of games.slice(0, 1)) {
        try {
          // Add delay between requests to avoid rate limiting
          if (games.indexOf(game) > 0) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
          }

          const response = await fetch('https://mcp.puckapi.com/v1/get_player_props', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': PUCKAPI_API_KEY,
            },
            body: JSON.stringify({
              game_id: game.id,
              market: 'player_goals',
            }),
          });

          if (response.status === 429) {
            console.error(`PuckAPI rate limited for game ${game.id}, skipping remaining games`);
            break; // Stop fetching if rate limited
          }

          if (!response.ok) {
            console.error(`PuckAPI error for game ${game.id}:`, response.status);
            continue;
          }

          const data = await response.json();
          console.log(`PuckAPI response for game ${game.id}:`, JSON.stringify(data).slice(0, 500));

          if (data.props && Array.isArray(data.props)) {
            for (const prop of data.props) {
              const playerName = prop.player_name;
              const canonicalName = playerName.toLowerCase().replace(/[^a-z]/g, '');

              if (!bookmakerOddsMap.has(canonicalName)) {
                bookmakerOddsMap.set(canonicalName, []);
              }

              // Add odds from each bookmaker
              if (prop.all_books && Array.isArray(prop.all_books)) {
                for (const book of prop.all_books) {
                  bookmakerOddsMap.get(canonicalName)!.push({
                    odds: book.over_juice || book.over_price || 0,
                    line: book.line || 0,
                    bookmaker: book.sportsbook_display || book.sportsbook || 'Unknown',
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching PuckAPI odds for game ${game.id}:`, error);
        }
      }

      console.log(`=== PuckAPI Player Props ===`);
      console.log(`Total players with odds: ${bookmakerOddsMap.size}`);
      console.log(`Sample:`, Array.from(bookmakerOddsMap.entries()).slice(0, 3).map(([name, odds]) => `${name}: ${odds.length} books`));

      return bookmakerOddsMap;
    } catch (error) {
      console.error("Error fetching from PuckAPI:", error);
      return new Map();
    }
  }

  async getSnipes() {
    try {
      const props = await this.getProps();
      // Return top props as snipes (any with valid edge > 0 and probability > 0)
      // This includes both NHL stats and sportsbook-implied probabilities
      const snipes = props.filter(p => p.edge !== null && p.edge > 0 && p.overProbability > 0).slice(0, 10);
      
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
      const topConfidence = snipes.length > 0 ? snipes[0]?.player?.fullName || null : null;
      try {
        return GetDashboardSummaryResponse.parse({
          dataStatus: {
            state: games.length > 0 ? "live" : "partial",
            provider: this.name,
            lastUpdated: new Date().toISOString(),
            message: games.length > 0
              ? `Official NHL schedule, roster and player data is available. ${THERUNDOWN_API_KEY ? "Sportsbook odds are connected via TheRundown. Player props via Parlay API." : "Sportsbook odds are not configured."} ${THERUNDOWN_API_KEY ? " When NHL player stats are unavailable, sportsbook-implied probability is used as fallback." : ""} Model feed is not configured.`
              : `Official NHL data is connected, but no verified games were returned for today's NHL date. ${INCLUDE_PRESEASON ? "Preseason is included when the provider publishes it." : `Preseason is excluded before ${NHL_SEASON_START_DATE}.`} ${THERUNDOWN_API_KEY ? "Sportsbook odds are connected via TheRundown when markets are posted. Player props via Parlay API." : "Sportsbook odds are not configured."} Model feed is not configured.`,
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
          games: 0,
          snipes: 0,
          playersAnalyzed: 0,
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
    console.log("=== Starting NHL Sync ===");
    try {
      const [teams, currentGames, players, futureGames] = await Promise.all([
        this.getTeams(),
        this.getGames(),
        this.getPlayers(),
        this.getFutureGames(),
      ]);
      console.log(`Sync: Fetched ${teams.length} teams, ${currentGames.length} current games, ${players.length} players, ${futureGames.length} future games`);
      const games = Array.from(new Map([...currentGames, ...futureGames].map((game) => [game.id, game])).values());
      
      // Only insert into database if configured - but don't fail sync if DB fails
      if (databaseConfigured) {
        try {
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
        console.log("Sync: Database insert successful");
        } catch (dbError) {
          console.error("Sync: Database insert failed, but data is in memory cache:", dbError);
          // Don't fail the sync - data is still available in memory
        }
      } else {
        console.log("Sync: Database not configured, data stored in memory cache only");
      }

      const completedAt = new Date().toISOString();
      console.log(`=== Sync completed successfully: ${teams.length} teams, ${games.length} games, ${players.length} players ===`);
      Object.assign(syncHealth, { connection: "connected", lastSuccessfulSync: completedAt, teamsImported: teams.length, gamesImported: games.length, playersImported: players.length, playerStatsImported: 0, goalieStatsImported: 0 });
      return { provider: this.name, startedAt, completedAt, teamsImported: teams.length, gamesImported: games.length, playersImported: players.length, playerStatsImported: 0, goalieStatsImported: 0, errors: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown synchronization error";
      console.error("=== Sync failed ===");
      console.error("Error:", message);
      console.error("Full error:", error);
      syncHealth.connection = "error";
      syncHealth.errors = [message];
      syncHealth.lastSuccessfulSync = null; // Clear on error
      // Return error report instead of throwing
      const completedAt = new Date().toISOString();
      return { provider: this.name, startedAt, completedAt, teamsImported: 0, gamesImported: 0, playersImported: 0, playerStatsImported: 0, goalieStatsImported: 0, errors: [message] };
    }
  }
}

export function getNhlProvider(): NhlDataProvider {
  return new NhlWebApiProvider();
}

export function getDataHealth(): DataHealth {
  return { ...syncHealth, errors: [...syncHealth.errors] };
}