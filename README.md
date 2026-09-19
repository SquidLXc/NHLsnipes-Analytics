# NHLsnipes

NHLsnipes is an independent NHL analytics platform for matchup analysis, player edges, props, goalie environments and transparent model audit history.

## Run locally

```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/nhlsnipes run dev
```

The managed workflows provide the required `PORT` and `BASE_PATH` values for Replit previews. Without `NHLSNIPES_PROVIDER_URL`, the API intentionally returns an offline status and empty datasets rather than fake live numbers.

## Checks

```bash
pnpm run typecheck
pnpm run build
```

## Data and legal boundaries

Read `DATA-SOURCES.md` before configuring a provider. NHLsnipes is independent and is not affiliated with or endorsed by the National Hockey League. Analytics are informational and do not guarantee outcomes.