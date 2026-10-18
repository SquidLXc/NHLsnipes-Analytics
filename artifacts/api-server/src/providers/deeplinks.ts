// Isolated provider for sportsbook deep links
// Only fetches deep links when requested - does not interfere with existing odds providers

const SHARPAPI_API_KEY = process.env.SHARPAPI_API_KEY;
const SHARPAPI_BASE_URL = "https://api.sharpapi.io/api/v1";

// Cache for deep links (5 minute TTL)
interface CachedDeepLink {
  url: string;
  timestamp: number;
}
const deepLinkCache = new Map<string, CachedDeepLink>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface SharpAPIDeepLinkResponse {
  url: string;
  deep_link_type: string;
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
 * Fetch a deep link from SharpAPI for a given odds ID
 * This is isolated - it only runs when the user clicks "Open DraftKings"
 */
async function fetchSharpAPIDeepLink(oddsId: string): Promise<string | null> {
  if (!SHARPAPI_API_KEY) {
    console.log("SharpAPI not configured - deep links unavailable");
    return null;
  }

  // Check cache first
  const cached = deepLinkCache.get(oddsId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Using cached deep link for odds ID: ${oddsId}`);
    return cached.url;
  }

  try {
    console.log(`Fetching SharpAPI deep link for odds ID: ${oddsId}`);
    const response = await fetch(`${SHARPAPI_BASE_URL}/deeplink/${oddsId}?book=draftkings`, {
      headers: {
        "x-api-key": SHARPAPI_API_KEY,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    if (!response.ok) {
      console.error(`SharpAPI deep link request failed: ${response.status}`);
      return null;
    }

    // SharpAPI returns a 302 redirect, but we can't follow it programmatically easily
    // The Location header contains the deep link URL
    const location = response.headers.get("Location");
    if (location) {
      console.log(`SharpAPI deep link fetched: ${location}`);
      // Cache the result
      deepLinkCache.set(oddsId, {
        url: location,
        timestamp: Date.now(),
      });
      return location;
    }

    // If no Location header, try parsing as JSON
    const data = await response.json() as SharpAPIDeepLinkResponse;
    if (data.url) {
      console.log(`SharpAPI deep link fetched from JSON: ${data.url}`);
      deepLinkCache.set(oddsId, {
        url: data.url,
        timestamp: Date.now(),
      });
      return data.url;
    }

    console.log("SharpAPI returned no deep link URL");
    return null;
  } catch (error) {
    console.error("SharpAPI deep link fetch error:", error);
    return null;
  }
}

/**
 * Normalize player name for matching
 * Removes team suffixes and normalizes spacing
 */
function normalizePlayerName(name: string): string {
  // Remove team suffix like " (EDM)"
  const withoutSuffix = name.replace(/\s+\([A-Z]{3}\)$/, "");
  // Normalize spacing
  return withoutSuffix.trim().toLowerCase();
}

/**
 * Normalize market name for matching
 */
function normalizeMarket(market: string): string {
  const marketLower = market.toLowerCase();
  // Map common market name variations
  const marketMap: Record<string, string> = {
    "goals": "player_goals_anytime",
    "anytime goal": "player_goals_anytime",
    "goal scorer": "player_goals_anytime",
  };
  return marketMap[marketLower] || marketLower;
}

/**
 * Generate a cache key for a selection
 */
function getSelectionCacheKey(selection: Selection): string {
  const normalizedPlayer = normalizePlayerName(selection.playerName);
  const normalizedMarket = normalizeMarket(selection.market);
  const line = selection.line ?? "anytime";
  return `${normalizedPlayer}:${normalizedMarket}:${line}:${selection.team}`;
}

/**
 * Get DraftKings deep links for a list of selections
 * This is a best-effort implementation - matching is not guaranteed
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

  // Note: SharpAPI requires odds IDs from their own odds feed
  // Since we're using Parlay API for odds, we don't have SharpAPI odds IDs
  // This is a known limitation - we cannot reliably match selections

  // Fallback: Return generic DraftKings URL
  // This is the safe approach - we don't claim to support autofill when we can't
  const errors: string[] = [];
  let matched = 0;
  let unmatched = selections.length;

  // For now, we cannot use SharpAPI deep links because:
  // 1. We don't have SharpAPI odds IDs (we use Parlay API)
  // 2. Selection matching across providers is unreliable
  // 3. We would need to dual-fetch odds (Parlay + SharpAPI)

  errors.push(
    "SharpAPI deep links require SharpAPI odds IDs. " +
    "Current implementation uses Parlay API for odds. " +
    "To enable deep links, you would need to: " +
    "1) Fetch odds from SharpAPI instead of Parlay API, OR " +
    "2) Dual-fetch odds from both providers (increased cost/complexity)."
  );

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
