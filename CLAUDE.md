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

## Workflow

- TDD: failing test first, then code.
- Before a commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- Conventional Commits (`feat(api): …`, `fix(web): …`, `chore: …`).
- Never commit secrets; use `.env.example` for new variables.
- When unsure about a library's current API, check its docs instead of guessing.
