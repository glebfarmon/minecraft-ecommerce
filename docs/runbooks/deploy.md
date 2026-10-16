# Deploy runbook

One-time setup of production. For a step-by-step walkthrough with every click and check, see [`docs/guides/deploy-from-scratch.md`](../guides/deploy-from-scratch.md). Replace `<domain>`, `<owner>`, `<repo>`, `<your-ip>`.

## 1. Domain and Cloudflare

1. Buy a domain at any registrar.
2. Cloudflare → Add site → Free plan → set the registrar's nameservers to Cloudflare's.
3. SSL/TLS → Overview → **Full (strict)**. Edge Certificates → **Always Use HTTPS** on.
4. SSL/TLS → Origin Server → **Create certificate** for `<domain>, *.<domain>` (15 years). Save the certificate and private key.

## 2. Hetzner server

1. Hetzner Cloud → new server: Debian 13, **Arm64 (Ampere)** shared plan with 2 vCPU / 4 GB RAM (CAX11 or its successor), public IPv4 + IPv6, your SSH key. CI publishes `linux/arm64` images only; an x86 server cannot run them. Add 4 GB swap (`fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`, plus a `/etc/fstab` line).
2. Firewalls → create `shop-fw`, attach to the server:
   - TCP 22 from `<your-ip>/32`
   - TCP 80 and 443 from every range in https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
   - Nothing else (port 3000 stays closed).
3. Cloudflare DNS → A records, **proxied (orange cloud)**, to the server IPv4: `@`, `admin`, `api`, `deploy`.
4. Cloudflare → Caching → Cache Rules → rule "Next images": URI Path starts with `/_next/image` → **Eligible for cache**, Edge TTL **Use cache-control header if present**. The web app sends `immutable` for these, so optimized images are served from the edge and survive deploys (the app's own image cache lives in the container).

## 3. Dokploy

1. `ssh root@<server-ip>` then `curl -sSL https://dokploy.com/install.sh | sh`.
2. Open the UI through a tunnel for first setup: `ssh -L 3000:localhost:3000 root@<server-ip>` → http://localhost:3000 → create the admin account.
3. Settings → Certificates → add the Cloudflare Origin certificate and key (name `cloudflare-origin`). Traefik serves it for every `*.<domain>` host by SNI.
4. Settings → Web Server → domain `deploy.<domain>`, Let's Encrypt **off** (Cloudflare terminates TLS; the origin uses the Origin certificate).
5. If `https://deploy.<domain>` answers 526 and `openssl s_client -connect <server-ip>:443 -servername deploy.<domain>` shows `TRAEFIK DEFAULT CERT`, Dokploy wrote only an HTTP router. Replace the router in `/etc/dokploy/traefik/dynamic/dokploy.yml` (keep a `.bak`):

   ```yaml
   http:
     routers:
       dokploy-router-app:
         rule: Host(`deploy.<domain>`)
         service: dokploy-service-app
         entryPoints:
           - websecure
         tls: {}
     services:
       dokploy-service-app:
         loadBalancer:
           servers:
             - url: http://dokploy:3000
           passHostHeader: true
   ```

   Traefik reloads the file on its own. Saving the Web Server domain in the UI again overwrites it.

## 4. Cloudflare Access for the Dokploy UI

1. Zero Trust (free plan) → Access → Applications → Self-hosted → `deploy.<domain>`.
2. Policy 1 "Owner": Allow, Include → Emails → your email. Not "Login Methods: One-time PIN": that admits anyone who can receive a code.
3. Access → Service Auth → Service Tokens → create `github-actions`; save Client ID and Secret.
4. Policy 2 "CI": action **Service Auth**, Include → Service Token → `github-actions`.
5. Policies are reusable objects: check that both appear on the application itself, not only under Access → Policies.
6. Check: `curl -s -o /dev/null -w '%{http_code}' https://deploy.<domain>/` gives `302` (Access login); with `-H "CF-Access-Client-Id: …" -H "CF-Access-Client-Secret: …"` it gives `200`. A `403` with the token means no Service Auth policy on the application admits it.

## 5. Dokploy project and apps

1. Project `shop`.
2. Databases: Postgres (`postgres:18-alpine`), Redis (`redis:8-alpine`). Internal only (no external port).
3. Applications, provider **Docker**, image `ghcr.io/<owner>/<repo>/<app>:latest`:

| App          | Image            | Port | Domains (HTTPS, custom cert)                                                  |
| ------------ | ---------------- | ---- | ----------------------------------------------------------------------------- |
| `shop-api`   | `…/api:latest`   | 4000 | `api.<domain>` path `/`; `<domain>` path `/api`; `admin.<domain>` path `/api` |
| `shop-web`   | `…/web:latest`   | 3000 | `<domain>` path `/`                                                           |
| `shop-admin` | `…/admin:latest` | 3001 | `admin.<domain>` path `/`                                                     |

Every domain: HTTPS **on**, certificate provider **None** (Traefik picks the Origin certificate by SNI), "strip path" **off**. The `/api` domains must keep the prefix. Traefik gives longer rules higher priority, so `Host && PathPrefix(/api)` wins over `Host`.

The images set `PORT`, `APP_VERSION` and `HOSTNAME`. The catalog adds the following.

**Environment**

- `shop-api`: `DATABASE_URL` = the Postgres connection string (internal Dokploy host), e.g. `postgresql://<user>:<password>@<postgres-service>:5432/<db>`. Without it the API falls back to `localhost:5432` and `/api/catalog` returns 500.
- `shop-api` (admin auth, ADR 0009):
  - `REDIS_URL` = the internal Redis URL (rate limits, permission cache, used TOTP codes). The admin limiters fail closed: while Redis is down, sign-in codes are not sent and the admin API and TOTP checks answer with errors (429/403/500). The storefront (`/api/catalog`, the web app) keeps working.
  - `BETTER_AUTH_URL` = `https://admin.<domain>`; `BETTER_AUTH_SECRET` = 32+ random characters (`openssl rand -base64 32`). The API refuses to start in production without a valid secret.
  - `RCON_ENCRYPTION_KEY` = 32 random bytes in base64 (`openssl rand -base64 32`); it encrypts the RCON passwords stored by the catalog admin. Store it in your password manager: losing or changing it means re-entering every RCON password. Without it the RCON settings answer 503 (the shop keeps working). `RCON_ALLOW_PRIVATE_HOSTS` must stay unset in production: it would let an admin probe the server's internal network.
  - `RESEND_API_KEY` and `MAIL_FROM` (an address on the domain verified in Resend, e.g. `Shop Admin <no-reply@<domain>>`). Production does not use `compose.yaml`; Mailpit is dev/e2e only.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; optional `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`.
  - `ADMIN_OWNER_EMAIL` = the first owner (see "First owner" below).
  - `TRUST_CF_CONNECTING_IP=true`. The client IP for rate limits and audit rows is then `CF-Connecting-IP`; this is safe only while the origin is reachable through Cloudflare alone (the `shop-fw` firewall, section 2). Without it the last `X-Forwarded-For` hop is used, else the socket peer.
  - Optional `RATE_LIMIT_*` overrides (positive integers), defaults: `RATE_LIMIT_OTP_EMAIL` 3 per email per 10 min, `RATE_LIMIT_OTP_IP` 10 per IP per hour, `RATE_LIMIT_SECOND_FACTOR` 5 per session per min (TOTP and backup codes), `RATE_LIMIT_2FA_DAY` 30 per user per day (TOTP and backup codes), `RATE_LIMIT_ADMIN` 300 per session per min, `RATE_LIMIT_ADMIN_IP` 600 per IP per min, `RATE_LIMIT_RCON_TEST` 5 per session per min (RCON connection tests), `RATE_LIMIT_DEFAULT` 100 per IP per min.
- `shop-admin`: `API_ORIGIN` = the internal URL of `shop-api` (as for `shop-web`) and `GOOGLE_SIGN_IN=on`.
- `shop-web`: `API_ORIGIN` = the internal URL of `shop-api`, e.g. `http://<shop-api-service>:4000`. Without it the web app falls back to `http://localhost:4000` and every page shows "shop unavailable".

**Admin routing.** `admin.<domain>` path `/api` must go to `shop-api` (the table above) so the sign-in cookie, the OAuth callback and API calls share the admin origin.

**Google sign-in.** In Google Cloud Console (OAuth client, web application):

- Authorized JavaScript origins: `https://admin.<domain>`, `http://admin.shop.localhost`
- Authorized redirect URIs: `https://admin.<domain>/api/auth/callback/google`, `http://admin.shop.localhost/api/auth/callback/google`

**Migrations (automatic).** The `shop-api` container runs `prisma migrate deploy` on every start, before the server listens. A failed migration stops the container: the deploy job then fails on the version check, and the logs of `shop-api` show the Prisma error. While the new container migrates, the old one may still serve, so a migration must not break the previous release (add columns first, drop them in a later release). Migration `20261014100100_catalog_admin_permissions` gives the existing `ADMIN` role `catalog.write` and `server.rcon`; like every migration it runs automatically when the new `shop-api` container starts, so there is nothing to run by hand.

**Seed (once only).** After the first `shop-api` start has applied the migrations, run in its Terminal:

```bash
node dist/seed/main.js
```

**First owner.** Before the seed, set `ADMIN_OWNER_EMAIL` on `shop-api`. The seed creates the system roles and invites that address once (skipped if the person exists or has an open invite); the invite link is emailed through Resend and also printed to the seed's output (use it if the mail does not arrive). In production the API and the seed refuse to start without `RESEND_API_KEY` or `SMTP_URL`. Open it, sign in, and enroll TOTP (mandatory for every admin).

Never put the seed in the per-deploy command: re-running it would resurrect demo products deleted later through admin editing.

CI verifies `/api/health/ready` (database reachable) after the version check, so a missing or wrong `DATABASE_URL` fails the deploy job.

4. After the first CI publish, check that the three GHCR packages are **public** (a public repository publishes them public; otherwise GitHub → Packages → Package settings → Change visibility). Dokploy then pulls them without registry credentials: provider **Docker**, registry, username and password empty; the build type is ignored.
5. Settings → Profile → API → generate an API key.
6. Copy each application's ID from its URL in the Dokploy UI: the last segment, after `/application/` (not the project or environment ID). A wrong ID fails the deploy job with `404 Application not found`.

## 6. GitHub secrets (repo → Settings → Secrets and variables → Actions)

| Secret                                                               | Value                     |
| -------------------------------------------------------------------- | ------------------------- |
| `DOKPLOY_URL`                                                        | `https://deploy.<domain>` |
| `DOKPLOY_API_KEY`                                                    | Dokploy API key           |
| `DOKPLOY_API_APP_ID` / `DOKPLOY_WEB_APP_ID` / `DOKPLOY_ADMIN_APP_ID` | Application IDs           |
| `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`                    | Service token             |
| `PROD_URL`                                                           | `https://<domain>`        |

Create a GitHub environment `production` and move these secrets into it.

## 7. Verify

```bash
curl -s https://<domain>/api/health     # {"status":"ok","version":"<commit sha>"}
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/
curl -s -o /dev/null -w '%{http_code}\n' https://admin.<domain>/
curl -s -m 5 http://<server-ip>/ || echo "origin closed to the internet: OK"
```

## 8. GitHub repository settings

- Security → enable **CodeQL default setup**.
- Security → enable **secret scanning** and **push protection**.
- Settings → Rules → branch rule on `main` requiring status checks `quality`, `commitlint`, `e2e`, `gitleaks`.

## 9. First push

Images are published and deployed only on a push to `main` (a merged PR); pull requests run the checks alone. `quality`, `commitlint`, `e2e`, `gitleaks` and `publish` should go green. `deploy` fails with "expected 3 Dokploy application IDs" until sections 1–6 are done and the GHCR packages are public; then re-run the `deploy` job.

## 10. Local admin stack

`docker compose up -d postgres redis mailpit`; Mailpit shows sign-in codes and invites at http://localhost:8025. The admin e2e flow is stateful: before a local rerun, `docker compose -f compose.yaml -f compose.e2e.yaml down -v`.

## 11. Rollback

In Dokploy set the app image to `ghcr.io/<owner>/<repo>/<app>:sha-<previous sha>` and redeploy. Set it back to `:latest` after the fix lands. `<owner>/<repo>` must be lowercase in GHCR names.
