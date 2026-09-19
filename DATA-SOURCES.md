# NHLsnipes data sources

NHLsnipes is designed around provider adapters. The app does not scrape NHL EDGE or NHL.com endpoints and does not assume that official tracking data is licensed for commercial redistribution.

## Configured provider

The default live adapter is the public NHL Web API at `https://api-web.nhle.com/v1`. It uses the schedule/score, standings, roster, and player landing endpoints server-side. No API key is required for the public endpoints currently used by the adapter. Commercial redistribution, caching, and logo/headshot usage still require review against the NHL's current terms; this is not a claim of NHL endorsement or a commercial license.

Team crest and player headshot fields are provider-supplied references only. NHLsnipes does not download or bundle NHL-owned images in the repository. A deployment must confirm that its selected provider permits displaying and caching those references for the intended audience. The provider adapter can be replaced through `NHLSNIPES_NHL_API_BASE_URL` or a permitted `NHLSNIPES_PROVIDER_URL` without changing frontend components.

The base URL can be overridden with `NHLSNIPES_NHL_API_BASE_URL`. The app also requires a verified season boundary through `NHLSNIPES_SEASON_START_DATE`; records earlier than that date are discarded rather than shown as current games.
If a permitted provider returns relative asset references, set `NHLSNIPES_ASSET_BASE_URL` to the approved asset host. Absolute provider URLs are passed through; relative references are ignored unless that base is configured.

## Provider contract

Set `NHLSNIPES_PROVIDER_URL` to a server-side adapter that is permitted to provide the data for your intended use. The adapter is expected to expose the read-only routes described in `lib/api-spec/openapi.yaml`, including `/dashboard/summary`, `/games`, `/players`, `/teams`, `/goalies`, `/props`, `/matchups`, `/snipes`, `/audit`, and `/model-performance`.

The app validates provider responses against the generated Zod schemas before returning them to the client. A missing or invalid provider response is surfaced as a data-provider error; it is never replaced with invented numbers.

## NHL schedule, roster and stats

The selected adapter is responsible for its upstream schedule, roster, team crest, player headshot, player-statistics, goalie-statistics and game-event sources. Record the upstream vendor, endpoint, license or terms, refresh cadence, retention policy and commercial redistribution permissions in the adapter's deployment documentation before enabling it. Asset references are normalized into team and player records, persisted as URLs/references, and consumed by reusable frontend asset components.

## NHL EDGE and advanced tracking

NHL EDGE includes extensive skating, shot, location and puck-zone metrics. Those metrics may require separate permission or licensing for public or commercial redistribution. NHLsnipes intentionally exposes an adapter boundary so a licensed source can be used without changing the application or model interfaces.

## Odds and sportsbook lines

Sportsbook lines must come from an approved odds provider configured server-side. If `NHLSNIPES_ODDS_PROVIDER_URL` is not configured or a market is missing, the product displays `LINE DATA UNAVAILABLE` and does not substitute a line.

## Development behavior

With no provider configured, the API returns empty arrays and an `offline` data status. This is deliberate. Development seed data, when used, must be labeled as demo data and must not be presented as live NHL data. If a provider omits or rejects an asset reference, the UI renders an NHLsnipes placeholder rather than a broken image or an unrelated stock image.