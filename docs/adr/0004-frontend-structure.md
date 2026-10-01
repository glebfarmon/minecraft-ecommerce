# ADR 0004: Feature-based frontend structure

- Status: Accepted
- Date: 2026-10-02

## Context

`apps/web/src/components` was one flat folder mixing layout, page sections, shop domain code and primitives. Redux Toolkit, RTK Query and react-hook-form are coming, and `admin` will grow the same way.

## Decision

Both Next.js apps use the same layout: `app/` (routes, with `_components` for code used only under one segment), `features/<name>/` (domain code), `components/` and `hooks/` (domain-free), `lib/`, `i18n/`, and `store/` once Redux arrives. Imports flow `shared → features → app + store`, enforced by `no-restricted-imports` in `@shop/config/eslint/next`. No barrel files. Tests sit next to the code; e2e stays in `e2e/`.

Rejected: Feature-Sliced Design (too many layers for ~10 pages, layer names clash with Next routing) and per-page folders under `components/` (break when two pages share a component).

## Consequences

- Placement rule: one segment → `_components`; domain or cross-segment → `features/`; domain-free → `components/`/`hooks/` or `packages/ui`.
- Feature-to-feature imports are allowed without cycles; cycles are checked in review, not by lint.
- Details: `docs/superpowers/specs/2026-10-02-frontend-structure-design.md`.
