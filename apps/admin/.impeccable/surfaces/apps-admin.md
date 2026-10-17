---
version: 1
slug: "apps-admin"
primary_target: "apps/admin"
related_targets: []
---

Scope: whole admin app (apps/admin). Visitor mode: Operate. Spec: docs/superpowers/specs/2026-10-17-admin-design-design.md.

Audience and job: shop staff (OWNER/ADMIN/SUPPORT), desktop first, phone fully usable for orders. See shop health at a glance, spot problem orders by colour, find what can be configured from the screen itself.

## Direction contract

THESIS: The admin is the storefront's dark world put to work: card modules on a dark ground, status read by colour before text. It refuses the category default of a white sidebar plus grey bordered tables.

OWN-WORLD: #0e0e10 ground, #1d1d20 cards at 20 px radius, hairlines at 7 % white, one sage-green accent filling at most one card per screen, status dots green/amber/red/grey with soft tints; Inter Tight 13–14 px dense, KPI numbers 32 px tabular; JetBrains Mono for ids; icon rail inside a pill.

STORY: Staff land on numbers (revenue, paid orders, conversion), see what needs attention, open an order or a catalog card and act from its menu.

FIRST VIEWPORT: Dashboard. Rail left; top bar with search; row of four KPI cards (one accent-filled); wide revenue-by-day chart card with status breakdown beside it; top products and latest orders below.

FORM: Pinned by owner references (admin-2 composition, admin-1 order rows, admin-3 catalog cards), no seed roll; code-led (no image generation available).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
