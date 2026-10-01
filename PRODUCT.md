# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: Minecraft players** who play on one of the shop's game servers. They come to buy a rank, in-game currency, a kit, or case keys for their nickname. Many arrive mid-session and want to finish fast. They pick a server, find the item, pay, and see it in game within seconds. No account; identity is the in-game nickname (`^[A-Za-z0-9_]{3,16}$`) plus an email.

**Secondary: portfolio reviewers** (recruiters, tech leads) who open the live demo and the GitHub repo. They judge whether the shop is believable as a real product and how well it is built. They are served by the shop being convincing for players, not by a separate showcase layer.

**Internal: shop staff** (`OWNER`, `ADMIN`, `SUPPORT`) using the EN-only admin app to manage servers, catalog, orders, cases, and promo codes.

## Product Purpose

A donation shop for a network of Minecraft servers. Players buy ranks, currency, kits, and case keys; purchases are delivered to the game server over RCON. Cases and scratch cards are opened on the site with provably fair outcomes.

It exists as a public portfolio project that shows full-stack, DevOps, and disciplined AI-assisted work. Success: a live demo where a visitor can pick a server, add to cart, pay with a Stripe test card, and see commands arrive on the configured RCON server; every case opening can be re-verified on `/fairness`.

## Positioning

- **Provably fair cases:** published odds plus HMAC-SHA256 server-seed commit, client seed, and nonce. Any opening can be recomputed in the browser with the same shared code on `/fairness`. Most donation shops only claim fairness.
- **Multi-server cart:** one cart can hold items from several servers, grouped by server, delivered per server with visible delivery progress.

## Operating Context

- Player flow: server picker → catalog by category → cart drawer → checkout (nickname + confirmation, email, immediate-delivery consent, Turnstile) → Stripe Checkout (card, BLIK, P24) → order page polling until delivered.
- Case flow: keys arrive by emailed link `/open/{token}`; 18+ age gate before the first opening; roulette or scratch; history with "Verify".
- Players check the server's online count and copy the server IP from the site.
- Demo runs in Stripe test mode; the site shows a demo banner with the test card.

## Capabilities and Constraints

- Storefront languages: **EN (default) and PL only**. Admin: EN only. All UI copy lives in next-intl keys; `pl.json` must cover every `en.json` key.
- Currencies: EUR and PLN, separate price per currency.
- Product kinds: `PERMANENT`, `TIMED` (N days, auto-revoked), `CASE`. Categories are admin-managed; each server has its own offerings and prices.
- Multiple game servers, each with its own name, description, and catalog.
- Stack is fixed in `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md`: Next.js 16, Tailwind v4, shadcn/ui, Motion, next-intl, NestJS API.
- Non-goals: player accounts, real payments, leaderboards, time-limited sales, gifting.
- Legal pages (Terms, Privacy, Refunds, Cookies) are demo templates, marked "not legal advice".
- **Undecided:** shop/brand name (placeholder for now); names and descriptions of the fictional servers.

## Brand Commitments

- Fictional brand and fictional servers. Never use real server names, IPs, or logos in shipped content. `mc.hypixel.net` in `references/hero.txt` was only an example; it must be replaced with a placeholder IP.
- Owner-made visual constraints (details live in `docs/design-system.md`, references in `references/`): dark background; the typography of `references/hero.png`; `references/hero-steve.webp` as the hero character.

## Evidence on Hand

- Hero character render: `references/hero-steve.webp`.
- Visual references and owner notes: `references/*.png`, `references/*.txt`.
- Hero copy from the owner (translated to EN/PL in `docs/design-system.md` §7).
- No real players, testimonials, sales numbers, reviews, or partner logos exist. The online count (e.g. `67`) is demo data. Do not fabricate social proof.

## Product Principles

1. **Player gets the item fast.** Server → item → pay should be the shortest path on every page; nothing decorative blocks it.
2. **Show, don't claim, fairness.** Odds, seeds, and verification are visible and checkable, never hidden behind marketing text.
3. **Honest demo.** Test mode, demo data, and template legal pages are labeled openly.
4. **Real shop, not a showcase.** Portfolio value comes from the shop working like a real product; no reviewer-only UI.
5. **Both languages are first-class.** Every surface works in PL, the longer language, not just EN.

## Accessibility & Inclusion

- WCAG 2.2 AA; axe checks in Playwright; Lighthouse Accessibility ≥ 90 on PRs.
- Roulette and scratch cards are keyboard-operable.
- `prefers-reduced-motion` skips animations.
- 18+ age gate and 18+ badges on cases.
