# Checkout and Rewards Service

A PostgreSQL-backed checkout API with inventory-safe orders and milestone reward coupons.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/api-server run test` — run PostgreSQL integration tests (`TEST_DATABASE_URL` required)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Optional initial reward settings: `REWARD_ORDER_INTERVAL` and `REWARD_DISCOUNT_PERCENT`; persisted after first initialization and editable through the admin API

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/commerce/` — checkout, cart, coupon, reporting, and schema initialization
- `lib/api-spec/openapi.yaml` — source of truth for the HTTP API contract
- `README.md` — setup and endpoint reference
- `DECISIONS.md` — invariants, trade-offs, and deferred production work

## Architecture decisions

- Checkout effects are committed in one PostgreSQL transaction; row locks and unique constraints protect inventory, carts, idempotency keys, and coupons.
- Cart reads and checkout use current product prices; orders preserve checkout-time item and total snapshots.
- Use integer cents internally and decimal strings in JSON to avoid floating-point currency errors.
- Reward defaults are inserted once; admin settings affect future coupon issuance while existing coupons keep their issued discount.
- Admin operations intentionally have no authentication in this take-home; do not mistake them for production-ready authorization.

## Product

The API supports product discovery, cart editing, safe checkout retries, order retrieval, milestone coupons, and a read-only revenue and redemption report.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
