# ADR 0005: `src/config/` for tweakable constants

- Status: Accepted
- Date: 2026-10-02

## Context

Brand, server IP, catalog data, currencies, cart limits, polling interval and animation tuning were scattered across components. The same ease curve was copied into seven files and the catalog mixed data with lookup functions.

## Decision

Both Next.js apps may have `src/config/`: plain TypeScript modules with values someone will want to change (`site.ts`, `servers.ts`, `products.ts`, `currencies.ts`, `cart.ts`, `status.ts`, `motion.ts`). It is the lowest layer, next to `components/`, `hooks/`, `lib/` and `i18n/`: it must not import `features/`, `app/` or `store/` (same lint rule as ADR 0004). Everything else may import it. No barrels.

Only values that are shared or meant to be tuned go there; a constant used by one file and not worth tuning stays beside its code. Style tokens (container width, radii, colours) live in `@theme` in `globals.css`, because Tailwind cannot read TypeScript. `lib/` keeps functions (`findProduct`, `formatPrice`).

## Consequences

- One place to change the brand, links, limits and motion feel.
- ADR 0004's layer list gains `config/`; its enforcement list in `@shop/config/eslint/next` is updated.
