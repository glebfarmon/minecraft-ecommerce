# Deploy runbook

One-time setup of production. Replace `<domain>`, `<owner>`, `<repo>`, `<your-ip>`.

## 1. Domain and Cloudflare

1. Buy a domain at any registrar.
2. Cloudflare → Add site → Free plan → set the registrar's nameservers to Cloudflare's.
3. SSL/TLS → Overview → **Full (strict)**. Edge Certificates → **Always Use HTTPS** on.
4. SSL/TLS → Origin Server → **Create certificate** for `<domain>, *.<domain>` (15 years). Save the certificate and private key.

## 2. Hetzner server

1. Hetzner Cloud → new server: Ubuntu 24.04, smallest shared x86 plan with 4 GB RAM (CX22 or its successor), your SSH key.
2. Firewalls → create `shop-fw`, attach to the server:
   - TCP 22 from `<your-ip>/32`
   - TCP 80 and 443 from every range in https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
   - Nothing else (port 3000 stays closed).
3. Cloudflare DNS → A records, **proxied (orange cloud)**, to the server IPv4: `@`, `admin`, `api`, `deploy`.

## 3. Dokploy

1. `ssh root@<server-ip>` then `curl -sSL https://dokploy.com/install.sh | sh`.
2. Open the UI through a tunnel for first setup: `ssh -L 3000:localhost:3000 root@<server-ip>` → http://localhost:3000 → create the admin account.
3. Settings → Certificates → add the Cloudflare Origin certificate and key.
4. Settings → Web Server → domain `deploy.<domain>`, HTTPS on, custom certificate.

## 4. Cloudflare Access for the Dokploy UI

1. Zero Trust (free plan) → Access → Applications → Self-hosted → `deploy.<domain>`.
2. Policy 1 "Owner": Allow, Include → Emails → your email.
3. Access → Service Auth → Service Tokens → create `github-actions`; save Client ID and Secret.
4. Policy 2 "CI": action **Service Auth**, Include → Service Token → `github-actions`.
5. Check: opening `https://deploy.<domain>` asks for the Access login first.

## 5. Dokploy project and apps

1. Project `shop`.
2. Databases: Postgres (`postgres:18-alpine`), Redis (`redis:8-alpine`). Internal only (no external port).
3. Applications, provider **Docker**, image `ghcr.io/<owner>/<repo>/<app>:latest`:

| App          | Image            | Port | Domains (HTTPS, custom cert)                                                  |
| ------------ | ---------------- | ---- | ----------------------------------------------------------------------------- |
| `shop-api`   | `…/api:latest`   | 4000 | `api.<domain>` path `/`; `<domain>` path `/api`; `admin.<domain>` path `/api` |
| `shop-web`   | `…/web:latest`   | 3000 | `<domain>` path `/`                                                           |
| `shop-admin` | `…/admin:latest` | 3001 | `admin.<domain>` path `/`                                                     |

Keep "strip path" **off** for the `/api` domains. Traefik gives longer rules higher priority, so `Host && PathPrefix(/api)` wins over `Host`. 4. After the first CI publish, make the three GHCR packages **public** (GitHub → Packages → Package settings → Change visibility). 5. Settings → Profile → API → generate an API key. 6. Copy each application's ID from its URL in the Dokploy UI.

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
