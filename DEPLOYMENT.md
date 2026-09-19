# NHLsnipes deployment

## Replit

1. Provision PostgreSQL for the project.
2. Add `DATABASE_URL` through the Replit Secrets or environment-variable UI.
3. Add `NHLSNIPES_PROVIDER_URL` only after reviewing the upstream provider's license and commercial-use terms.
4. Add an approved odds adapter URL if sportsbook lines are part of the product scope.
5. Run `pnpm install`, `pnpm run typecheck`, and `pnpm run build`.
6. Publish the project and verify `/`, `/snipes`, `/props`, `/goalies`, `/matchups`, `/teams`, `/audit`, and `/admin`.

## NHLsnipes.com

Point the domain's DNS records at the published Replit deployment, then verify HTTPS, canonical metadata, `robots.txt`, `sitemap.xml`, provider health and data freshness. Do not place provider credentials in browser code.

## Data readiness checklist

- Provider terms permit the intended use and redistribution.
- Provider responses match the versioned API contract.
- Starting goalie status is marked `confirmed`, `projected` or `unknown`; never inferred.
- Odds are either sourced or shown as unavailable.
- Model version and input snapshots are persisted before predictions are displayed as historical results.
- Audit grading runs only after final game data is available.