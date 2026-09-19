# NHLsnipes

NHLsnipes is an independent NHL analytics platform for matchup analysis, player edges, props, goalie environments and transparent model audit history.

## Run locally

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/nhlsnipes run dev
```

The managed workflows provide the required `PORT` and `BASE_PATH` values for Replit previews. The API uses the NHL Web API base configured by `NHLSNIPES_NHL_API_BASE_URL`; it never substitutes fake or random NHL data. `ODDS_API_KEY` is server-only and enables sportsbook prices from The Odds API.

## Production

```bash
pnpm run build:production
PORT=8080 SERVE_FRONTEND=true NODE_ENV=production pnpm run start:production
```

The production server binds to `0.0.0.0`, serves the built React app, and exposes the API at `/api`. Set `DATABASE_URL` before starting so scheduled sync and dependency health checks can run. Set `NHLSNIPES_SYNC_INTERVAL_MS` to a positive number of milliseconds to enable scheduled NHL ingestion.

## Checks

```bash
pnpm run typecheck
pnpm run build
```

## Data and legal boundaries

Read `DATA-SOURCES.md` before configuring a provider. NHLsnipes is independent and is not affiliated with or endorsed by the National Hockey League. Analytics are informational and do not guarantee outcomes.