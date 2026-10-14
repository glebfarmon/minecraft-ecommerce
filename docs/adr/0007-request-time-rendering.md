# ADR 0007: Request-time rendering for API data

- Status: Accepted
- Date: 2026-10-09

## Context

The storefront reads the catalog (and later site content) from `apps/api`. CI builds the web image on GitHub runners where neither the API nor Postgres runs (ADR 0003), so any page that fetches during `next build` fails the build.

## Decision

`app/[locale]/layout.tsx` calls `await connection()` before reading data, so every `[locale]` route renders per request. Data is fetched with `fetch(url, {next: {revalidate: 60, tags: [...]}})`: the Next data cache serves repeat requests and refreshes in the background. No `generateStaticParams` for data-driven segments; unknown slugs are checked against the fetched data and `notFound()` is called.

## Consequences

- `next build` never contacts the API.
- Each page view renders on the server (cheap: data comes from the cache), so TTFB includes a render but no API round trip after the first request per minute.
- When the API is down and the cache is empty, pages render an "unavailable" state for the shop instead of failing.
- Site-content phase 2 (`docs/superpowers/specs/2026-10-09-site-content-design.md`) reuses this approach; its ADR becomes 0008.
- The layout reads the `cart` and `currency` cookies (`docs/superpowers/specs/2026-10-12-cart-cookie-design.md`), so the HTML is per visitor and cannot be cached by a CDN. This adds no cost while every route already renders per request.
