# NHLsnipes data sources

NHLsnipes is designed around provider adapters and does not assume that official tracking data is licensed for commercial redistribution.

## Configured provider

The default live adapter is the public NHL Web API at `https://api-web.nhle.com/v1`. It uses the schedule/score, standings, roster, and player landing endpoints server-side. No API key is required for the public endpoints currently used by the adapter. Commercial redistribution, caching, and logo/headshot usage still require review against the NHL's current terms; this is not a claim of NHL endorsement or a commercial license.

Team crest and player headshot fields are provider-supplied references only. NHLsnipes does not download or bundle NHL-owned images in the repository. A deployment must confirm that its selected provider permits displaying and caching those references for the intended audience. The provider adapter can be replaced through `NHLSNIPES_NHL_API_BASE_URL` or a permitted `NHLSNIPES_PROVIDER_URL` without changing frontend components.

The concrete base URL is configured with `NHLSNIPES_NHL_API_BASE_URL`. Preseason is included by default with `NHLSNIPES_INCLUDE_PRESEASON=true`, so verified preseason games appear in today's and future slates. Set it to `false` to enforce the regular-season boundary in `NHLSNIPES_SEASON_START_DATE`.
If a permitted provider returns relative asset references, set `NHLSNIPES_ASSET_BASE_URL` to the approved asset host. Absolute provider URLs are passed through; relative references are ignored unless that base is configured.

## Provider contract

The current implementation directly normalizes the NHL Web API endpoints used by `artifacts/api-server/src/providers/nhl.ts`. If the source changes, replace that provider adapter only after confirming the replacement permits the intended use; do not point the app at an undocumented or unlicensed endpoint.

The app validates provider responses against the generated Zod schemas before returning them to the client. A missing or invalid provider response is surfaced as a data-provider error; it is never replaced with invented numbers.

## NHL schedule, roster and stats

The selected adapter is responsible for its upstream schedule, roster, team crest, player headshot, player-statistics, goalie-statistics and game-event sources. Record the upstream vendor, endpoint, license or terms, refresh cadence, retention policy and commercial redistribution permissions in the adapter's deployment documentation before enabling it. Asset references are normalized into team and player records, persisted as URLs/references, and consumed by reusable frontend asset components.

## NHL EDGE and advanced tracking

NHL EDGE includes extensive skating, shot, location and puck-zone metrics. Those metrics may require separate permission or licensing for public or commercial redistribution. NHLsnipes intentionally exposes an adapter boundary so a licensed source can be used without changing the application or model interfaces.

## Odds and sportsbook lines

Sportsbook lines come from The Odds API configured server-side with `ODDS_API_KEY`. If the secret is not configured or a market is missing, the product displays an unavailable state and does not substitute a line.

## Development behavior

With no provider configured, the API returns empty arrays and an `offline` data status. This is deliberate. Development seed data, when used, must be labeled as demo data and must not be presented as live NHL data. If a provider omits or rejects an asset reference, the UI renders an NHLsnipes placeholder rather than a broken image or an unrelated stock image.