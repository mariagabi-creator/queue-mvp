# Queue

Queue is a virtual queue MVP that lets guests join and track a live position while establishments manage the waiting line.

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

- `artifacts/queue/src/pages/queue-pages.tsx` — customer and staff screens
- `artifacts/queue/src/index.css` — Queue visual theme and motion
- `artifacts/api-server/src/routes/queues.ts` — queue operations and position calculation
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema/queues.ts` — PostgreSQL/Drizzle schema

## Architecture decisions

- Queue positions are derived from active entries ordered by `joinedAt`, so serving or leaving a customer automatically advances everyone else.
- The customer and staff screens poll the API at short intervals to keep separate browser sessions current without adding realtime infrastructure to the MVP.
- The demo starts with a Northstar Café queue so the complete flow can be presented immediately.

## Product

Guests can see a public queue, join with a name, follow their position and estimated wait, receive called/turn states, and leave the queue. Staff can open a queue, call the next guest, mark called guests served, remove entries, and view operational activity.

## User preferences

 - Keep the MVP focused on the virtual queue workflow; avoid adding payments, reservations, chat, marketplace, or full business-management features unless explicitly requested.

## Gotchas

- Run API codegen after every OpenAPI change, then run the workspace typecheck.
- Keep Orval's configured Zod output version aligned with the installed Zod catalog dependency.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
