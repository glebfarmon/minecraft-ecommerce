# ADR 0003: Dokploy on a Hetzner VPS behind Cloudflare, images from GHCR

- Status: Accepted
- Date: 2026-10-01

## Context

Free or near-free hosting for a live demo with Postgres, Redis and three apps; push-to-deploy from GitHub; DDoS protection without paid plans.

## Decision

- One Hetzner VPS (~€5/mo) running Dokploy (Traefik + Docker).
- Cloudflare free plan proxies every hostname; the Hetzner firewall accepts 80/443 only from Cloudflare ranges, so the origin cannot be hit directly.
- CI builds images to GHCR (free for public repos) and triggers Dokploy's API. The Dokploy UI is reachable only at `deploy.<domain>` behind Cloudflare Access; CI authenticates with an Access service token.
- The deploy job fails unless `/api/health` reports the commit SHA that CI built.

## Consequences

- Builds run on GitHub runners, not on the 4 GB VPS.
- Single environment; no staging.
- Rollback = redeploy a previous `sha-<sha>` tag in Dokploy.
- Deploy verification checks only the api's `/api/health` version against `GITHUB_SHA`. web and admin are deployed from the same push but expose no version yet; verifying them is deferred to the storefront sub-project.

## Alternatives rejected

- Vercel/Render/Fly free tiers: split hosting for web vs api vs databases, sleep on idle, limits on background workers.
- Coolify: comparable; Dokploy chosen for lighter footprint and simple API.
- Dokploy building from the Git repo on the VPS: Next.js builds need more RAM than the VPS can spare.
