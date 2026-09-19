# NHLsnipes deployment

## Replit

1. Provision PostgreSQL for the project.
2. Add `DATABASE_URL` through the Replit Secrets or environment-variable UI.
3. Keep `NHLSNIPES_NHL_API_BASE_URL` pointed at a permitted NHL data source.
4. Add the server-only `ODDS_API_KEY` secret if sportsbook lines are part of the product scope.
5. Run `pnpm install`, `pnpm run typecheck`, and `pnpm run build:production`.
6. Publish the root `nhlsnipes` web artifact. Its production build compiles both the React frontend and API server, and its production process serves both at one origin.
7. Verify `/`, `/snipes`, `/props`, `/goalies`, `/matchups`, `/teams`, `/audit`, `/admin`, and `/api/healthz`.

## Production command

- Build: `pnpm run build:production`
- Start: `pnpm run start:production`
- Required runtime: `PORT`, `DATABASE_URL`
- Recommended runtime: `SERVE_FRONTEND=true`, `NODE_ENV=production`, `NHLSNIPES_SYNC_INTERVAL_MS=900000`

## NHLsnipes.com

Point the domain's DNS records at the published Replit deployment after the first successful publish, then verify HTTPS, canonical metadata, `robots.txt`, `sitemap.xml`, provider health and data freshness. The exact target records come from Replit's Publishing > Domains pane for the generated production URL. Do not place provider credentials in browser code.

## Data readiness checklist

- Provider terms permit the intended use and redistribution.
- Provider responses match the versioned API contract.
- Starting goalie status is marked `confirmed`, `projected` or `unknown`; never inferred.
- Odds are either sourced or shown as unavailable.
- Model version and input snapshots are persisted before predictions are displayed as historical results.
- Audit grading runs only after final game data is available.