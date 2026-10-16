# Deploy from scratch

A step-by-step guide to putting this shop on the internet with your own domain. It assumes no experience with servers, Docker or GitHub Actions: every click and every command is written out, and each part ends with a check that tells you it worked.

The short reference for people who have done this before is [`docs/runbooks/deploy.md`](../runbooks/deploy.md). This guide covers the same ground in detail.

## Contents

0. [What you are building](#0-what-you-are-building)
1. [Accounts and tools](#1-accounts-and-tools)
2. [Your copy of the code (GitHub)](#2-your-copy-of-the-code-github)
3. [Domain and Cloudflare](#3-domain-and-cloudflare)
4. [SSH key](#4-ssh-key)
5. [Server (Hetzner)](#5-server-hetzner)
6. [Firewall](#6-firewall)
7. [Server basics: swap and updates](#7-server-basics-swap-and-updates)
8. [Dokploy](#8-dokploy)
9. [Lock the Dokploy panel with Cloudflare Access](#9-lock-the-dokploy-panel-with-cloudflare-access)
10. [Email (Resend)](#10-email-resend)
11. [Google sign-in (optional)](#11-google-sign-in-optional)
12. [First images (GitHub Actions)](#12-first-images-github-actions)
13. [Databases in Dokploy](#13-databases-in-dokploy)
14. [The three applications](#14-the-three-applications)
15. [First start, demo data and the owner account](#15-first-start-demo-data-and-the-owner-account)
16. [Automatic deploys](#16-automatic-deploys)
17. [Cloudflare tuning](#17-cloudflare-tuning)
18. [Everyday work](#18-everyday-work)
19. [Troubleshooting](#19-troubleshooting)

---

## 0. What you are building

```
visitor ──HTTPS──▶ Cloudflare ──HTTPS──▶ your server (Hetzner)
                                            │
                                            ├─ Traefik (routes by domain and path)
                                            │    ├─ <domain>/          → shop-web    (storefront, Next.js)
                                            │    ├─ <domain>/api       → shop-api    (NestJS)
                                            │    ├─ admin.<domain>/    → shop-admin  (admin panel, Next.js)
                                            │    ├─ admin.<domain>/api → shop-api
                                            │    ├─ api.<domain>/      → shop-api
                                            │    └─ deploy.<domain>    → Dokploy panel (behind Cloudflare Access)
                                            ├─ Postgres (data)
                                            └─ Redis (admin sign-in limits and sessions)

GitHub ── on every merge to main ──▶ tests ──▶ builds 3 images ──▶ tells Dokploy to update
```

A few words you will meet:

| Word               | Meaning                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Docker image**   | A packaged app: code plus everything it needs to run. GitHub builds the images; the server only downloads and starts them.      |
| **Container**      | A running image.                                                                                                                |
| **Dokploy**        | A web panel on your server that starts containers, databases and domains for you. You click instead of writing Docker commands. |
| **Traefik**        | The router inside Dokploy: it reads the domain and path of each request and sends it to the right container.                    |
| **Cloudflare**     | Sits in front of your server: hides its IP address, provides HTTPS, caches images, blocks attacks.                              |
| **GitHub Actions** | GitHub's robots. On every change to `main` they run the tests, build the images and trigger the deploy.                         |
| **SSH**            | A secure terminal on the server. You type commands on your computer; they run on the server.                                    |

**Time:** about 2–3 hours the first time, most of it waiting for DNS and builds.

**Cost per month (October 2026):**

| Item                                       | Price                               |
| ------------------------------------------ | ----------------------------------- |
| Hetzner CAX11 server (2 vCPU, 4 GB, arm64) | about €4                            |
| Domain                                     | €1–15 per year, depends on the zone |
| Cloudflare, Cloudflare Zero Trust          | free (Zero Trust: up to 50 users)   |
| GitHub, GitHub Actions, image registry     | free for a public repository        |
| Resend (email)                             | free up to 3,000 emails per month   |

Throughout the guide, replace:

- `<domain>` with your domain, e.g. `myshop.app`;
- `<owner>` with your GitHub username, **lowercase**;
- `<repo>` with the name of your repository on GitHub, **lowercase**;
- `<server-ip>` with the server's IPv4 address (you get it in part 5).

> **Keep secrets in a password manager.** You will create about ten passwords and keys. Save each one in a password manager (1Password, Bitwarden, the one in your browser) as soon as you see it: several are shown only once. Never put them in the repository, in a chat or in a screenshot.

---

## 1. Accounts and tools

Create these accounts (all have a free tier except Hetzner and the domain). Turn on two-factor authentication in each one: whoever gets into any of them can take over the shop.

1. **GitHub** — https://github.com/signup
2. **Cloudflare** — https://dash.cloudflare.com/sign-up
3. **Hetzner Cloud** — https://console.hetzner.cloud (needs a payment method; new accounts are sometimes verified with an ID)
4. **A domain registrar** — any: Namecheap, name.com, Porkbun, Cloudflare Registrar. You can also buy the domain at Cloudflare and skip part 3.2.
5. **Resend** — https://resend.com (sends the admin sign-in codes)
6. **Google Cloud** — only if you want "Sign in with Google" in the admin panel (part 11)

On your computer you need only a terminal:

- **macOS:** the app "Terminal" (Finder → Applications → Utilities).
- **Windows 10/11:** "Windows Terminal" or "PowerShell" (Start menu). `ssh` is built in.
- **Linux:** any terminal.

Building or running the shop on your computer is **not** needed for a deploy.

---

## 2. Your copy of the code (GitHub)

The deploy pipeline publishes images under the GitHub account that owns the repository, so you need your own copy.

1. Open the original repository on GitHub and click **Fork** (top right) → **Create fork**. Keep it **public**: GitHub then builds and stores the images for free, and the server can download them without a password.
2. In your fork open the **Actions** tab. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
3. Write down `<owner>/<repo>` in lowercase: e.g. the fork `https://github.com/JaneDoe/Minecraft-Shop` gives `janedoe/minecraft-shop`. Image names will be `ghcr.io/janedoe/minecraft-shop/api` and so on.

**Check:** the Actions tab of your fork shows the workflow "CI" (it may have no runs yet).

---

## 3. Domain and Cloudflare

### 3.1 Add the domain to Cloudflare

1. Cloudflare dashboard → **Add a domain** (or "Add site") → type `<domain>` → **Continue**.
2. Choose the **Free** plan.
3. Cloudflare scans for existing DNS records. For a new domain the list is empty or holds the registrar's parking records: **delete them all**, you will add the right ones in 3.3.
4. Cloudflare shows **two nameservers**, e.g. `aryanna.ns.cloudflare.com` and `gordon.ns.cloudflare.com`. Keep this page open.

### 3.2 Point the domain at Cloudflare (at the registrar)

DNS records are managed in Cloudflare from now on, **not** at the registrar. Records you add at the registrar stop working after this step.

1. Log in at your registrar → your domain → **Nameservers** (sometimes "DNS servers" or "Manage nameservers").
2. Choose "custom nameservers", delete the registrar's ones, enter the two Cloudflare nameservers, save.
3. Wait. It usually takes 5–30 minutes, sometimes up to 24 hours. Cloudflare emails you when the domain is active.

**Check** (macOS/Linux terminal; on Windows use `nslookup -type=NS <domain>`):

```bash
dig NS <domain> +short
```

Expected: the two `*.ns.cloudflare.com` names.

### 3.3 SSL settings

Cloudflare dashboard → your domain:

1. **SSL/TLS → Overview → Configure** → **Full (strict)** → Save. "Full (strict)" means Cloudflare checks the certificate on your server too, so nobody can sit between them.
2. **SSL/TLS → Edge Certificates**:
   - **Always Use HTTPS**: on
   - **Automatic HTTPS Rewrites**: on
   - **Minimum TLS Version**: TLS 1.2
   - **TLS 1.3**: on

### 3.4 Origin certificate

Your server needs its own certificate that Cloudflare trusts. Cloudflare issues one for free, valid for 15 years.

1. **SSL/TLS → Origin Server → Create Certificate**.
2. Keep **Generate private key and CSR with Cloudflare**, key type **RSA (2048)**.
3. Hostnames: `<domain>` and `*.<domain>` (both are prefilled usually).
4. Validity: **15 years** → **Create**.
5. Cloudflare shows two text blocks: **Origin Certificate** and **Private Key**. Copy **both** into your password manager now (as two notes, e.g. "Origin cert" and "Origin key"). **The private key is never shown again.**

DNS records come in part 5, once the server has an address.

---

## 4. SSH key

An SSH key is a pair of files: a private one that stays on your computer and a public one you give to the server. With it you log in without a password, and nobody can guess their way in.

1. Open the terminal and run (it works the same on macOS, Linux and Windows PowerShell):

   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```

   `ed25519` is the key type: short, fast and secure.

2. Press **Enter** to accept the default file location. If it asks to overwrite an existing key, answer `n` and use the key you already have.
3. Enter a passphrase (it protects the key if your laptop is stolen) or press Enter twice for none.
4. Print the **public** key:
   - macOS/Linux: `cat ~/.ssh/id_ed25519.pub`
   - Windows: `type $env:USERPROFILE\.ssh\id_ed25519.pub`

   It is one line starting with `ssh-ed25519`. Copy the whole line. The file **without** `.pub` is your private key: never share it.

> If `~/.ssh` does not exist yet, that is fine: `ssh-keygen` creates it.

---

## 5. Server (Hetzner)

### 5.1 Create the server

Hetzner Cloud Console → create a project (e.g. `shop`) → **Add Server**:

| Setting    | Choose                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Location   | The one closest to your players (e.g. Helsinki or Falkenstein for Europe).                             |
| Image      | **Debian 13**                                                                                          |
| Type       | **Shared vCPU → Arm64 (Ampere)** → **CAX11** (2 vCPU, 4 GB RAM, 40 GB disk) or the current equivalent. |
| Networking | **Public IPv4** and **Public IPv6** both on.                                                           |
| SSH keys   | **Add SSH key** → paste the `ssh-ed25519 …` line from part 4.                                          |
| Volumes    | None. 40 GB is plenty.                                                                                 |
| Firewalls  | Skip for now (part 6).                                                                                 |
| Backups    | Optional (+20% price); recommended once the shop has real data.                                        |
| Name       | e.g. `shop-1`                                                                                          |

**It must be Arm64.** The images are built for arm64 only; an x86 server (CX, CPX types) cannot run them.

Click **Create & Buy now**. After a minute the server page shows its **IPv4** (e.g. `65.21.10.20`) and **IPv6** (a block like `2a01:4f9:c012:abcd::/64`; the server's own address is that block with `1` at the end: `2a01:4f9:c012:abcd::1`).

On the server page → **Protection**: turn on **Delete protection** and **Rebuild protection**, so a misclick cannot wipe it.

### 5.2 DNS records

Cloudflare → your domain → **DNS → Records → Add record**. Add these, each with **Proxy status: Proxied** (orange cloud):

| Type | Name     | Content                    |
| ---- | -------- | -------------------------- |
| A    | `@`      | `<server-ip>`              |
| A    | `admin`  | `<server-ip>`              |
| A    | `api`    | `<server-ip>`              |
| A    | `deploy` | `<server-ip>`              |
| AAAA | `@`      | the server's IPv6 (`…::1`) |
| AAAA | `admin`  | the server's IPv6          |
| AAAA | `api`    | the server's IPv6          |
| AAAA | `deploy` | the server's IPv6          |

`@` means the domain itself. Optional: a `CNAME` `www` → `<domain>`, proxied, plus a redirect in part 17.

Cloudflare may warn "This hostname is not covered by a certificate" for deeper names or "Add an MX record": ignore both for now. MX records come with Resend in part 10.

### 5.3 First login

```bash
ssh root@<server-ip>
```

The first time it asks `Are you sure you want to continue connecting (yes/no)?` → type `yes`. You are in when the prompt ends in `root@shop-1:~#`. Every command in parts 6–8 that starts on a new line runs here, on the server. To leave the server: `exit`.

---

## 6. Firewall

The server must accept web traffic **only from Cloudflare**, and SSH **only from you**. Otherwise anyone can reach the apps directly, bypassing Cloudflare's protection, and fake their IP address in the logs.

Use the **Hetzner Cloud Firewall**, not `ufw` on the server: Docker opens its ports past `ufw`, so `ufw` rules would silently not apply.

1. Find your home IP address: open https://ifconfig.me in the browser.
2. Hetzner Console → **Firewalls → Create Firewall**, name `shop-fw`.
3. Delete the default rules, then add **inbound** rules:

   | Protocol | Port | Source                                     |
   | -------- | ---- | ------------------------------------------ |
   | TCP      | 22   | `<your-home-ip>/32`                        |
   | TCP      | 80   | every Cloudflare range listed below        |
   | TCP      | 443  | every Cloudflare range listed below        |
   | ICMP     | —    | Any (optional: lets you `ping` the server) |

   Cloudflare ranges (current list: https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6; check them, they change rarely):

   ```
   173.245.48.0/20
   103.21.244.0/22
   103.22.200.0/22
   103.31.4.0/22
   141.101.64.0/18
   108.162.192.0/18
   190.93.240.0/20
   188.114.96.0/20
   197.234.240.0/22
   198.41.128.0/17
   162.158.0.0/15
   104.16.0.0/13
   104.24.0.0/14
   172.64.0.0/13
   131.0.72.0/22
   2400:cb00::/32
   2606:4700::/32
   2803:f800::/32
   2405:b500::/32
   2405:8100::/32
   2a06:98c0::/29
   2c0f:f248::/32
   ```

4. Leave outbound rules empty (everything allowed).
5. **Apply to** → your server → **Create Firewall**.

Nothing else is open: not 3000 (Dokploy), not 5432 (Postgres), not 6379 (Redis).

> **Your home IP changes** (new router, travelling): SSH stops connecting with "Operation timed out". Fix: Hetzner Console → Firewalls → `shop-fw` → edit the port 22 rule with your new IP.

**Check:** `ssh root@<server-ip>` still works.

---

## 7. Server basics: swap and updates

On the server (`ssh root@<server-ip>`):

1. **Update the system:**

   ```bash
   apt update && apt upgrade -y
   ```

2. **Swap** (spare memory on disk, so a memory spike slows the server down instead of killing an app):

   ```bash
   fallocate -l 4G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

   Check: `free -h` shows `Swap: 4.0Gi`.

3. **Automatic security updates:**

   ```bash
   apt install -y unattended-upgrades
   dpkg-reconfigure -plow unattended-upgrades
   ```

   Answer **Yes**.

4. **Password login is off?** Hetzner disables it when you add an SSH key; confirm:

   ```bash
   sshd -T | grep -i passwordauthentication
   ```

   Expected: `passwordauthentication no`.

Keep logging in as `root`: Dokploy needs root, and with key-only login and the firewall this is safe. You do not need to create other users; the apps already run as an unprivileged user inside their containers.

---

## 8. Dokploy

### 8.1 Install

On the server:

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

It installs Docker and Dokploy and takes 2–5 minutes. It ends by printing a URL with port 3000; that port is closed by the firewall on purpose, so use a tunnel instead.

### 8.2 Open the panel through an SSH tunnel

On **your computer** (a new terminal window, not inside the server):

```bash
ssh -L 3000:localhost:3000 root@<server-ip>
```

Keep this window open and visit http://localhost:3000 in the browser: the request travels through SSH to the server. Create the Dokploy admin account (email + strong password → password manager).

### 8.3 Load the Origin certificate

Dokploy → **Settings → Certificates** (in some versions under "Web Server") → **Add Certificate**:

- Name: `cloudflare-origin`
- Certificate: paste the **Origin Certificate** block from part 3.4 (from `-----BEGIN CERTIFICATE-----` to `-----END CERTIFICATE-----`)
- Private key: paste the **Private Key** block
- Save. The list shows the certificate with an expiry 15 years ahead.

### 8.4 Give the panel its domain

Dokploy → **Settings → Web Server → Server Domain**:

- Domain: `deploy.<domain>`
- Let's Encrypt / automatic certificate: **off** (Cloudflare handles public HTTPS, the Origin certificate covers the server)
- Save.

Open `https://deploy.<domain>` in the browser.

- **The Dokploy login page appears:** go on to part 9.
- **Error 526 "Invalid SSL certificate":** Dokploy created only an HTTP route. Fix it in 8.5.

### 8.5 Fix 526 on the panel (only if you got it)

On the server:

```bash
cp /etc/dokploy/traefik/dynamic/dokploy.yml /etc/dokploy/traefik/dynamic/dokploy.yml.bak
nano /etc/dokploy/traefik/dynamic/dokploy.yml
```

`nano` is a simple text editor in the terminal. Delete everything (hold **Ctrl+K** until the file is empty) and paste, with your domain in the `rule` line:

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

Save: **Ctrl+O**, **Enter**; exit: **Ctrl+X**. Traefik picks up the change within seconds.

**Check:** `https://deploy.<domain>` shows the Dokploy login. From now on you no longer need the SSH tunnel.

> If you ever save the Server Domain in Dokploy's settings again, it overwrites this file; repeat 8.5.

---

## 9. Lock the Dokploy panel with Cloudflare Access

The Dokploy panel controls everything, so only you (and the GitHub robot) should reach it at all. Cloudflare Access puts a login screen in front of it: before Dokploy even loads, Cloudflare emails you a code.

### 9.1 Turn on Zero Trust

Cloudflare dashboard → **Zero Trust** (left menu). The first time:

1. Choose a team name (anything, e.g. `myshop`).
2. Plan: **Free**. It asks for a payment method but charges nothing; "users" are the people who log in through Access, up to 50 for free (you are one).

### 9.2 Protect `deploy.<domain>`

Zero Trust → **Access** (in new dashboards "Access controls") → **Applications → Add an application** → **Self-hosted** (in some versions "Self-hosted and private" → "Public hostname"):

1. Application name: `Dokploy`.
2. Public hostname: subdomain `deploy`, domain `<domain>`, path empty.
3. Login method: **One-time PIN** (codes by email) is enough.
4. Policy → **Add a policy** (or "Create new policy"):
   - Name: `Owner`
   - Action: **Allow**
   - Include → Selector **Emails** → your email address.

   Do **not** use the selector "Login Methods → One-time PIN" as the rule: it lets in anyone who can receive a code to any address.

5. Save the application.

**Check:** a private browser window → `https://deploy.<domain>` shows a Cloudflare page asking for your email; the code arrives; then Dokploy's login appears.

### 9.3 A key for GitHub (service token)

GitHub's robot cannot read your email, so it gets its own key.

1. Zero Trust → **Access → Service Auth → Service Tokens** (new dashboards: "Access controls → Service credentials → Service Tokens") → **Create Service Token**.
2. Name: `github-actions`, duration: **Non-expiring** → **Generate token**.
3. Copy **Client ID** and **Client Secret** to your password manager. **The secret is shown once.**
4. Go back to the `Dokploy` application → **Policies → Add a policy**:
   - Name: `CI`
   - Action: **Service Auth** (not "Allow")
   - Include → Selector **Service Token** → `github-actions`.
5. Save. The application now lists **two** policies: `Owner` (Allow) and `CI` (Service Auth). Policies are separate objects in new dashboards: make sure both are attached **to the application**, not only created.

**Check** on your computer (macOS/Linux; `read -s` hides what you type):

```bash
read -s "CFID?Client ID: "; echo; read -s "CFSECRET?Client Secret: "; echo
curl -s -o /dev/null -w '%{http_code}\n' https://deploy.<domain>/
curl -s -o /dev/null -w '%{http_code}\n' -H "CF-Access-Client-Id: $CFID" -H "CF-Access-Client-Secret: $CFSECRET" https://deploy.<domain>/
```

(In bash instead of zsh: `read -s -p "Client ID: " CFID`.)

Expected: `302` without the token (redirect to the login), `200` with it. A `403` with the token means the `CI` policy is missing from the application or its action is not Service Auth.

### 9.4 Dokploy API key

Dokploy → **Settings → Profile → API / CLI → Generate API Key**:

- Name `github-actions`, prefix `gha`, expiration **Never**, rate limiting off.
- Copy the key to your password manager (shown once).

---

## 10. Email (Resend)

The admin panel signs people in with one-time codes by email and sends invitations. The API refuses to start in production without a mail service.

1. Resend → **Domains → Add Domain** → `<domain>` → region closest to the server (e.g. EU).
2. Resend lists 3–4 DNS records (MX and TXT for `send`, a TXT `resend._domainkey`, sometimes a TXT `_dmarc`). For **each**: Cloudflare → DNS → Records → Add record, copy Type, Name and Content exactly, **Proxy status: DNS only** (grey cloud; mail records cannot be proxied). For MX also copy the priority.
3. Back in Resend → **Verify DNS records**. It takes from a minute to an hour; the domain turns **Verified**.
4. Resend → **API Keys → Create API Key**: name `shop`, permission **Sending access**, domain `<domain>` → copy the key (`re_…`, shown once) to your password manager.

---

## 11. Google sign-in (optional)

Skip this part if email codes are enough. You can add it later.

1. https://console.cloud.google.com → project picker → **New project** → name `shop` → Create, then select it.
2. **APIs & Services → OAuth consent screen** (new consoles: "Google Auth Platform → Branding"): app name `Shop admin`, your support email, **Audience: External**. Under **Test users** add the Google accounts that will sign in (in testing mode only they can).
3. **Clients** (or "Credentials → Create credentials → OAuth client ID") → type **Web application**, name `shop-admin`:
   - Authorized JavaScript origins: `https://admin.<domain>`
   - Authorized redirect URIs: `https://admin.<domain>/api/auth/callback/google`
4. **Create** → copy **Client ID** and **Client secret** to your password manager.

---

## 12. First images (GitHub Actions)

The server runs images that GitHub builds. They appear after the first run of the CI workflow on `main`.

1. The workflow runs on every change to `main`. Make a small one in the browser: your fork → `README.md` → pencil icon → change any word → **Commit changes** → "Commit directly to the `main` branch" → **Commit changes**.
2. Watch **Actions**: `quality`, `e2e` and `gitleaks` run tests (about 10 minutes), then `publish (api)`, `publish (web)`, `publish (admin)` build and upload the images.
3. `deploy` **fails** with `expected 3 Dokploy application IDs, got 0`. This is expected until part 16.

**Check:** your GitHub profile → **Packages** shows `api`, `web` and `admin`, each **Public**. If one is private: open it → **Package settings → Change visibility → Public**.

---

## 13. Databases in Dokploy

`https://deploy.<domain>` → **Projects → Create Project** → name `shop`.

### 13.1 Postgres

Inside the project → **Create Service → Database → PostgreSQL**:

- Name: `shop-db`
- Docker image: `postgres:18-alpine`
- Database name: `shop`, user: `shop`, password: keep the generated one
- **External port: leave empty** (the database must not be reachable from the internet)
- **Create**, then **Deploy**.

When the status turns green (**Running**), open the database's **General** tab and copy the **Internal Connection URL** (`postgresql://shop:…@shop-db-xxxx:5432/shop`) to your password manager as `DATABASE_URL`.

### 13.2 Redis

**Create Service → Database → Redis**:

- Name: `shop-redis`, image `redis:8-alpine`, external port empty → **Create**, **Deploy**.
- Copy its **Internal Connection URL** as `REDIS_URL`.

Redis is required: admin sign-in limits, TOTP replay protection and the permission cache live there. Without it the storefront keeps working but nobody can sign in to the admin panel.

### 13.3 The auth secret

On your computer:

- macOS/Linux: `openssl rand -base64 32`
- Windows PowerShell 7: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`

Save the output as `BETTER_AUTH_SECRET`. It signs admin sessions: never change it casually (everyone gets signed out) and never share it.

---

### 13.4 The RCON encryption key

Same recipe as in part 13.3 (a fresh value, not the auth secret):

- macOS/Linux: `openssl rand -base64 32`
- Windows PowerShell 7: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`

Save the output as `RCON_ENCRYPTION_KEY`. It encrypts the RCON password of your Minecraft server in the database. Keep a copy in your password manager: if you lose or change it, enter the RCON password again in the admin panel.

---

## 14. The three applications

Create three applications in project `shop`, one at a time: **Create Service → Application**, then fill the tabs as below. Do `shop-api` first.

### 14.1 Source

Tab **General → Provider → Docker**:

| App          | Docker image                          |
| ------------ | ------------------------------------- |
| `shop-api`   | `ghcr.io/<owner>/<repo>/api:latest`   |
| `shop-web`   | `ghcr.io/<owner>/<repo>/web:latest`   |
| `shop-admin` | `ghcr.io/<owner>/<repo>/admin:latest` |

Registry URL, username and password: **empty** (the images are public). **Save.** The **Build Type** setting (Nixpacks etc.) is ignored for Docker images; leave the default.

### 14.2 Domains

Tab **Domains → Add Domain**. For **every** domain:

- **HTTPS: on**
- **Certificate provider: None** (Traefik serves the Origin certificate from part 8.3 automatically)
- **Path**: as in the table; **Internal path**: leave `/`
- **Strip path: off**

| App          | Host             | Path   | Container port |
| ------------ | ---------------- | ------ | -------------- |
| `shop-api`   | `api.<domain>`   | `/`    | 4000           |
| `shop-api`   | `<domain>`       | `/api` | 4000           |
| `shop-api`   | `admin.<domain>` | `/api` | 4000           |
| `shop-web`   | `<domain>`       | `/`    | 3000           |
| `shop-admin` | `admin.<domain>` | `/`    | 3001           |

Why `/api` twice: the admin panel's sign-in cookie, the Google callback and its data requests must stay on `admin.<domain>`, and the storefront and the deploy check use `<domain>/api`. Traefik prefers the longer rule, so `/api/...` goes to the API and every other path to the website. "Strip path" stays off because the API expects the `/api` prefix.

### 14.3 Environment

Tab **Environment**, one `NAME=value` per line, then **Save**. `NODE_ENV` and `PORT` are built into the images: do not add them.

**`shop-api`:**

```
DATABASE_URL=<Internal Connection URL of shop-db>
REDIS_URL=<Internal Connection URL of shop-redis>
BETTER_AUTH_URL=https://admin.<domain>
BETTER_AUTH_SECRET=<from part 13.3>
RCON_ENCRYPTION_KEY=<from part 13.4>
RESEND_API_KEY=<re_… from part 10>
MAIL_FROM=Shop Admin <no-reply@<domain>>
ADMIN_OWNER_EMAIL=<your email: the first admin>
TRUST_CF_CONNECTING_IP=true
GOOGLE_CLIENT_ID=<from part 11, or omit the line>
GOOGLE_CLIENT_SECRET=<from part 11, or omit the line>
```

Optional: `MC_SERVER_ADDRESS=play.example.org:25565` — the Minecraft server whose online count the site shows.

`TRUST_CF_CONNECTING_IP=true` makes the API read the visitor's real IP from Cloudflare. It is safe only because the firewall (part 6) admits Cloudflare alone.

**`shop-web`** and **`shop-admin`** need the API's **internal** address. Open `shop-api` → **General** → **App Name** (e.g. `shop-api-k3j9x2`). Then:

`shop-web`:

```
API_ORIGIN=http://shop-api-k3j9x2:4000
```

`shop-admin`:

```
API_ORIGIN=http://shop-api-k3j9x2:4000
GOOGLE_SIGN_IN=on
```

Add `GOOGLE_SIGN_IN=on` only if `shop-api` has the Google keys; otherwise the sign-in page shows a button that cannot work. Do not use `https://api.<domain>` here: requests would leave the server and come back through Cloudflare.

---

## 15. First start, demo data and the owner account

Order matters: databases first, then the API, then the two websites.

1. `shop-db` and `shop-redis` show **Running**. If not, open each and click **Deploy**.
2. `shop-api` → **Deploy**. Open **Logs** and wait for:
   - `All migrations have been successfully applied.` (the API creates the database tables itself on every start)
   - `Nest application successfully started`

   If it stops with an error instead, see [Troubleshooting](#19-troubleshooting).

3. **Demo data and the first admin — once only.** `shop-api` → **Terminal** (or "Docker Terminal") → choose the container → shell `sh`, then:

   ```bash
   node dist/seed/main.js
   ```

   Expected: `seed: catalog and roles ready` and `seed: owner invite https://admin.<domain>/…`. Copy the invite link. The invitation is also emailed to `ADMIN_OWNER_EMAIL`.

   **Never run the seed again** on a live shop: it would bring back demo products you deleted later.

   If the Terminal tab does not open: on the server, `docker ps | grep shop-api` shows the container ID; then `docker exec -it <id> sh` and the same command.

4. `shop-web` → **Deploy**, `shop-admin` → **Deploy**.
5. Open the invite link → sign in with the code from your email → set up two-factor authentication: scan the QR code with an authenticator app (Google Authenticator, 1Password, Aegis, Authy) and enter the 6-digit code. **Save the backup codes** in your password manager: they are the only way back in if you lose the phone.

**Check:**

```bash
curl -s https://<domain>/api/health
curl -s https://<domain>/api/health/ready
```

Expected: `{"status":"ok","version":"<40 characters>"}` and `{"status":"ok","database":"up"}`. Then `https://<domain>` shows the shop with demo products and `https://admin.<domain>` the admin panel.

---

## 16. Automatic deploys

Now teach GitHub to update the server after every merge.

1. Copy the **application IDs**. Open each app in Dokploy and look at the browser address bar:

   ```
   https://deploy.<domain>/dashboard/project/…/environment/…/services/application/Ab12Cd34Ef56
                                                                              └── this part ──┘
   ```

   Only the **last** part, after `/application/`. Not the project or environment ID.

2. GitHub → your fork → **Settings → Environments → New environment** → name `production` → **Configure environment**.
3. Under **Environment secrets → Add environment secret**, add eight secrets:

   | Name                      | Value                                           |
   | ------------------------- | ----------------------------------------------- |
   | `DOKPLOY_URL`             | `https://deploy.<domain>` (no slash at the end) |
   | `DOKPLOY_API_KEY`         | the Dokploy key from 9.4                        |
   | `DOKPLOY_API_APP_ID`      | ID of `shop-api`                                |
   | `DOKPLOY_WEB_APP_ID`      | ID of `shop-web`                                |
   | `DOKPLOY_ADMIN_APP_ID`    | ID of `shop-admin`                              |
   | `CF_ACCESS_CLIENT_ID`     | service token Client ID from 9.3                |
   | `CF_ACCESS_CLIENT_SECRET` | service token Client Secret from 9.3            |
   | `PROD_URL`                | `https://<domain>`                              |

4. **Actions** → the last CI run on `main` → **Re-run jobs → Re-run failed jobs**.

**Check:** `deploy` turns green. It triggers the three Dokploy deploys, then waits until `https://<domain>/api/health` reports the new version and the database is up.

From now on: **merge to `main` → about 15 minutes → live.** Nothing to click.

### Protect `main` (recommended)

GitHub → **Settings → Rules → Rulesets → New branch ruleset**: target `main`, enable **Require status checks to pass** with `quality`, `commitlint`, `e2e`, `gitleaks`. Changes then go through pull requests, and a red test cannot reach the live site. Also **Settings → Code security**: turn on **CodeQL**, **Secret scanning** and **Push protection**.

---

## 17. Cloudflare tuning

Cloudflare dashboard → your domain:

1. **Cache images at the edge.** **Caching → Cache Rules → Create rule**:
   - Name `Next images`
   - **Custom filter expression** → **Edit expression** → `(starts_with(http.request.uri.path, "/_next/image"))`
   - Cache eligibility: **Eligible for cache**
   - Edge TTL: **Use cache-control header if present, bypass cache if not**
   - **Deploy**

   Check: request an image twice; the second response has `cf-cache-status: HIT`. Without the rule the first visitor after each deploy waits for the server to resize the hero image.

2. **Speed → Optimization:** **Rocket Loader off** (it breaks the site's scripts). HTTP/3 on.
3. **Security → Bots:** **Bot Fight Mode off.** It blocks GitHub Actions and payment webhooks, and cannot be bypassed on the free plan. The WAF managed rules can stay on.
4. **Do not** add a "Cache Everything" rule: pages depend on the cart cookie, and a cached page would show one visitor's cart to another.
5. **DNSSEC** (signs your DNS answers so nobody can spoof them): **DNS → Settings → Enable DNSSEC** → Cloudflare shows a DS record → add it at your registrar (domain → DNSSEC). HSTS is optional; `.app` and `.dev` domains enforce HTTPS anyway.
6. **`www` redirect (if you added the `www` record):** **Rules → Redirect Rules → Create** → template "Redirect from WWW to root" → 301.

---

## 18. Everyday work

**Release a change:** open a pull request → checks go green → **Merge**. About 15 minutes later the site runs the new version. Database migrations apply themselves when `shop-api` starts.

Write migrations that the **previous** version can live with: while the new API starts, the old one may still serve requests for a few seconds. Add a column in one release; remove the old one in a later release.

**See what runs:** `curl -s https://<domain>/api/health` → `version` is the commit SHA.

**Logs:** Dokploy → application → **Logs**.

**Roll back:** Dokploy → `shop-web` (or another app) → General → image `ghcr.io/<owner>/<repo>/web:sha-<older commit SHA>` → Save → **Deploy**. Every merged commit has such an image. Set it back to `:latest` once the fix is merged.

**Backups:** Dokploy → `shop-db` → **Backups** can upload Postgres dumps to S3-compatible storage (e.g. Cloudflare R2, free up to 10 GB) on a schedule. Set one up before real customers arrive.

---

## 19. Troubleshooting

| Symptom                                                                                     | Cause and fix                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dig NS` still shows the registrar's nameservers                                            | DNS change not propagated yet; wait up to 24 hours. Recheck the nameserver spelling at the registrar.                                                                                                                    |
| Records added at the registrar do nothing                                                   | After part 3.2 only Cloudflare's DNS counts. Add them in Cloudflare.                                                                                                                                                     |
| `ssh` hangs and times out                                                                   | Your home IP changed: update the port 22 rule in `shop-fw` (part 6).                                                                                                                                                     |
| Error **526** (invalid SSL certificate)                                                     | The domain has no HTTPS route on the server, or the Origin certificate is not loaded. For `deploy.<domain>`: part 8.5. For app domains: HTTPS on, certificate provider None (part 14.2); certificate present (part 8.3). |
| `openssl s_client -connect <server-ip>:443 -servername <host>` shows `TRAEFIK DEFAULT CERT` | Same as 526: no HTTPS router for that host.                                                                                                                                                                              |
| Error **521 / 522** (web server down / timed out)                                           | The firewall blocks Cloudflare (check the 80/443 rules) or the container is not running (Dokploy → Logs).                                                                                                                |
| **404** from Traefik on a domain                                                            | The domain is not added to an application, or the path is wrong. Compare with the table in 14.2.                                                                                                                         |
| `shop-api` stops at start: secret / mail error                                              | `BETTER_AUTH_SECRET` missing or shorter than 32 characters, or `RESEND_API_KEY` missing. Fix the environment, Save, Deploy.                                                                                              |
| RCON Save says "RCON is not configured on the server"                                       | `RCON_ENCRYPTION_KEY` is missing on `shop-api`. Add it (part 13.4), Save, Deploy.                                                                                                                                        |
| RCON Save says "public address"                                                             | Use the game host's public IP or name; internal addresses are refused on purpose.                                                                                                                                        |
| `shop-api` log: `The table public.products does not exist`                                  | Migrations did not run (an image older than automatic migrations). In the Terminal: `node_modules/.bin/prisma migrate deploy`.                                                                                           |
| A migration fails at start                                                                  | The container stops and the deploy job fails on the version check. Read the Prisma error in `shop-api` → Logs.                                                                                                           |
| The shop shows "shop unavailable"                                                           | `API_ORIGIN` on `shop-web` is missing or wrong. It must be `http://<App Name of shop-api>:4000`.                                                                                                                         |
| Admin panel: signed in, then thrown back to sign-in                                         | `admin.<domain>` with path `/api` is missing on `shop-api` (part 14.2), so the session cookie never reaches the API.                                                                                                     |
| No sign-in code email                                                                       | Resend domain not verified, or `MAIL_FROM` uses a different domain. Resend → Logs shows each attempt. Also check spam.                                                                                                   |
| Admin sign-in answers 429 / 403 / 500, the shop works                                       | Redis is down or `REDIS_URL` is wrong. Check `shop-redis` is Running.                                                                                                                                                    |
| Google: `redirect_uri_mismatch`                                                             | The redirect URI in Google Cloud must be exactly `https://admin.<domain>/api/auth/callback/google`.                                                                                                                      |
| Google: "Access blocked: app not verified" / "not a test user"                              | Add the account under Test users on the OAuth consent screen (part 11).                                                                                                                                                  |
| Deploy job: `expected 3 Dokploy application IDs, got 0`                                     | The secrets are missing or not in the `production` environment (part 16).                                                                                                                                                |
| Deploy job: `404 Application not found`                                                     | An application ID is wrong: use the last URL segment after `/application/`. The job stops at the first wrong ID (api, then web, then admin).                                                                             |
| Deploy job: `403` or an HTML page instead of JSON                                           | Cloudflare Access blocked the robot: the `CI` policy (Service Auth, service token) is not attached to the `Dokploy` application, or the token secrets are wrong (check in 9.3).                                          |
| Deploy job: `401` / `Unauthorized`                                                          | Wrong `DOKPLOY_API_KEY`.                                                                                                                                                                                                 |
| Deploy job: `prod serves '<old sha>', expected '<new sha>'`                                 | The new `shop-api` did not start in time: see its Logs. Common reason: a failed migration or a bad environment variable.                                                                                                 |
| Dokploy cannot pull the image (`denied`, `unauthorized`)                                    | The GHCR package is private: make it public (part 12), or the image name has uppercase letters.                                                                                                                          |
| Container exits with `exec format error`                                                    | The server is x86, the images are arm64. Create an Arm64 (CAX) server.                                                                                                                                                   |
| A change merged to `main` is not on the site                                                | It did not reach `main` (check the pull request is merged and the branch was pushed), or the CI run is still going or failed (Actions tab). `curl https://<domain>/api/health` shows the running commit.                 |
| The hero image is slow on a first visit                                                     | The Cloudflare cache rule from part 17 is missing.                                                                                                                                                                       |
