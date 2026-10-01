# CLAUDE.md

Rules for AI agents working in this repository.

## Source of truth

- Design: `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md`
- Plans: `docs/superpowers/plans/` — implement task by task, tick checkboxes.
- Decisions: `docs/adr/` — do not contradict an ADR; propose a new one instead.

## Architecture rules

- Business logic lives only in `apps/api` (NestJS). Next.js apps have no route handlers.
- NestJS global prefix is `/api`. Ports: web 3000, admin 3001, api 4000.
- Shared code goes in `packages/*` and is imported as `@shop/<name>`.
- Money is `amountMinor: Int` + `currency`. Never floats.
- Do not bump ESLint (9) or TypeScript (6) majors; see `docs/adr/0002-monorepo-tooling.md`.

## Workflow

- TDD: failing test first, then code.
- Before a commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- Conventional Commits (`feat(api): …`, `fix(web): …`, `chore: …`).
- Never commit secrets; use `.env.example` for new variables.
- When unsure about a library's current API, check its docs instead of guessing.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
