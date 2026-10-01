# ADR 0002: pnpm workspaces + Turborepo

- Status: Accepted
- Date: 2026-10-01

## Context

Three apps share schemas, UI components and configs. CI time matters on free runners.

## Decision

pnpm workspaces for dependency management; Turborepo for task orchestration and caching. Shared configs in `@shop/config`, UI in `@shop/ui`.

## Consequences

- `turbo run <task>` only runs affected packages and caches results.
- `turbo prune --docker` produces minimal Docker build contexts per app.
- ESLint is pinned to 9 because the eslint-config-next plugins do not support 10.
- TypeScript is pinned to ^6 because typescript-eslint rejects TS 7.
- `.claude/` is prettier-ignored because it holds vendored skill files.
- `@shop/config` has `next`, `react` and `react-dom` as devDependencies so `eslint-config-next` resolves from the config package.

## Alternatives rejected

- Nx: more features than needed, heavier configuration.
- npm/yarn workspaces without an orchestrator: no task caching.
