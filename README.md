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

## Production

One arm64 server behind Cloudflare: Dokploy runs Postgres, Redis and four containers (`shop-api`, `shop-worker`, `shop-web`, `shop-admin`) from images that CI builds; `shop-worker` is the api image started with `node dist/worker-main.js`. Every merge to `main` deploys itself. First setup takes two to three hours. New to servers, Docker or GitHub Actions? Follow the step-by-step guide [`docs/guides/deploy-from-scratch.md`](docs/guides/deploy-from-scratch.md); the short reference is [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md).

| #   | Where              | What                                                                                                                                               |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Registrar          | Point the domain's nameservers at Cloudflare. DNS records live in Cloudflare only.                                                                 |
| 2   | Cloudflare         | Proxied A/AAAA records for `@`, `admin`, `api`, `deploy`; SSL **Full (strict)**; an Origin certificate for `<domain>, *.<domain>`.                 |
| 3   | Hetzner            | Debian 13 **arm64** (2 vCPU / 4 GB), SSH key, 4 GB swap; Cloud Firewall: 22 from your IP, 80/443 from Cloudflare ranges only.                      |
| 4   | Server             | Install Dokploy, load the Origin certificate, serve the UI on `deploy.<domain>` behind Cloudflare Access (your email + a CI service token).        |
| 5   | Dokploy            | Project `shop`: Postgres, Redis (no external ports), three Docker apps from `ghcr.io/<owner>/<repo>/{api,web,admin}:latest`, domains, environment. |
| 6   | `shop-api` console | Once: `node dist/seed/main.js` (roles, demo catalog, owner invite). Migrations run on every container start.                                       |
| 7   | GitHub             | Environment `production` with the Dokploy and Cloudflare Access secrets; merge to `main` and watch the `deploy` job.                               |
| 8   | Cloudflare         | Cache rule for `/_next/image`, so images come from the edge.                                                                                       |

Pitfalls met on the first setup:

- **x86 vs arm64.** CI publishes `linux/arm64` only; an x86 server cannot run the images.
- **Docker bypasses UFW.** Published container ports ignore the host firewall; filter with the Hetzner Cloud Firewall.
- **526 on `deploy.<domain>`.** Dokploy wrote an HTTP-only router; the runbook (§3.5) has the HTTPS router to put in its place.
- **App domains.** HTTPS on, certificate provider **None** (Traefik picks the Origin certificate), strip path **off**. `<domain>/api` and `admin.<domain>/api` route to `shop-api`, so the admin session cookie and OAuth callback stay on one origin.
- **`API_ORIGIN`** is the internal Docker name of `shop-api` (its App Name, e.g. `http://shop-api-xxxx:4000`), not the public URL.
- **Redis is required.** Admin sign-in, TOTP replay protection and rate limits fail closed without it; the storefront keeps working.

## Checks

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm test:e2e
```

## Docs

- Design: `docs/superpowers/specs/`
- Plans: `docs/superpowers/plans/`
- Decisions: `docs/adr/`
- Deploy guide (step by step): `docs/guides/deploy-from-scratch.md`
- Deploy runbook (reference): `docs/runbooks/deploy.md`
