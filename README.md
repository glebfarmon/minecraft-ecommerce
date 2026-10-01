# Minecraft Shop

Donation shop for Minecraft servers: ranks, coins, kits and provably fair cases, delivered over RCON.
Portfolio project — payments run in Stripe **test mode**.

## Stack

NestJS 11 · Next.js 16 · PostgreSQL · Redis · Turborepo · Docker · Traefik · Dokploy · Cloudflare

## Local development

Requirements: Node 24, pnpm (via corepack), Docker.

```bash
corepack enable
pnpm install
docker compose up -d
pnpm dev
```

Most systems resolve `*.localhost` to loopback automatically. If yours does not, add the hosts once:

```bash
echo "127.0.0.1 shop.localhost admin.shop.localhost api.shop.localhost" | sudo tee -a /etc/hosts
```

| URL                              | App        |
| -------------------------------- | ---------- |
| http://shop.localhost            | Storefront |
| http://admin.shop.localhost      | Admin      |
| http://shop.localhost/api/health | API        |

## Checks

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm test:e2e
```

## Docs

- Design: `docs/superpowers/specs/`
- Plans: `docs/superpowers/plans/`
- Decisions: `docs/adr/`
- Deploy runbook: `docs/runbooks/deploy.md`
