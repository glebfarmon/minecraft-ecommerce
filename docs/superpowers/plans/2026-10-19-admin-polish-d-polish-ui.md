# Admin polish D — Polish admin UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole admin can be switched between English and Polish from an EN/PL switch at the bottom of the rail (and in the mobile menu); API errors, validation messages, dates and money follow the chosen language.

**Architecture:** next-intl **without** locale routing: `src/i18n/request.ts` reads the `admin_locale` cookie (default `en`) and loads `apps/admin/messages/{en,pl}.json`; the root layout wraps everything in `NextIntlClientProvider` and sets `<html lang>`. Server components use `getTranslations`, client components `useTranslations`. The switch writes the cookie and calls `router.refresh()`. API error codes and shared validation messages are translated by stable keys.

**Tech Stack:** next-intl 4 (as in web — check its no-routing setup with Context7 before Task 1), Next.js 16, valibot, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-admin-polish-design.md` (part 8). Runs last so it translates the final strings of plans A–C.

## Global Constraints

- Translated: navigation, headers, buttons, tables, forms, validation errors, empty states, tooltips, sign-in, 2FA, invite pages, API errors.
- Not translated: admin-entered data (names, descriptions), Content → Texts keys, audit log entries (actions/entities), Stripe ids, order public ids.
- API errors are translated by code (`apiErrors.<code>`); an unknown code falls back to the English text the code maps to today, then to `apiErrors.generic`.
- Shared valibot schemas keep their English messages. `packages/shared/src/validation-messages.ts` exports `VALIDATION_MESSAGES` (key → English) used by the schemas; the admin translates by key through the reverse map. API and web behaviour are unchanged.
- Choice is stored in the `admin_locale` cookie (`path=/; max-age=31536000; samesite=lax`), not per account. No server actions or route handlers (CLAUDE.md): the cookie is written client-side.
- Admin strings live in `apps/admin/messages/`, not in `@shop/messages` (that package is the storefront's editable texts).
- Formatting: PL uses `Intl` with `pl` (e.g. `19 paź 2026, 14:05 UTC`, `1234,50 zł`); EN output stays byte-identical to today's (`formatTime`/`formatMoney`), so existing tests and e2e keep their strings.
- English remains the test default: every component test renders inside an `en` provider; each translated area adds one PL assertion.
- `en.json` and `pl.json` have identical key sets (unit test).
- Gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; `graphify update .`; Conventional Commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A Polish string much longer than its English one (buttons, table headers, KPI labels) must not overflow or force horizontal scroll at 390 px — the e2e 390 px loop must also run in PL.
2. Plurals (`1 produkt`, `2 produkty`, `5 produktów`) must use ICU `plural` with Polish `one/few/many/other`, not `n + 's'`.
3. Switching language on a page with an unsaved form must not drop the form state silently — `router.refresh()` keeps client state; confirm with a test that a typed draft survives the switch.
4. A missing key in `pl.json` must fail the parity test, not render the key path to the admin.
5. Auth pages (login, 2FA, invite) are outside the `(shell)` layout and must still read the cookie and translate.

---

### Task 1: next-intl setup, messages skeleton, test providers

**Files:**

- Create: `apps/admin/src/i18n/request.ts`, `apps/admin/src/i18n/locale.ts`, `apps/admin/messages/en.json`, `apps/admin/messages/pl.json`, `apps/admin/src/i18n/messages.test.ts`, `apps/admin/global.d.ts` (next-intl `AppConfig` typing: `Messages` = typeof en.json, `Locale` = `'en' | 'pl'`)
- Modify: `apps/admin/next.config.ts` (`createNextIntlPlugin('./src/i18n/request.ts')`), `apps/admin/package.json` (`next-intl` same range as web), `apps/admin/src/app/layout.tsx` (`<html lang={locale}>`, `NextIntlClientProvider`), `apps/admin/src/test/render-with-store.tsx`
- Create: `apps/admin/src/test/render-with-providers.tsx`

**Interfaces:**

- Produces:
  - `LOCALES = ['en', 'pl'] as const`, `type AdminLocale`, `LOCALE_COOKIE = 'admin_locale'`, `parseLocale(value: string | undefined): AdminLocale` in `i18n/locale.ts`.
  - `renderWithProviders(ui, {locale = 'en', store = true} = {})` — store (optional) + `TooltipProvider` + `NextIntlClientProvider` with the real message file. `renderWithStore` becomes a thin alias. Plain `render(...)` calls in component tests that now need the intl provider switch to `renderWithProviders`.
- [ ] **Step 1: Failing tests** — `messages.test.ts`: the flattened key sets of `en.json` and `pl.json` are equal; `parseLocale('pl') === 'pl'`, `parseLocale('de') === 'en'`, `parseLocale(undefined) === 'en'`.
- [ ] **Step 2: Run** `pnpm --filter @shop/admin test -- messages` — FAIL.
- [ ] **Step 3: Implement** (both JSON files start with the `common` namespace: Save, Cancel, Delete, Edit, Back, Loading…, Retry).
- [ ] **Step 4: Run** admin tests and `pnpm --filter @shop/admin build` — PASS.
- [ ] **Step 5: Commit** `feat(admin): next-intl without routing, locale from a cookie`

### Task 2: Language switch in the rail and the mobile menu

**Files:**

- Create: `apps/admin/src/app/(shell)/_components/language-switch.tsx` (+ test)
- Modify: `apps/admin/src/app/(shell)/layout.tsx` (above the avatar), `apps/admin/src/app/(shell)/_components/mobile-nav.tsx`

**Interfaces:**

- Consumes: `LOCALE_COOKIE`, `RollingIndicator`, `Hint`.
- Produces: `LanguageSwitch({orientation}: {orientation: 'vertical' | 'horizontal'})` — `role="radiogroup"` `aria-label={t('shell.language')}`, two `role="radio"` buttons `EN`/`PL` (`aria-checked`), the active one holds the `RollingIndicator`; click sets the cookie and `router.refresh()`; Hint "English"/"Polski".
- [ ] **Step 1: Failing tests** — clicking PL writes `admin_locale=pl` to `document.cookie` and calls `refresh`; the active radio is `aria-checked=true` and contains the indicator; a typed value in a sibling input survives the click (Review Focus 3).
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): EN/PL switch in the rail`

### Task 3: Locale-aware formatting

**Files:**

- Modify: `apps/admin/src/lib/format.ts` (+ test)
- Create: `apps/admin/src/hooks/use-format.ts`

**Interfaces:**

- Produces: `formatTime(iso, locale = 'en')`, `formatMoney(minor, currency, locale = 'en')`, `formatPercent(f, locale = 'en')`, `formatDelta(f, locale = 'en')` — `'en'` output unchanged; `useFormat()` returns them bound to `useLocale()`. Callers in client components move to `useFormat()`; server components pass `await getLocale()`.
- [ ] **Step 1: Failing tests** — `formatTime('2026-10-19T14:05:00Z', 'pl')` → `'19 paź 2026, 14:05 UTC'` (assert via `Intl` parts if the ICU build differs: day, short month `paź`, year, `14:05`, `UTC`); `formatMoney(123450, 'PLN', 'pl')` → `'1234,50 zł'` (normalise NBSP); `formatMoney(123450, 'EUR', 'en')` unchanged; `formatPercent(0.5, 'pl')` → `'50%'`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): format dates and money per locale`

### Task 4: Translated API errors and validation messages

**Files:**

- Create: `packages/shared/src/validation-messages.ts` (+ spec), export in `packages/shared/package.json`
- Modify: every shared schema message that admin forms surface (`packages/shared/src/{rules,catalog-admin,content,access,orders}.ts` — grep `v\.(minLength|maxLength|regex|check|email|nonEmpty)\([^)]*'`) to use `VALIDATION_MESSAGES.<key>`
- Modify: `apps/admin/src/lib/api/error-message.ts` (+ test), `apps/admin/src/features/*/schemas.ts` (admin-only messages also get keys, in `apps/admin/src/lib/validation-messages.ts`)
- Create: `apps/admin/src/hooks/use-error-text.ts`

**Interfaces:**

- Produces:
  - `VALIDATION_MESSAGES: Record<string, string>` (e.g. `ruleTextRequired: 'Enter the English text'`, `safeLinks: 'Links must start with https:// or /'`, `onlyNickPlaceholder: 'Only the {nick} placeholder is allowed'`, …) and `validationKey(message: string): string | undefined`.
  - `apiErrorMessage(error: unknown, t: (key: string, values?: Record<string, unknown>) => string): string` — same branching as today; strings come from `apiErrors.*` (`inUse` uses ICU plural per entity; `placeholderMismatch` takes `{expected}`).
  - `useErrorText(): (message: string | undefined) => string | undefined` — validation key → `t('validation.<key>')`; unknown message → returned as is.
  - Every field error render site (`Field` in product/server editors, `TextField` in rules editor, categories/invite/settings forms) passes its message through `useErrorText()`.
- [ ] **Step 1: Failing tests** — shared: each schema still produces exactly the old English message (snapshot of the message list); `validationKey('Enter the English text') === 'ruleTextRequired'`. Admin: `apiErrorMessage({data: {message: 'stale'}}, tPl)` → the Polish sentence; `in_use` with `{products: 5}` → `5 produktów` (Review Focus 2); unknown code → `apiErrors.generic`; a product editor rendered in PL shows the Polish "Only the {nick} placeholder is allowed" after an invalid save.
- [ ] **Step 2: Run** shared + admin tests — FAIL.
- [ ] **Step 3: Implement.** API responses do not change (`pnpm --filter @shop/api test` green).
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(admin): translated API errors and validation messages`

### Task 5: Translate the shell, dashboard and orders

**Files:**

- Modify: `apps/admin/src/config/nav.ts` (labels → message keys `nav.*`), `app/(shell)/_components/{nav,top-bar,mobile-nav,global-search,brand-mark}.tsx`, `app/(shell)/page.tsx`, `features/dashboard/components/*`, `features/orders/components/*`, `app/(shell)/orders/**/page.tsx`, `components/{data-table,empty-state,row-menu,status-dot,status-donut,day-chart,kpi-card}.tsx` (built-in strings: "Actions for {label}", status labels, aria-labels)
- Modify: `messages/{en,pl}.json` (`nav`, `shell`, `dashboard`, `orders`, `status`, `table`)
- Test: existing tests (en) + one PL case each in `shell.test.tsx`, `dashboard.test.tsx`, `orders-table.test.tsx`

- [ ] **Step 1: Failing PL tests** — rail link `Zamówienia`; dashboard region `Przychód`; orders tab `Opłacone`; status dot `Opłacone` for PAID.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; English strings stay identical so existing tests pass untouched.
- [ ] **Step 4: Run** admin tests — PASS.
- [ ] **Step 5: Commit** `feat(admin): Polish shell, dashboard and orders`

### Task 6: Translate the catalog

**Files:**

- Modify: `features/catalog/components/*`, `app/(shell)/catalog/**`, `messages/{en,pl}.json` (`catalog`)
- Test: PL case in `catalog-board.test.tsx` and `product-editor.test.tsx` (ICU plural "{count, plural, one {# produkt} few {# produkty} many {# produktów} other {# produktu}}" on the server card).

- [ ] **Step 1: Failing PL tests** — server card `2 produkty`, `5 produktów`; editor section `Polecenia` (Commands); `{nick}` help text in Polish.
- [ ] **Step 2–4:** run FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(admin): Polish catalog`

### Task 7: Translate content, team, audit, account and auth

**Files:**

- Modify: `features/{content,team,audit,auth}/components/*`, `app/(shell)/{content,team,audit,account}/**`, `app/(auth)/**`, `messages/{en,pl}.json`
- Test: PL case in `texts-table`, `admins-table`, `audit-table`, and the login page; auth pages read the cookie (Review Focus 5).

- [ ] **Step 1: Failing PL tests** — `Treść` header on content; `Zaproś` button; audit column `Akcja` (entries themselves stay English); login title `Zaloguj się do panelu`.
- [ ] **Step 2–4:** run FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(admin): Polish content, team, audit, account and sign-in`

### Task 8: E2E, DESIGN.md and the full gate

**Files:**

- Modify: `e2e/tests/admin.spec.ts`, `DESIGN.md` (copy rule: every string through `t`; PL is ~30% longer — buttons never fixed-width), `CLAUDE.md` (one bullet: admin i18n lives in `apps/admin/messages`, cookie `admin_locale`)

- [ ] **Step 1: E2E** — signed-in owner clicks `PL` in `radiogroup 'Language'` → rail link `Zamówienia` visible and `html[lang=pl]`; reload keeps PL; the 390 px no-horizontal-scroll loop runs again in PL over `/`, `/orders`, `/catalog`, `/team`, `/audit`, `/content/rules`; switch back to EN at the end (serial suite).
- [ ] **Step 2: Run** the full gate and a fresh e2e stack (`up -d --build --wait`, run, `down -v`). Expected: green.
- [ ] **Step 3: Commit** `test(e2e): Polish admin UI and its mobile layout`
