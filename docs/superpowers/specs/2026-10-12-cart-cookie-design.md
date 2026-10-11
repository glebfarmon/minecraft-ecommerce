# Cart in a cookie, catalog only where it is shown

- Date: 2026-10-12
- Status: Draft, awaiting owner review
- Amends: `2026-10-09-data-catalog-design.md` decision #9 (one global `CatalogProvider` with every product) and the reasoning in decision #6 ("the storefront needs all of it on every page"). The API and its contract do not change.

## 1. Goal

Today `app/[locale]/layout.tsx` passes the whole catalog to a client `CatalogProvider`, so every page's HTML carries every product. This happens only because the cart (`ShopProvider`, also in the layout) stores bare `{server, slug, qty}` lines in `localStorage` and resolves them with `findProduct` on the client.

After this change the server knows the cart (cookie), resolves its lines itself, and the client receives only what the page shows.

Success:

- The HTML of `/rules` contains no product that is not in the cart.
- The cart badge and the currency are correct in the server HTML: no flash after hydration.
- Home and `[server]` behave as before: the catalog, server switching without reload, the product modal, adding to the cart, checkout.
- After a locale switch the cart holds the same lines, named in the new locale.
- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` and e2e are green.

## 2. Decisions

| #   | Topic                               | Decision                                                                                                                                                                                                                                           |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cart storage                        | Cookie `cart`, written by the client (`document.cookie`), read by the server in the layout. `path=/`, `max-age` 30 days, `SameSite=Lax`, not `HttpOnly` (the client writes it).                                                                    |
| 2   | Cookie format                       | `server:slug:qty` lines joined by `,` (no JSON: quotes would be percent-encoded). Example: `survival:vip:1,anarchy:coins-1000:3`.                                                                                                                  |
| 3   | Limits                              | `MAX_QTY = 99` (unchanged), `MAX_LINES = 30`. `add` ignores a 31st distinct line, as it ignores qty past 99. 30 lines with 40-character slugs fit in 4096 bytes.                                                                                   |
| 4   | Consent                             | The cart cookie is strictly necessary (like the existing `currency` cookie) and needs no consent.                                                                                                                                                  |
| 5   | Where the cart's products come from | On page load the server resolves the cookie lines against `getCatalog(locale)` (already in the Next data cache). On `add(product)` the client gets the full product from the card and keeps it. The cart never looks products up in a global list. |
| 6   | What the layout sends               | `CatalogProvider` gets `servers` (with their categories) and `available` only. `products` and `findProduct` leave the context.                                                                                                                     |
| 7   | Catalog pages                       | Home and `[server]` pass `catalog.products` to `<Catalog>` as a prop.                                                                                                                                                                              |
| 8   | Currency                            | The layout also reads the `currency` cookie and passes it to `ShopProvider`; the restore-after-mount effect goes away.                                                                                                                             |
| 9   | Migration                           | None. The `localStorage` cart (`shop:v1`) and the legacy currency stored there are no longer read; that code is deleted. Existing carts are lost once, on deploy.                                                                                  |
| 10  | When the cookie is written          | Only in `add`, `decrement` and `remove`, never on mount. A render with the API down (empty resolved cart) must not wipe the stored cart.                                                                                                           |

## 3. Components

| File                                           | Change                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `features/cart/lib/cart-cookie.ts` (new)       | `CART_COOKIE`, `parseCart(raw: string \| undefined): CartLine[]` (moved from `shop-provider.tsx`, now parses the cookie format), `serializeCart(lines: CartLine[]): string`. Used by server and client.                                                                                                      |
| `features/cart/api/load-cart.ts` (new, server) | `loadCart(catalog: CatalogResponse \| null): Promise<{lines: {product, qty}[]; currency: Currency}>`: reads `cookies()`, parses, resolves lines against `catalog.products`, drops unknown ones.                                                                                                              |
| `config/cart.ts`                               | `MAX_LINES = 30`, `CART_COOKIE_MAX_AGE`; `CART_STORAGE_KEY` removed.                                                                                                                                                                                                                                         |
| `features/cart/shop-provider.tsx`              | Props `initialLines: {product, qty}[]` and `initialCurrency: Currency`. State is lines with their products. `add`/`decrement`/`remove` update state and write the cookie. `localStorage` and the mount effect are removed. Contexts and hooks (`useCart`, `useCartActions`, `useCurrency`) keep their shape. |
| `features/catalog/catalog-provider.tsx`        | Takes `servers` and `available`; exposes `available`, `servers`, `findServer`, `categoryName`.                                                                                                                                                                                                               |
| `app/[locale]/layout.tsx`                      | Loads the catalog, then `loadCart(catalog)`; passes `servers` to `CatalogProvider` and lines and currency to `ShopProvider`.                                                                                                                                                                                 |
| `features/catalog/components/catalog.tsx`      | Prop `products: CatalogProduct[]` instead of `useCatalog().products`.                                                                                                                                                                                                                                        |
| `app/[locale]/_components/home-view.tsx`       | Passes `catalog?.products ?? []` to `<Catalog>`.                                                                                                                                                                                                                                                             |
| `features/catalog/test-catalog.tsx`            | `renderWithCatalog` provides servers to the provider and initial lines to `ShopProvider`.                                                                                                                                                                                                                    |

## 4. Data flow

1. **Page request.** The layout fetches `getCatalog(locale)` (60 s data cache), then `loadCart(catalog)` reads the `cart` and `currency` cookies and resolves the lines. The client receives `servers` and the cart lines; the full product list stays on the server, except on home and `[server]`, which render the catalog.
2. **First render.** Badge count, cart panel and currency come from props, so server HTML and the first client render match.
3. **Add to cart.** `add(product)` puts the line with its product into state and writes the cookie. No request.
4. **Client-side navigation.** The layout is kept; the cart lives in memory.
5. **Locale switch.** The `[locale]` segment changes, so the layout remounts and the server sends the lines named in the new locale.

## 5. Errors and edge cases

1. **API down, cache empty.** `catalog` is `null`, `loadCart` returns no lines, the shop renders as unavailable. The cookie is not touched (decision #10).
2. **Malformed or edited cookie.** `parseCart` keeps only well-formed lines: server and slug match `^[a-z0-9-]+$`, qty is an integer clamped to 1..99, at most `MAX_LINES` lines, duplicates merged. Garbage yields an empty cart, never a 500.
3. **Product removed from the catalog.** Its line is not resolved, so it is not shown; the next cart change rewrites the cookie without it. Closes deferred minor M-5 of sub-project 2.
4. **Invalid `currency` cookie.** `DEFAULT_CURRENCY`.
5. **Cart limit reached.** A 31st distinct product is ignored, like qty past 99.

## 6. Testing (TDD)

1. **Unit, `cart-cookie`:** round trip; garbage and partial garbage; qty clamping; duplicate lines; `MAX_LINES`; 30 lines with 40-character slugs serialize to ≤ 4096 bytes.
2. **Unit, `load-cart`:** resolves known lines; drops unknown ones; `null` catalog gives no lines; currency from cookie or default.
3. **`shop-provider`:** first render from props with no effects; mount does not write the cookie; `add`/`decrement`/`remove` write it; the 31st line is ignored.
4. **`catalog` and existing component tests:** products come from props; `renderWithCatalog` updated.
5. **e2e:** add a product on home, load `/rules`: the badge count is in the server HTML and the HTML has no product outside the cart; switch to PL: same lines, Polish names.

## 7. Docs

- `docs/adr/0007-request-time-rendering.md`: a consequence line: the layout reads the `cart` and `currency` cookies, so pages are per-visitor HTML and cannot be CDN-cached; this was already true since every route renders per request.
- `CLAUDE.md`: the catalog rule becomes "the layout sends only servers; catalog pages pass products as props; the cart lives in the `cart` cookie and is resolved on the server".
- Data-catalog spec: decision #9 marked as amended by this spec.

## 8. Out of scope / deferred

- Slug length is not constrained in the database or the API schema. Long slugs could push 30 lines past 4 KB. Constrain slugs (e.g. ≤ 40 chars, `^[a-z0-9-]+$`) when the admin starts creating products (sub-project 3).
- Cross-tab sync of the cart (not done today either).
- Server-side checkout and price recomputation (orders sub-project).
