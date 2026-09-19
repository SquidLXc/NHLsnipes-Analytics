# NHLsnipes

An independent NHL analytics terminal for matchup edges, player props, goalie environments and transparent model audit history.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/nhlsnipes` — React + Vite frontend and responsive product shell.
- `artifacts/api-server/src/providers/nhl.ts` — provider boundary and response validation.
- `artifacts/api-server/src/routes/nhl.ts` — read-only analytics API routes.
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and schemas.
- `lib/db/src/schema` — relational persistence models.

## Architecture decisions

- Live NHL and odds data never silently falls back to invented values; an unconfigured provider produces explicit offline states.
- NHL EDGE and advanced tracking are accessed only through a provider adapter so licensing and commercial redistribution terms can be handled upstream.
- OpenAPI is the single API contract; frontend hooks and server validators are generated from it.

## Product

The product surfaces today's slate, ranked snipes, prop markets, matchup comparisons, goalie save environments, team vulnerability, watchlists, model performance and immutable audit records.

## User preferences

- The user wants a dark analytics terminal with neon green and neon purple/pink accents. Reference screenshots are visual inspiration only; do not copy their branding or exact UI.
- Never present fake or random numbers as live NHL data.

## Gotchas

- Configure `NHLSNIPES_PROVIDER_URL` only after confirming the upstream source permits the intended public/commercial use.
- Re-run API codegen after changing `lib/api-spec/openapi.yaml`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
