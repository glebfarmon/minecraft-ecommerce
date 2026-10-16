# Sub-project 3c: Site content admin (site-content phase 2)

- Date: 2026-10-16
- Status: Approved in conversation, awaiting owner review of this file
- Base spec: `2026-10-09-site-content-design.md` (phase 2: §4 data model, §5 API, §6.2–6.5 web, §7 admin, §8 allowlist, §10 testing). Everything there applies unless this document changes it.
- Siblings: `2026-10-12-admin-access-design.md` (3a), `2026-10-14-catalog-admin-design.md` (3b). Builds on branch `feat/catalog-admin` (PR #22).

## 1. Goal

Admins with `content.write` edit the rules (draft, publish, versions, restore), the allowlisted UI texts (EN/PL overrides with reset) and the brand settings from the admin app. The storefront shows the change within a minute, and falls back to the built-in values when the API is unavailable.

## 2. Changes to the base spec

| #   | Topic                 | Base spec says                                         | 3c decision                                                                                                                                                                                                                                                                                                           |
| --- | --------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Web caching           | `'use cache'` + `cacheLife('content')`, spike first    | ADR 0007: `fetch(url, {next: {revalidate, tags}})` with `[locale]` routes rendered per request (already in place for the catalog). No spike. `revalidate` comes from `CONTENT_REVALIDATE_SECONDS` (default 60; e2e sets 1). ADR 0008 records this.                                                                    |
| 2   | Rules editor ordering | Move up/down buttons                                   | Drag and drop with the admin's `SortableList` (mouse, touch, keyboard), for sections and for items inside a section.                                                                                                                                                                                                  |
| 3   | Swagger               | Not mentioned                                          | Every public and admin content route is documented like 3b: `operationId`, `tags: ['Content admin']` or `['Content']`, `summary`, `description` (what, permission, storefront effect) and a description per response. `admin-routes.spec.ts` already enforces coverage.                                               |
| 4   | Concurrency           | Rules draft `revision`; settings and texts not covered | Rules draft keeps `revision` (409 `stale` on mismatch). `SiteSettings` gets `version Int @default(1)`; `PUT` sends it, mismatch → 409 `stale`. Text overrides are per key, last write wins. Admin editors keep the version they loaded (3b lesson): a 409 never turns into a silent overwrite.                        |
| 5   | Permission rollout    | `OWNER` and seeded `ADMIN` get `content.write`         | `content.write` is added to `PERMISSIONS` and `SYSTEM_ROLES.ADMIN`, and a SQL migration appends it to the existing `ADMIN` role (the seed runs once in production), as in 3b.                                                                                                                                         |
| 6   | Error codes           | `409` / `422` / `403`                                  | Same shape as 3a/3b `{statusCode, message, issues?}`: `409 stale`; `400 unknown_key` for a key outside `EDITABLE_MESSAGES` (not 403, which means "no permission" in the admin); `422 placeholder_mismatch` with the expected and found argument names; `404 not_published` for public rules before the first publish. |
| 7   | Messages package      | Move messages to `@shop/messages`                      | Unchanged: `packages/messages` holds `en.json`, `pl.json`, `EDITABLE_MESSAGES`, the key-parity check and a `defaultMessage(locale, key)` helper, used by web (files), api (defaults for validation) and admin (shows defaults via the API).                                                                           |

## 3. Unchanged from the base spec (summary)

- Data model §4 (`RulesDraft`, `RulesVersion`, `MessageOverride`, `SiteSettings`, plus `version` from decision #4); seed: phase-1 demo rules become the first published version, settings from `DEFAULT_SITE_SETTINGS`.
- API §5 routes and validation limits.
- Web §6.2–6.5: real bodies for `getRules`, `getSiteSettings`, `getMessageOverrides`; `applyOverrides` in `i18n/request.ts`; fallbacks (`DEFAULT_SITE_SETTINGS`, `{}` overrides, "Rules are temporarily unavailable").
- Admin §7: `/content/rules` (editor with EN/PL tabs, "uses EN" hint, live preview with `RichText`, publish with confirmation, versions + restore), `/content/texts` (grouped, search, default/override/changed/reset, per-field errors), `/content/settings`. Navigation item "Content" visible with `content.write`.
- `RichText` moves to `@shop/ui` so the admin preview uses the same renderer.
- Allowlist §8 unchanged.

## 4. Testing

As base spec §10, plus:

- Swagger coverage and description tests (decision #3).
- Int: settings 409 `stale`; `content.write` migration on an existing `ADMIN` role; `unknown_key` and `placeholder_mismatch`.
- Admin component tests: rules editor keeps the loaded `revision` after a 409; drag reorder of sections calls the save with the new order; texts page shows the API error per field.
- e2e (chromium, `CONTENT_REVALIDATE_SECONDS=1`): admin edits a rule and publishes → `/rules` shows it; admin overrides `hero.title` → home shows it, then resets it.

## 5. Out of scope

As base spec §11.
