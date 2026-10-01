---
version: 1
slug: 'apps-web-src-app-locale-page-tsx'
primary_target: 'apps/web/src/app/[locale]/page.tsx'
related_targets: []
---

# Home (`/[locale]`, `/[locale]/[server]`)

Mode: Persuade (hero) → Operate (catalog). Audience: Minecraft players mid-session; portfolio reviewers see the same page. Primary action: item in cart in 3 clicks; secondary: copy server IP. Proof: in-browser provably-fair check. Demo data only, labeled; no invented social proof. EN/PL via next-intl.

Sections: hero → catalog (server switch, categories, 3×2 cards, product modal via intercepting route) → how it works → fair cases (live HMAC demo) → live feed (empty in demo) → FAQ → footer.

Open decisions: shop name (placeholder "Blockhaus"), server names/colours (Survival orange, Anarchy violet, Minigames crimson), product imagery (typographic tiles until renders exist).

## Direction contract

THESIS: One dark gridded sheet where the selected server owns the only colour; switching servers repaints the page. Refuses the category default of a screenshot banner, rainbow rank cards and countdown sale ribbons.

OWN-WORLD: Near-black #0E0E10 ground, hairline column guides, off-white Inter Tight set huge and tight, Oswald for the giant server word and prices, JetBrains Mono only for IP and seeds. Pills for every control, 28px cards with a light inner plate, one accent from the active server.

STORY: The player sees the server is alive (online pulse), copies the IP, scrolls into the catalog, switches server, adds a rank, and learns case odds are checkable right here.

FIRST VIEWPORT: Floating pill navbar; Steve centred, feet bleeding off the bottom; "your / - new" left and "second / - home" right at ~10rem around him; //labels in corners; lead paragraph lower-left; online count + pulse + IP pill lower-right; "Browse shop" pill as primary action beside the online block.

FORM: Owner-pinned world (references + docs/design-system.md), position 1 of 1; no seed roll — brief-pinned direction. Signature interaction: server switch — accent crossfade via @property, giant server word rises, cards cascade in.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
