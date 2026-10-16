# ADR 0008: Site content in the database

- Status: Accepted
- Date: 2026-10-16

## Context

Brand values, the rules page and the UI texts lived in code (`config/site.ts`, `messages/*.json`), so every edit needed a deploy. Admins with `content.write` must change them from the admin app, and the storefront must keep working when the API is down.

## Decision

- **Storage.** Rules are versioned JSON documents: one `RulesDraft` (with a `revision` for optimistic locking) and immutable `RulesVersion` rows created on publish; restore copies a version into the draft. UI texts are per-key overrides (`MessageOverride`) on top of the next-intl files, limited to the allowlist `EDITABLE_MESSAGES` in `@shop/messages`; an override must keep the default's placeholders and rich-text tags. Brand values are one `SiteSettings` row with a `version` for optimistic locking. ADR 0005 stays valid for everything else in `config/`.
- **Fallbacks.** The built-in files and `DEFAULT_SITE_SETTINGS` are the defaults. If the API is down or a row is missing, the storefront uses them (no overrides, default settings, "Rules are temporarily unavailable" for the rules page).
- **Caching.** The storefront reads content with `fetch(url, {next: {revalidate, tags}})` and the tags `content-rules`, `content-messages` and `content-settings`, as in ADR 0007 (`[locale]` routes render per request). `revalidate` is `CONTENT_REVALIDATE_SECONDS` (default 60; invalid values fall back to the default with a warning). There is no on-demand revalidation endpoint and no Redis for content; the tags make one possible later. The e2e stack sets `CONTENT_REVALIDATE_SECONDS=1`.
- **Rollout.** The content-only entrypoint `dist/seed/content-main.js` runs at every api start, after `prisma migrate deploy` (Dockerfile `CMD`). It creates the settings row, the rules draft and the first rules edition only when missing, so it is idempotent, and it runs in one transaction under a Postgres advisory lock, so containers starting together create them once. The full seed (`main.js`) also calls it and is still run once only, never again on a live shop. The `content.write` permission reaches the existing `ADMIN` role through a SQL migration.

## Consequences

- A published change shows on the site within about a minute (or `CONTENT_REVALIDATE_SECONDS`).
- No manual step after a deploy: the api creates missing content rows at start. Until they exist (a fresh database before its first api start) the admin Content routes answer 404 `not_found` and the rules page shows "temporarily unavailable".
- Deviates from the base spec (`docs/superpowers/specs/2026-10-09-site-content-design.md`), which proposed `'use cache'` with `cacheLife('content')`; see `docs/superpowers/specs/2026-10-16-site-content-admin-design.md`.
