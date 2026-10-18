// Isolated provider for sportsbook deep links
// Dual-fetch: Uses SharpAPI for deep links while Parlay API powers the main UI

const SHARPAPI_API_KEY = process.env.SHARPAPI_API_KEY;
const SHARPAPI_BASE_URL = "https://api.sharpapi.io/api/v1";

// Cache for odds (5 minute TTL) - only used for deep link matching
interface CachedOdds {
  data: any[];
  timestamp: number;
}
const oddsCache = new Map<string, CachedOdds>();
const ODDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache for deep links (5 minute TTL)
interface CachedDeepLink {
  url: string;
  timestamp: number;
}
const deepLinkCache = new Map<string, CachedDeepLink>();
const DEEP_LINK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface SharpAPIOddsItem {
  id: string;
  sportsbook: string;
  event_id: string;
  event_start_time: string;
  home_team: string;
  away_team: string;
  market_type: string;
  selection: string;
  selection_type: string;
  line: number | null;
  deep_link: string;
  is_player_prop: boolean;
}

interface Selection {
  playerName: string;
  market: string;
  line: number | null;
  team: string;
  opponent: string;
}

interface DeepLinkResult {
  deepLinks: {
    desktop: string | null;
    ios: string | null;
    android: string | null;
  };
  matched: number;
  unmatched: number;
  errors: string[];
}

/**
 * Fetch SharpAPI odds for NHL player props
 * This is only called when user clicks "Open DraftKings" - not during normal page loads
 */
async function fetchSharpAPIOdds(): Promise<SharpAPIOddsItem[]> {
  if (!SHARPAPI_API_KEY) {
    console.log("SharpAPI not configured");
    return [];
  }

  // Check cache first
  const cacheKey = "nhl:player-props";
  const cached = oddsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ODDS_CACHE_TTL) {
    console.log("Using cached SharpAPI odds");
    return cached.data;
  }

  try {
    console.log("Fetching SharpAPI odds for NHL player props");
    const response = await fetch(
      `${SHARPAPI_BASE_URL}/odds?sport=hockey&league=NHL&book=draftkings`,
      {
        headers: {
          "x-api-key": SHARPAPI_API_KEY,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(15_000), // 15 second timeout
      }
    );

    if (!response.ok) {
      console.error(`SharpAPI odds request failed: ${response.status}`);
      return [];
    }

    const data = await response.json() as { data: SharpAPIOddsItem[] };
    console.log(`Fetched ${data.data.length} SharpAPI odds items`);

    // Cache the result
    oddsCache.set(cacheKey, {
      data: data.data,
      timestamp: Date.now(),
    });

    return data.data;
  } catch (error) {
    console.error("SharpAPI odds fetch error:", error);
    return [];
  }
}

/**
 * Fetch a deep link from SharpAPI for a given odds ID
 */
async function fetchSharpAPIDeepLink(oddsId: string): Promise<string | null> {
  if (!SHARPAPI_API_KEY) {
    return null;
  }

  // Check cache first
  const cached = deepLinkCache.get(oddsId);
  if (cached && Date.now() - cached.timestamp < DEEP_LINK_CACHE_TTL) {
    return cached.url;
  }

  try {
    const response = await fetch(`${SHARPAPI_BASE_URL}/deeplink/${oddsId}?book=draftkings`, {
      headers: {
        "x-api-key": SHARPAPI_API_KEY,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    const location = response.headers.get("Location");
    if (location) {
      deepLinkCache.set(oddsId, {
        url: location,
        timestamp: Date.now(),
      });
      return location;
    }

    return null;
  } catch (error) {
    console.error("SharpAPI deep link fetch error:", error);
    return null;
  }
}

/**
 * Normalize player name for matching
 */
function normalizePlayerName(name: string): string {
  const withoutSuffix = name.replace(/\s+\([A-Z]{3}\)$/, "");
  return withoutSuffix.trim().toLowerCase();
}

/**
 * Normalize market name for matching
 */
function normalizeMarket(market: string): string {
  const marketLower = market.toLowerCase();
  const marketMap: Record<string, string> = {
    "goals": "player_goals_anytime",
    "anytime goal": "player_goals_anytime",
    "goal scorer": "player_goals_anytime",
  };
  return marketMap[marketLower] || marketLower;
}

/**
 * Normalize team name for matching
 */
function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

/**
 * Try to match a selection to SharpAPI odds
 * Best-effort matching - not guaranteed
 */
function matchSelectionToOdds(selection: Selection, odds: SharpAPIOddsItem[]): SharpAPIOddsItem | null {
  const normalizedPlayer = normalizePlayerName(selection.playerName);
  const normalizedMarket = normalizeMarket(selection.market);
  const normalizedTeam = normalizeTeamName(selection.team);
  const normalizedOpponent = normalizeTeamName(selection.opponent);
  const line = selection.line;

  for (const odd of odds) {
    // Must be DraftKings
    if (odd.sportsbook.toLowerCase() !== "draftkings") continue;

    // Must be player prop (check if selection contains player name, not team name)
    const oddPlayer = normalizePlayerName(odd.selection);
    const oddMarket = odd.market_type.toLowerCase();
    const oddHomeTeam = normalizeTeamName(odd.home_team);
    const oddAwayTeam = normalizeTeamName(odd.away_team);
    const oddLine = odd.line;

    // Check if market is a player prop market (contains "player" or is goal-related)
    const isPlayerPropMarket =
      oddMarket.includes("player") ||
      oddMarket.includes("goal") ||
      oddMarket.includes("scorer") ||
      oddMarket.includes("point") ||
      oddMarket.includes("assist") ||
      oddMarket.includes("shot");

    if (!isPlayerPropMarket) continue;

    // Check if player name matches (contains match for flexibility)
    if (!oddPlayer.includes(normalizedPlayer) && !normalizedPlayer.includes(oddPlayer)) {
      continue;
    }

    // Check if market matches (more flexible matching)
    if (oddMarket !== normalizedMarket &&
        !oddMarket.includes("goal") && !normalizedMarket.includes("goal")) {
      continue;
    }

    // Check if teams match (either home or away)
    if (oddHomeTeam !== normalizedTeam && oddAwayTeam !== normalizedTeam) {
      continue;
    }

    // Check if opponent matches
    if (oddHomeTeam !== normalizedOpponent && oddAwayTeam !== normalizedOpponent) {
      continue;
    }

    // Check if line matches (if selection has a line)
    if (line !== null && oddLine !== null && Math.abs(oddLine - line) > 0.1) {
      continue;
    }

    // If all checks pass, we have a match
    console.log(`Matched selection: ${selection.playerName} to SharpAPI odds ID: ${odd.id} (market: ${odd.market_type})`);
    return odd;
  }

  return null;
}

/**
 * Get DraftKings deep links for a list of selections
 * Dual-fetch approach: Fetches SharpAPI odds to get odds IDs, then generates deep links
 */
export async function getDraftKingsDeepLinks(selections: Selection[]): Promise<DeepLinkResult> {
  console.log(`=== DraftKings Deep Links Request ===`);
  console.log(`Selections: ${selections.length}`);
  console.log(`SharpAPI configured: ${!!SHARPAPI_API_KEY}`);

  if (!SHARPAPI_API_KEY) {
    return {
      deepLinks: { desktop: null, ios: null, android: null },
      matched: 0,
      unmatched: selections.length,
      errors: ["SharpAPI not configured"],
    };
  }

  const errors: string[] = [];
  const matchedOddsIds: string[] = [];
  let matched = 0;
  let unmatched = 0;

  try {
    // Fetch SharpAPI odds for matching
    const sharpAPIOdds = await fetchSharpAPIOdds();
    console.log(`SharpAPI odds fetched: ${sharpAPIOdds.length} items`);

    // Match each selection to SharpAPI odds
    for (const selection of selections) {
      const matchedOdd = matchSelectionToOdds(selection, sharpAPIOdds);
      if (matchedOdd) {
        matchedOddsIds.push(matchedOdd.id);
        matched++;
      } else {
        unmatched++;
        errors.push(`Could not match selection: ${selection.playerName} - ${selection.market}`);
      }
    }

    console.log(`Matched ${matched} selections, ${unmatched} unmatched`);

    // If we have matched odds, try to get deep links
    if (matchedOddsIds.length > 0) {
      // For individual selections, use the first matched odds ID
      // For parlays, we would need to concatenate deep links (not supported by this implementation)
      const firstOddsId = matchedOddsIds[0];
      const deepLink = await fetchSharpAPIDeepLink(firstOddsId);

      if (deepLink) {
        console.log(`Deep link generated: ${deepLink}`);
        return {
          deepLinks: {
            desktop: deepLink,
            ios: deepLink.replace("https://sportsbook.draftkings.com/", "dksb://sb/addbet/"),
            android: deepLink.replace("https://sportsbook.draftkings.com/", "dksb://sb/addbet/"),
          },
          matched,
          unmatched,
          errors: [],
        };
      } else {
        errors.push("Failed to generate deep link from SharpAPI");
      }
    } else {
      errors.push("No selections matched to SharpAPI odds");
    }
  } catch (error) {
    console.error("Deep link generation error:", error);
    errors.push(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  console.log(`=== Deep Links Result ===`);
  console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);
  console.log(`Errors:`, errors);

  return {
    deepLinks: {
      desktop: null,
      ios: null,
      android: null,
    },
    matched,
    unmatched,
    errors,
  };
}

/**
 * Get a generic DraftKings URL (fallback)
 */
export function getGenericDraftKingsURL(): string {
  return "https://sportsbook.draftkings.com/leagues/hockey/nhl?category=player-props";
}
