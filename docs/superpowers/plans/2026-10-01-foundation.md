# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pnpm/Turborepo monorepo with NestJS `api`, Next.js `web` and `admin` skeletons, shared tooling, Docker images, local Traefik routing, CI, and a live deploy on Hetzner + Cloudflare + Dokploy that serves `/api/health` with the deployed commit SHA.

**Architecture:** Three deployable apps built from one repo. Traefik routes `/api/*` on every host to NestJS before Next.js sees the request, so browsers talk to one origin. CI builds images to GHCR and triggers Dokploy through Cloudflare Access.

**Tech Stack:** Node 24 LTS, pnpm, Turborepo, TypeScript, NestJS 11, Next.js 16, React 19, Tailwind v4, shadcn-style `packages/ui`, Jest, Playwright, Docker, Traefik v3, Postgres 18, Redis 8, GitHub Actions, Dokploy, Cloudflare.

**Spec:** `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md` (sub-project 1 in §15; architecture §3; infra §4; tooling §5).

## Global Constraints

- Node 24 LTS (`.nvmrc` = `24`); pnpm version pinned in root `packageManager`.
- Package scope `@shop/*`: `@shop/api`, `@shop/web`, `@shop/admin`, `@shop/ui`, `@shop/config`, `@shop/e2e`.
- TypeScript `strict: true` + `noUncheckedIndexedAccess: true` everywhere.
- ESLint flat config with `typescript-eslint` strict type-checked rules; Prettier with `@trivago/prettier-plugin-sort-imports` and `prettier-plugin-tailwindcss` (Tailwind plugin listed last).
- Conventional Commits enforced by commitlint (locally via Husky, in CI on PRs).
- Business logic lives only in NestJS. Next.js apps contain **no route handlers**.
- NestJS global prefix `/api`. Ports: `web` 3000, `admin` 3001, `api` 4000.
- Local hosts: `shop.localhost`, `admin.shop.localhost`, `api.shop.localhost`.
- Container images run as the non-root `node` user and define a `HEALTHCHECK`.
- Free tooling only (GHCR public images, GitHub Actions, Cloudflare free, gitleaks, CodeQL default setup).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` when written by an AI agent.
- Library versions: install the current release with `pnpm add <pkg>` unless a major is named here (`next@16`, `@nestjs/*@11`, `tailwindcss@4`). Do not downgrade to satisfy an example; adjust the example.

## Review Focus

1. **`/api/*` on the storefront and admin hosts must reach NestJS, not Next.js.** A missing or low-priority Traefik rule silently serves a Next 404 page. Pinned by the e2e test "api health reachable on every host" (Task 6).
2. **Unknown API paths must return NestJS JSON 404**, not an HTML page, so future API clients get parseable errors. Pinned by "unknown api route returns JSON 404" (Task 2 unit-level, Task 6 through Traefik).
3. **The standalone Next.js image must ship CSS and static assets.** Forgetting to copy `.next/static` renders unstyled pages while every status code is 200. Pinned by the computed-style assertion in "storefront renders styled home page" (Task 6).
4. **Prettier's import-sort plugin must parse NestJS decorators.** Without `decorators-legacy` it crashes on every controller. Pinned by `pnpm format:check` over `apps/api` in Task 2 and CI (Task 7).
5. **Production must actually run the commit that CI built.** A stale `latest` tag or a failed pull looks like a successful deploy. Pinned by the "Verify deployed version" step comparing `/api/health` `version` with `GITHUB_SHA` (Task 8).

---

## File Structure

```
.editorconfig
.nvmrc
.gitignore
.dockerignore
.prettierignore
package.json                 root scripts, packageManager, dev tooling
pnpm-workspace.yaml
turbo.json
prettier.config.mjs
commitlint.config.mjs
.lintstagedrc.mjs
.husky/pre-commit, .husky/commit-msg
CLAUDE.md                    rules for AI agents working in this repo
README.md
compose.yaml                 local infra: traefik, postgres, redis
compose.e2e.yaml             override: built app containers + e2e routes
infra/traefik/dev.yml        routes to apps running on the host
infra/traefik/e2e.yml        routes to app containers
.github/workflows/ci.yml
.github/dependabot.yml
docs/adr/0001-modular-monolith.md
docs/adr/0002-monorepo-tooling.md
docs/adr/0003-deployment-platform.md
docs/runbooks/deploy.md
packages/config/             tsconfig presets + ESLint flat configs
packages/ui/                 cn(), Button, theme tokens
apps/api/                    NestJS: main.ts, configure-app.ts, health module
apps/web/                    Next.js storefront skeleton
apps/admin/                  Next.js admin skeleton
e2e/                         Playwright smoke tests
```

---

### Task 1: Workspace, shared config, tooling, agent docs

**Files:**

- Create: `.editorconfig`, `.nvmrc`, `.gitignore` (modify existing), `.prettierignore`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `prettier.config.mjs`, `commitlint.config.mjs`, `.lintstagedrc.mjs`, `.husky/pre-commit`, `.husky/commit-msg`
- Create: `packages/config/package.json`, `packages/config/tsconfig/base.json`, `packages/config/tsconfig/nest.json`, `packages/config/tsconfig/next.json`, `packages/config/tsconfig/react-library.json`, `packages/config/eslint/base.mjs`, `packages/config/eslint/next.mjs`
- Create: `CLAUDE.md`, `docs/adr/0001-modular-monolith.md`, `docs/adr/0002-monorepo-tooling.md`

**Interfaces:**

- Produces: root scripts `build`, `dev`, `lint`, `typecheck`, `test`, `format`, `format:check`; turbo tasks with the same names plus `test:e2e`; tsconfig presets `@shop/config/tsconfig/{base,nest,next,react-library}.json`; ESLint exports `@shop/config/eslint/base` (named export `base`) and `@shop/config/eslint/next` (named export `next`).

- [ ] **Step 1: Root files**

`.nvmrc`:

```
24
```

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

`.gitignore` (replace contents):

```
node_modules/
.turbo/
dist/
.next/
coverage/
playwright-report/
test-results/
.env
.env.*
!.env.example
.superpowers/
.DS_Store
```

`.prettierignore`:

```
pnpm-lock.yaml
.next/
dist/
coverage/
playwright-report/
test-results/
.superpowers/
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
  - e2e
onlyBuiltDependencies:
  - sharp
```

- [ ] **Step 2: Root package.json and install root tooling**

Run:

```bash
corepack enable
corepack use pnpm@latest
```

This writes `packageManager` into `package.json`. Then set the rest of `package.json`:

```json
{
  "name": "shop",
  "private": true,
  "engines": {"node": ">=24"},
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  }
}
```

Keep the `packageManager` field corepack wrote. Install:

```bash
pnpm add -Dw turbo typescript prettier @trivago/prettier-plugin-sort-imports prettier-plugin-tailwindcss husky lint-staged @commitlint/cli @commitlint/config-conventional
```

`turbo.json`:

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {"dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"]},
    "dev": {"cache": false, "persistent": true},
    "lint": {"dependsOn": ["^build"]},
    "typecheck": {"dependsOn": ["^build"]},
    "test": {"dependsOn": ["^build"], "outputs": ["coverage/**"]},
    "test:e2e": {"cache": false}
  }
}
```

- [ ] **Step 3: Prettier, commitlint, lint-staged, Husky**

`prettier.config.mjs`:

```js
/** @type {import('prettier').Config} */
export default {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  importOrder: ['^node:', '<THIRD_PARTY_MODULES>', '^@shop/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  overrides: [
    {files: 'apps/web/**', options: {tailwindStylesheet: './apps/web/src/app/globals.css'}},
    {files: 'apps/admin/**', options: {tailwindStylesheet: './apps/admin/src/app/globals.css'}},
    {files: 'packages/ui/**', options: {tailwindStylesheet: './apps/web/src/app/globals.css'}}
  ]
}
```

`commitlint.config.mjs`:

```js
export default {extends: ['@commitlint/config-conventional']}
```

`.lintstagedrc.mjs` (ESLint runs per package because each package has its own config; lint-staged passes absolute paths):

```js
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['prettier --write'],
  '{apps,packages,e2e}/**/*.{ts,tsx}': files => {
    const byPkg = new Map()
    for (const f of files) {
      const m = f.match(/((?:apps|packages)\/[^/]+|e2e)\//)
      if (!m) continue
      byPkg.set(m[1], [...(byPkg.get(m[1]) ?? []), f])
    }
    return [...byPkg].map(([pkg, fs]) => `pnpm --dir ${pkg} exec eslint --fix ${fs.join(' ')}`)
  },
  '*.{json,md,yml,yaml,css}': ['prettier --write']
}
```

Husky:

```bash
pnpm exec husky init
printf 'pnpm exec lint-staged\n' > .husky/pre-commit
printf 'pnpm exec commitlint --edit "$1"\n' > .husky/commit-msg
```

- [ ] **Step 4: `@shop/config` package**

`packages/config/package.json`:

```json
{
  "name": "@shop/config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./tsconfig/*": "./tsconfig/*",
    "./eslint/base": "./eslint/base.mjs",
    "./eslint/next": "./eslint/next.mjs"
  }
}
```

Install its dependencies:

```bash
pnpm --filter @shop/config add eslint @eslint/js typescript-eslint eslint-config-prettier eslint-config-next@16
```

`packages/config/tsconfig/base.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "target": "ES2023",
    "lib": ["ES2023"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

`packages/config/tsconfig/nest.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "declaration": false,
    "sourceMap": true,
    "types": ["node", "jest"]
  }
}
```

`packages/config/tsconfig/next.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "allowJs": false,
    "noEmit": true,
    "incremental": true,
    "plugins": [{"name": "next"}]
  }
}
```

`packages/config/tsconfig/react-library.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

`packages/config/eslint/base.mjs`:

```js
import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import {defineConfig} from 'eslint/config'
import tseslint from 'typescript-eslint'

export const base = defineConfig(
  {ignores: ['dist/**', '.next/**', 'coverage/**', 'next-env.d.ts', '*.config.{js,mjs,cjs}']},
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {languageOptions: {parserOptions: {projectService: true}}},
  {
    rules: {
      // NestJS modules are empty classes carrying a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', {allowWithDecorator: true}]
    }
  },
  {
    // Test helpers (supertest, Nest testing) return `any`; keep production code strict.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off'
    }
  },
  prettier
)
```

`packages/config/eslint/next.mjs`:

```js
import nextVitals from 'eslint-config-next/core-web-vitals'
import {defineConfig} from 'eslint/config'

import {base} from './base.mjs'

export const next = defineConfig(base, nextVitals)
```

- [ ] **Step 5: `CLAUDE.md` and ADRs 0001–0002**

`CLAUDE.md`:

```markdown
# CLAUDE.md

Rules for AI agents working in this repository.

## Source of truth

- Design: `docs/superpowers/specs/2026-10-01-minecraft-donation-shop-design.md`
- Plans: `docs/superpowers/plans/` — implement task by task, tick checkboxes.
- Decisions: `docs/adr/` — do not contradict an ADR; propose a new one instead.

## Architecture rules

- Business logic lives only in `apps/api` (NestJS). Next.js apps have no route handlers.
- NestJS global prefix is `/api`. Ports: web 3000, admin 3001, api 4000.
- Shared code goes in `packages/*` and is imported as `@shop/<name>`.
- Money is `amountMinor: Int` + `currency`. Never floats.

## Workflow

- TDD: failing test first, then code.
- Before a commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
- Conventional Commits (`feat(api): …`, `fix(web): …`, `chore: …`).
- Never commit secrets; use `.env.example` for new variables.
- When unsure about a library's current API, check its docs instead of guessing.
```

`docs/adr/0001-modular-monolith.md`:

```markdown
# ADR 0001: Modular monolith instead of microservices

- Status: Accepted
- Date: 2026-10-01

## Context

The shop needs a public storefront, an admin panel, payment webhooks, and a delivery worker. It runs on one small VPS, handles tens of orders per day, and the order write and the delivery outbox write must happen in one database transaction.

## Decision

One NestJS codebase (`apps/api`) with strict modules (`catalog`, `orders`, `payments`, `delivery`, `cases`, `auth`, `admin`, `feed`, `mail`), started as two processes from one image: `api` (HTTP) and `worker` (queues, schedulers). Two Next.js frontends: `web` and `admin`.

## Consequences

- Order + outbox is a single Postgres transaction; no sagas.
- One deploy pipeline and one image for the backend.
- Module boundaries are enforced by code review: modules import only other modules' public services.

## When we would split

If `delivery` needed independent scaling or a separate team, it would become its own service consuming an `order.paid` event through a broker (see the queues ADR). Not before.

## Alternatives rejected

- Separate `api-public` and `api-admin` on a shared database: two deploys with no real independence.
- Microservices with per-service databases and RabbitMQ/Kafka: distributed transactions and extra containers on a 4 GB VPS for no user-visible benefit.
```

`docs/adr/0002-monorepo-tooling.md`:

```markdown
# ADR 0002: pnpm workspaces + Turborepo

- Status: Accepted
- Date: 2026-10-01

## Context

Three apps share schemas, UI components and configs. CI time matters on free runners.

## Decision

pnpm workspaces for dependency management; Turborepo for task orchestration and caching. Shared configs in `@shop/config`, UI in `@shop/ui`.

## Consequences

- `turbo run <task>` only runs affected packages and caches results.
- `turbo prune --docker` produces minimal Docker build contexts per app.

## Alternatives rejected

- Nx: more features than needed, heavier configuration.
- npm/yarn workspaces without an orchestrator: no task caching.
```

- [ ] **Step 6: Verify tooling**

Run:

```bash
pnpm install
pnpm format
pnpm format:check
```

Expected: `format:check` prints "All matched files use Prettier code style!".

Verify commitlint blocks a bad message (a commit needs at least one staged change):

```bash
git add -A
git commit -m "bad message"
```

Expected: FAIL with `subject may not be empty` / `type may not be empty`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: set up monorepo tooling, shared config and agent docs"
```

---

### Task 2: NestJS `api` skeleton with liveness endpoint

**Files:**

- Create: `apps/api/package.json`, `apps/api/nest-cli.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/eslint.config.mjs`
- Create: `apps/api/src/main.ts`, `apps/api/src/configure-app.ts`, `apps/api/src/app.module.ts`, `apps/api/src/health/health.module.ts`, `apps/api/src/health/health.controller.ts`
- Test: `apps/api/test/health.e2e-spec.ts`

**Interfaces:**

- Consumes: `@shop/config/tsconfig/nest.json`, `@shop/config/eslint/base`.
- Produces: `GET /api/health` → `200 { "status": "ok", "version": string }` where `version = process.env.APP_VERSION ?? "dev"`; `configureApp(app: INestApplication): void` (sets `/api` prefix and shutdown hooks) used by both `main.ts` and tests; server listens on `PORT` (default 4000) on `0.0.0.0`; built entry `dist/main.js`.

- [ ] **Step 1: Package setup**

`apps/api/package.json`:

```json
{
  "name": "@shop/api",
  "version": "0.0.0",
  "private": true,
  "files": ["dist"],
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "jest": {
    "rootDir": ".",
    "roots": ["<rootDir>/src", "<rootDir>/test"],
    "testRegex": ".*\\.(spec|e2e-spec)\\.ts$",
    "transform": {"^.+\\.ts$": "ts-jest"},
    "moduleFileExtensions": ["ts", "js", "json"],
    "testEnvironment": "node"
  }
}
```

Install:

```bash
pnpm --filter @shop/api add @nestjs/common@11 @nestjs/core@11 @nestjs/platform-express@11 reflect-metadata rxjs
pnpm --filter @shop/api add -D @nestjs/cli@11 @nestjs/testing@11 @shop/config@workspace:* typescript jest ts-jest @types/jest supertest @types/supertest @types/node
```

`apps/api/nest-cli.json`:

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {"tsConfigPath": "tsconfig.build.json", "deleteOutDir": true}
}
```

`apps/api/tsconfig.json`:

```json
{
  "extends": "@shop/config/tsconfig/nest.json",
  "compilerOptions": {"outDir": "dist"},
  "include": ["src", "test"]
}
```

`apps/api/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {"rootDir": "src"},
  "include": ["src"],
  "exclude": ["test", "**/*.spec.ts"]
}
```

`apps/api/eslint.config.mjs`:

```js
import {base} from '@shop/config/eslint/base'

export default base
```

- [ ] **Step 2: Write the failing test**

`apps/api/test/health.e2e-spec.ts`:

```ts
import {INestApplication} from '@nestjs/common'
import {Test} from '@nestjs/testing'
import request from 'supertest'

import {AppModule} from '../src/app.module'
import {configureApp} from '../src/configure-app'

describe('health', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.APP_VERSION = 'test-sha'
    const moduleRef = await Test.createTestingModule({imports: [AppModule]}).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /api/health returns status and deployed version', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200)
    expect(res.body).toEqual({status: 'ok', version: 'test-sha'})
  })

  it('routes without the /api prefix are not served', async () => {
    await request(app.getHttpServer()).get('/health').expect(404)
  })

  it('unknown api route returns JSON 404', async () => {
    const res = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404)
    expect(res.type).toBe('application/json')
    expect(res.body).toMatchObject({statusCode: 404})
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @shop/api test`
Expected: FAIL with `Cannot find module '../src/app.module'`.

- [ ] **Step 4: Implement**

`apps/api/src/configure-app.ts`:

```ts
import {INestApplication} from '@nestjs/common'

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api')
  app.enableShutdownHooks()
}
```

`apps/api/src/health/health.controller.ts`:

```ts
import {Controller, Get} from '@nestjs/common'

export interface HealthResponse {
  status: 'ok'
  version: string
}

@Controller('health')
export class HealthController {
  @Get()
  get(): HealthResponse {
    return {status: 'ok', version: process.env.APP_VERSION ?? 'dev'}
  }
}
```

`apps/api/src/health/health.module.ts`:

```ts
import {Module} from '@nestjs/common'

import {HealthController} from './health.controller'

@Module({controllers: [HealthController]})
export class HealthModule {}
```

`apps/api/src/app.module.ts`:

```ts
import {Module} from '@nestjs/common'

import {HealthModule} from './health/health.module'

@Module({imports: [HealthModule]})
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import {NestFactory} from '@nestjs/core'
import 'reflect-metadata'

import {AppModule} from './app.module'
import {configureApp} from './configure-app'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  configureApp(app)
  await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0')
}

void bootstrap()
```

- [ ] **Step 5: Run tests, lint, typecheck, format, build**

Run:

```bash
pnpm --filter @shop/api test
pnpm --filter @shop/api lint
pnpm --filter @shop/api typecheck
pnpm prettier --check apps/api
pnpm --filter @shop/api build && ls apps/api/dist/main.js
```

Expected: 3 tests PASS; lint and typecheck exit 0; Prettier reports no issues on decorator files; `apps/api/dist/main.js` exists.

- [ ] **Step 6: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add NestJS skeleton with /api/health"
```

---

### Task 3: `@shop/ui` package and `web` storefront skeleton

**Files:**

- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/eslint.config.mjs`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/button.tsx`, `packages/ui/src/theme.css`
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/tsconfig.json`, `apps/web/eslint.config.mjs`, `apps/web/jest.config.mjs`, `apps/web/jest.setup.ts`, `apps/web/public/.gitkeep`
- Create: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
- Test: `apps/web/src/app/page.test.tsx`

**Interfaces:**

- Consumes: `@shop/config/tsconfig/{next,react-library}.json`, `@shop/config/eslint/{base,next}`.
- Produces: `@shop/ui/button` exports `Button` and `buttonVariants`; `@shop/ui/lib/utils` exports `cn(...inputs: ClassValue[]): string`; `@shop/ui/theme.css` defines tokens `--color-primary`, `--color-primary-foreground`, `--color-background`, `--color-foreground`, `--color-input`, `--color-accent`. `web` runs on port 3000, builds to `.next/standalone/apps/web/server.js`.

- [ ] **Step 1: `@shop/ui`**

`packages/ui/package.json`:

```json
{
  "name": "@shop/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./button": "./src/button.tsx",
    "./lib/utils": "./src/lib/utils.ts",
    "./theme.css": "./src/theme.css"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

Install:

```bash
pnpm --filter @shop/ui add class-variance-authority clsx tailwind-merge @radix-ui/react-slot
pnpm --filter @shop/ui add -D @shop/config@workspace:* typescript @types/react react
```

Also declare the peer: add `"peerDependencies": { "react": "^19" }` to `packages/ui/package.json`.

`packages/ui/tsconfig.json`:

```json
{"extends": "@shop/config/tsconfig/react-library.json", "include": ["src"]}
```

`packages/ui/eslint.config.mjs`:

```js
import {base} from '@shop/config/eslint/base'

export default base
```

`packages/ui/src/lib/utils.ts`:

```ts
import {type ClassValue, clsx} from 'clsx'
import {twMerge} from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

`packages/ui/src/button.tsx`:

```tsx
import {Slot} from '@radix-ui/react-slot'
import {type VariantProps, cva} from 'class-variance-authority'
import type * as React from 'react'

import {cn} from './lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border-input bg-background hover:bg-accent border'
      },
      size: {
        default: 'h-9 px-4 py-2',
        lg: 'h-10 px-6'
      }
    },
    defaultVariants: {variant: 'default', size: 'default'}
  }
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {asChild?: boolean}

function Button({className, variant, size, asChild = false, ...props}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({variant, size, className}))}
      {...props}
    />
  )
}

export {Button, buttonVariants}
```

`packages/ui/src/theme.css` (temporary neutral tokens; the visual-design track replaces the values, not the names):

```css
:root {
  --primary: oklch(0.62 0.19 145);
  --primary-foreground: oklch(0.98 0 0);
  --background: oklch(0.15 0.01 260);
  --foreground: oklch(0.96 0 0);
  --input: oklch(0.3 0.01 260);
  --accent: oklch(0.25 0.01 260);
}

@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-input: var(--input);
  --color-accent: var(--accent);
}
```

- [ ] **Step 2: `web` package setup**

`apps/web/package.json`:

```json
{
  "name": "@shop/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  }
}
```

Install:

```bash
pnpm --filter @shop/web add next@16 react react-dom @shop/ui@workspace:*
pnpm --filter @shop/web add -D @shop/config@workspace:* typescript @types/react @types/react-dom @types/node tailwindcss@4 @tailwindcss/postcss jest jest-environment-jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @types/jest
```

`apps/web/next.config.ts`:

```ts
import path from 'node:path'

import type {NextConfig} from 'next'

const repoRoot = path.resolve(process.cwd(), '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  turbopack: {root: repoRoot},
  transpilePackages: ['@shop/ui']
}

export default nextConfig
```

`apps/web/postcss.config.mjs`:

```js
export default {plugins: {'@tailwindcss/postcss': {}}}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "@shop/config/tsconfig/next.json",
  "compilerOptions": {"types": ["node", "jest", "@testing-library/jest-dom"]},
  "include": ["next-env.d.ts", "next.config.ts", "src", ".next/types/**/*.ts", "jest.setup.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/eslint.config.mjs`:

```js
import {next} from '@shop/config/eslint/next'

export default next
```

`apps/web/jest.config.mjs`:

```js
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({dir: './'})

export default createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
})
```

`apps/web/jest.setup.ts`:

```ts
import '@testing-library/jest-dom'
```

Create an empty `apps/web/public/.gitkeep` (the Docker image copies `public/`).

- [ ] **Step 3: Write the failing test**

`apps/web/src/app/page.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react'

import HomePage from './page'

describe('HomePage', () => {
  it('renders the shop heading and the shared ui button', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', {level: 1, name: 'Minecraft Shop'})).toBeInTheDocument()
    const button = screen.getByRole('button', {name: 'Browse servers'})
    expect(button).toHaveAttribute('data-slot', 'button')
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter @shop/web test`
Expected: FAIL with `Cannot find module './page'`.

- [ ] **Step 5: Implement**

`apps/web/src/app/globals.css`:

```css
@import 'tailwindcss';
@import '@shop/ui/theme.css';

@source '../../../../packages/ui/src';

body {
  background: var(--background);
  color: var(--foreground);
}
```

`apps/web/src/app/layout.tsx`:

```tsx
import type {Metadata} from 'next'
import type {ReactNode} from 'react'

import './globals.css'

export const metadata: Metadata = {
  title: 'Minecraft Shop',
  description: 'Ranks, coins and cases for Minecraft servers.'
}

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`apps/web/src/app/page.tsx`:

```tsx
import {Button} from '@shop/ui/button'

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Minecraft Shop</h1>
      <Button>Browse servers</Button>
    </main>
  )
}
```

- [ ] **Step 6: Run tests, lint, typecheck, build**

Run:

```bash
pnpm --filter @shop/web test
pnpm --filter @shop/web lint
pnpm --filter @shop/ui lint
pnpm --filter @shop/web typecheck
pnpm --filter @shop/ui typecheck
pnpm --filter @shop/web build && ls apps/web/.next/standalone/apps/web/server.js
```

Expected: test PASS; lint/typecheck exit 0; `server.js` exists at that path.

- [ ] **Step 7: Commit**

```bash
git add packages/ui apps/web pnpm-lock.yaml
git commit -m "feat(web): add Next.js storefront skeleton and shared ui package"
```

---

### Task 4: `admin` skeleton

**Files:**

- Create: `apps/admin/package.json`, `apps/admin/next.config.ts`, `apps/admin/postcss.config.mjs`, `apps/admin/tsconfig.json`, `apps/admin/eslint.config.mjs`, `apps/admin/jest.config.mjs`, `apps/admin/jest.setup.ts`, `apps/admin/public/.gitkeep`
- Create: `apps/admin/src/app/globals.css`, `apps/admin/src/app/layout.tsx`, `apps/admin/src/app/page.tsx`
- Test: `apps/admin/src/app/page.test.tsx`, `apps/admin/src/app/layout.test.ts`

**Interfaces:**

- Consumes: `@shop/ui/button`, `@shop/ui/theme.css`, config presets from Task 1.
- Produces: `admin` on port 3001; root `metadata.robots = { index: false, follow: false }`; builds to `.next/standalone/apps/admin/server.js`.

- [ ] **Step 1: Package setup**

`apps/admin/package.json`:

```json
{
  "name": "@shop/admin",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  }
}
```

Install:

```bash
pnpm --filter @shop/admin add next@16 react react-dom @shop/ui@workspace:*
pnpm --filter @shop/admin add -D @shop/config@workspace:* typescript @types/react @types/react-dom @types/node tailwindcss@4 @tailwindcss/postcss jest jest-environment-jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom @types/jest
```

`apps/admin/next.config.ts`:

```ts
import path from 'node:path'

import type {NextConfig} from 'next'

const repoRoot = path.resolve(process.cwd(), '../..')

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: repoRoot,
  turbopack: {root: repoRoot},
  transpilePackages: ['@shop/ui']
}

export default nextConfig
```

`apps/admin/postcss.config.mjs`:

```js
export default {plugins: {'@tailwindcss/postcss': {}}}
```

`apps/admin/tsconfig.json`:

```json
{
  "extends": "@shop/config/tsconfig/next.json",
  "compilerOptions": {"types": ["node", "jest", "@testing-library/jest-dom"]},
  "include": ["next-env.d.ts", "next.config.ts", "src", ".next/types/**/*.ts", "jest.setup.ts"],
  "exclude": ["node_modules"]
}
```

`apps/admin/eslint.config.mjs`:

```js
import {next} from '@shop/config/eslint/next'

export default next
```

`apps/admin/jest.config.mjs`:

```js
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({dir: './'})

export default createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
})
```

`apps/admin/jest.setup.ts`:

```ts
import '@testing-library/jest-dom'
```

Create an empty `apps/admin/public/.gitkeep`.

- [ ] **Step 2: Write the failing tests**

`apps/admin/src/app/page.test.tsx`:

```tsx
import {render, screen} from '@testing-library/react'

import AdminHomePage from './page'

describe('AdminHomePage', () => {
  it('renders the admin heading and sign-in button', () => {
    render(<AdminHomePage />)
    expect(screen.getByRole('heading', {level: 1, name: 'Shop Admin'})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Sign in'})).toBeInTheDocument()
  })
})
```

`apps/admin/src/app/layout.test.ts`:

```ts
import {metadata} from './layout'

describe('admin layout metadata', () => {
  it('keeps the whole admin out of search engines', () => {
    expect(metadata.robots).toEqual({index: false, follow: false})
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @shop/admin test`
Expected: FAIL with `Cannot find module './page'` and `Cannot find module './layout'`.

- [ ] **Step 4: Implement**

`apps/admin/src/app/globals.css`:

```css
@import 'tailwindcss';
@import '@shop/ui/theme.css';

@source '../../../../packages/ui/src';

body {
  background: var(--background);
  color: var(--foreground);
}
```

`apps/admin/src/app/layout.tsx`:

```tsx
import type {Metadata} from 'next'
import type {ReactNode} from 'react'

import './globals.css'

export const metadata: Metadata = {
  title: 'Shop Admin',
  robots: {index: false, follow: false}
}

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

`apps/admin/src/app/page.tsx`:

```tsx
import {Button} from '@shop/ui/button'

export default function AdminHomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">Shop Admin</h1>
      <Button variant="outline">Sign in</Button>
    </main>
  )
}
```

- [ ] **Step 5: Run tests, lint, typecheck, build**

Run:

```bash
pnpm --filter @shop/admin test
pnpm --filter @shop/admin lint
pnpm --filter @shop/admin typecheck
pnpm --filter @shop/admin build && ls apps/admin/.next/standalone/apps/admin/server.js
```

Expected: 2 tests PASS; lint/typecheck exit 0; `server.js` exists.

- [ ] **Step 6: Commit**

```bash
git add apps/admin pnpm-lock.yaml
git commit -m "feat(admin): add Next.js admin skeleton"
```

---

### Task 5: Production Docker images

**Files:**

- Create: `.dockerignore`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, `apps/admin/Dockerfile`

**Interfaces:**

- Consumes: build scripts from Tasks 2–4.
- Produces: images that listen on 4000 (api), 3000 (web), 3001 (admin); accept build arg `APP_VERSION` exposed as env `APP_VERSION`; run as user `node`; define `HEALTHCHECK`. Build context is always the repo root: `docker build -f apps/<app>/Dockerfile .`.

- [ ] **Step 1: `.dockerignore`**

```
**/node_modules
**/.next
**/dist
**/.turbo
**/coverage
.git
.superpowers
playwright-report
test-results
```

- [ ] **Step 2: `apps/api/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @shop/api --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@shop/api
RUN pnpm --filter @shop/api deploy --prod --legacy /out

FROM node:24-alpine AS runner
ENV NODE_ENV=production PORT=4000
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=builder --chown=node:node /out/ .
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3: `apps/web/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @shop/web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@shop/web

FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 4: `apps/admin/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2 prune @shop/admin --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=@shop/admin

FROM node:24-alpine AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=node:node /repo/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3001/ >/dev/null || exit 1
CMD ["node", "apps/admin/server.js"]
```

- [ ] **Step 5: Build and verify each image**

Run:

```bash
docker build -f apps/api/Dockerfile --build-arg APP_VERSION=local-test -t shop-api .
docker run -d --rm --name shop-api-test -p 4000:4000 shop-api
sleep 3
curl -s http://localhost:4000/api/health
docker exec shop-api-test whoami
docker stop shop-api-test
```

Expected: `{"status":"ok","version":"local-test"}` and `node`.

```bash
docker build -f apps/web/Dockerfile -t shop-web .
docker run -d --rm --name shop-web-test -p 3000:3000 shop-web
sleep 3
curl -s http://localhost:3000/ | grep -o 'Minecraft Shop' | head -1
curl -s http://localhost:3000/ | grep -o '/_next/static/[^"]*\.css' | head -1 | xargs -I{} curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000{}
docker stop shop-web-test
```

Expected: `Minecraft Shop`, then `200` for the CSS file.

```bash
docker build -f apps/admin/Dockerfile -t shop-admin .
docker run -d --rm --name shop-admin-test -p 3001:3001 shop-admin
sleep 3
curl -s http://localhost:3001/ | grep -o 'noindex' | head -1
docker stop shop-admin-test
```

Expected: `noindex`.

If `pnpm deploy --legacy` is rejected by the installed pnpm version, replace that line with `pnpm --filter @shop/api deploy --prod /out` and add `inject-workspace-packages=true` to a root `.npmrc`; rebuild and re-run the api check.

- [ ] **Step 6: Commit**

```bash
git add .dockerignore apps/api/Dockerfile apps/web/Dockerfile apps/admin/Dockerfile
git commit -m "build: add production Docker images for api, web and admin"
```

---

### Task 6: Local stack with Traefik routing + Playwright smoke tests

**Files:**

- Create: `compose.yaml`, `compose.e2e.yaml`, `infra/traefik/dev.yml`, `infra/traefik/e2e.yml`
- Create: `e2e/package.json`, `e2e/tsconfig.json`, `e2e/eslint.config.mjs`, `e2e/playwright.config.ts`
- Test: `e2e/tests/smoke.spec.ts`
- Create: `README.md`

**Interfaces:**

- Consumes: images from Task 5; dev servers from Tasks 2–4.
- Produces: `docker compose up -d` (infra + Traefik routing to apps on the host) and `docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait` (everything in containers). Routing contract used by prod (Task 8): `api.<host>` → api; `<host>/api/*` and `admin.<host>/api/*` → api; `admin.<host>` → admin; `<host>` → web. `pnpm test:e2e` runs smoke tests against `WEB_URL`, `ADMIN_URL`, `API_URL` (defaults: `http://shop.localhost`, `http://admin.shop.localhost`, `http://api.shop.localhost`).

- [ ] **Step 1: Traefik routes**

`infra/traefik/dev.yml`:

```yaml
http:
  routers:
    api:
      rule: 'Host(`api.shop.localhost`) || ((Host(`shop.localhost`) || Host(`admin.shop.localhost`)) && PathPrefix(`/api/`))'
      service: api
      priority: 100
      entryPoints: [web]
    admin:
      rule: 'Host(`admin.shop.localhost`)'
      service: admin
      priority: 10
      entryPoints: [web]
    web:
      rule: 'Host(`shop.localhost`)'
      service: web
      priority: 10
      entryPoints: [web]
  services:
    api:
      loadBalancer:
        servers: [{url: 'http://host.docker.internal:4000'}]
    admin:
      loadBalancer:
        servers: [{url: 'http://host.docker.internal:3001'}]
    web:
      loadBalancer:
        servers: [{url: 'http://host.docker.internal:3000'}]
```

`infra/traefik/e2e.yml` — identical routers, services point at containers:

```yaml
http:
  routers:
    api:
      rule: 'Host(`api.shop.localhost`) || ((Host(`shop.localhost`) || Host(`admin.shop.localhost`)) && PathPrefix(`/api/`))'
      service: api
      priority: 100
      entryPoints: [web]
    admin:
      rule: 'Host(`admin.shop.localhost`)'
      service: admin
      priority: 10
      entryPoints: [web]
    web:
      rule: 'Host(`shop.localhost`)'
      service: web
      priority: 10
      entryPoints: [web]
  services:
    api:
      loadBalancer:
        servers: [{url: 'http://api:4000'}]
    admin:
      loadBalancer:
        servers: [{url: 'http://admin:3001'}]
    web:
      loadBalancer:
        servers: [{url: 'http://web:3000'}]
```

- [ ] **Step 2: Compose files**

`compose.yaml`:

```yaml
name: shop

services:
  traefik:
    image: traefik:v3
    command:
      - --entrypoints.web.address=:80
      - --providers.file.filename=/etc/traefik/dynamic.yml
      - --providers.file.watch=true
      - --log.level=INFO
    ports: ['80:80']
    volumes:
      - ./infra/traefik/dev.yml:/etc/traefik/dynamic.yml:ro
    extra_hosts:
      - 'host.docker.internal:host-gateway'

  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: shop
      POSTGRES_PASSWORD: shop
      POSTGRES_DB: shop
    ports: ['5432:5432']
    volumes:
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U shop']
      interval: 5s
      retries: 10

  redis:
    image: redis:8-alpine
    command:
      [
        'redis-server',
        '--appendonly',
        'yes',
        '--maxmemory',
        '256mb',
        '--maxmemory-policy',
        'noeviction'
      ]
    ports: ['6379:6379']
    volumes:
      - redisdata:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      retries: 10

volumes:
  pgdata:
  redisdata:
```

`compose.e2e.yaml`:

```yaml
services:
  traefik:
    volumes: !override
      - ./infra/traefik/e2e.yml:/etc/traefik/dynamic.yml:ro

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      args: {APP_VERSION: e2e}

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile

  admin:
    build:
      context: .
      dockerfile: apps/admin/Dockerfile
```

- [ ] **Step 3: Playwright package**

`e2e/package.json`:

```json
{
  "name": "@shop/e2e",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

The script is named `test:e2e`, so root `pnpm test` (turbo `test`) skips it and root `pnpm test:e2e` (turbo `test:e2e`, uncached) runs it.

Install:

```bash
pnpm --filter @shop/e2e add -D @playwright/test @shop/config@workspace:* typescript @types/node
pnpm --filter @shop/e2e exec playwright install chromium
```

`e2e/tsconfig.json`:

```json
{
  "extends": "@shop/config/tsconfig/base.json",
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["tests", "playwright.config.ts"]
}
```

`e2e/eslint.config.mjs`:

```js
import {base} from '@shop/config/eslint/base'

export default base
```

`e2e/playwright.config.ts`:

```ts
import {defineConfig, devices} from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', {open: 'never'}], ['github']] : 'list',
  use: {trace: 'retain-on-failure', video: 'retain-on-failure'},
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}]
})
```

- [ ] **Step 4: Write the smoke tests**

`e2e/tests/smoke.spec.ts`:

```ts
import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const ADMIN = process.env.ADMIN_URL ?? 'http://admin.shop.localhost'
const API = process.env.API_URL ?? 'http://api.shop.localhost'

test('storefront renders styled home page', async ({page}) => {
  await page.goto(WEB)
  const heading = page.getByRole('heading', {level: 1, name: 'Minecraft Shop'})
  await expect(heading).toBeVisible()
  await expect(page.getByRole('button', {name: 'Browse servers'})).toBeVisible()
  // `text-4xl` = 36px. Browser default h1 is 32px, so this fails if Tailwind CSS did not load.
  expect(await heading.evaluate(el => getComputedStyle(el).fontSize)).toBe('36px')
})

test('admin renders and is noindex', async ({page}) => {
  await page.goto(ADMIN)
  await expect(page.getByRole('heading', {level: 1, name: 'Shop Admin'})).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('api health reachable on every host', async ({request}) => {
  for (const url of [`${WEB}/api/health`, `${ADMIN}/api/health`, `${API}/api/health`]) {
    const res = await request.get(url)
    expect(res.status(), url).toBe(200)
    expect(await res.json(), url).toMatchObject({status: 'ok'})
  }
})

test('unknown api route returns JSON 404 from api, not a Next page', async ({request}) => {
  const res = await request.get(`${WEB}/api/does-not-exist`)
  expect(res.status()).toBe(404)
  expect(res.headers()['content-type']).toContain('application/json')
})
```

- [ ] **Step 5: Run against the containerised stack**

Node resolves `*.localhost` through the OS resolver, so add hosts entries once:

```bash
echo "127.0.0.1 shop.localhost admin.shop.localhost api.shop.localhost" | sudo tee -a /etc/hosts
```

Run:

```bash
docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait
pnpm test:e2e
```

Expected: 4 tests PASS.

Check that the test catches a broken route: in `infra/traefik/e2e.yml` change the api router's `PathPrefix(`/api/`)` to `PathPrefix(`/nope/`)`, wait 2 s (Traefik watches the file), re-run `pnpm test:e2e`.
Expected: "api health reachable on every host" and "unknown api route…" FAIL. Revert the change and re-run: PASS.

Then:

```bash
docker compose -f compose.yaml -f compose.e2e.yaml down
```

- [ ] **Step 6: Verify dev mode routing**

Run:

```bash
docker compose up -d
pnpm dev
```

In a second terminal:

```bash
curl -s http://shop.localhost/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://shop.localhost/
curl -s -o /dev/null -w '%{http_code}\n' http://admin.shop.localhost/
```

Expected: `{"status":"ok","version":"dev"}`, `200`, `200`. Stop `pnpm dev` and run `docker compose down`.

- [ ] **Step 7: README**

`README.md`:

````markdown
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
echo "127.0.0.1 shop.localhost admin.shop.localhost api.shop.localhost" | sudo tee -a /etc/hosts
docker compose up -d
pnpm dev
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
````

- [ ] **Step 8: Commit**

```bash
git add compose.yaml compose.e2e.yaml infra e2e README.md pnpm-lock.yaml
git commit -m "test(e2e): add local Traefik routing and Playwright smoke tests"
```

---

### Task 7: CI workflow, commit checks, dependency and security scanning

**Files:**

- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`

**Interfaces:**

- Consumes: root scripts (Task 1), compose e2e stack and `@shop/e2e` (Task 6).
- Produces: jobs `quality`, `commitlint`, `e2e`, `gitleaks` in workflow `CI`; Task 8 adds `publish` and `deploy` jobs with `needs: [quality, e2e]`.

- [ ] **Step 1: `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build

  commitlint:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @shop/e2e exec playwright install --with-deps chromium
      - run: echo "127.0.0.1 shop.localhost admin.shop.localhost api.shop.localhost" | sudo tee -a /etc/hosts
      - run: docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait
      - run: pnpm test:e2e
        env:
          CI: 'true'
      - if: failure()
        run: docker compose -f compose.yaml -f compose.e2e.yaml logs --no-color > compose.log
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-artifacts
          path: |
            e2e/playwright-report
            e2e/test-results
            compose.log

  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule: {interval: weekly}
    groups:
      minor-and-patch:
        update-types: [minor, patch]
  - package-ecosystem: github-actions
    directory: /
    schedule: {interval: weekly}
  - package-ecosystem: docker
    directories: [/apps/api, /apps/web, /apps/admin]
    schedule: {interval: weekly}
```

- [ ] **Step 3: Push and verify on GitHub**

Create the public GitHub repository (name chosen by the owner), then:

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

In repository settings:

1. **Code security → CodeQL analysis → Default setup → Enable** (languages: JavaScript/TypeScript, Actions).
2. **Code security → Secret protection and push protection → Enable.**
3. **Branches → Add rule for `main`:** require status checks `quality`, `e2e`, `gitleaks`; require PRs before merging.

Expected: the `CI` run on `main` shows `quality`, `e2e`, `gitleaks` green; the CodeQL run appears under the Security tab.

- [ ] **Step 4: Verify a failing check blocks a PR**

```bash
git checkout -b chore/ci-check
printf 'export const x = 1\n' > packages/ui/src/unformatted.ts
git add packages/ui/src/unformatted.ts
git commit --no-verify -m "chore: ci check"
git push -u origin chore/ci-check
```

Open a PR. Expected: `quality` FAILS at `pnpm format:check` because the file lacks the semicolon Prettier requires. Close the PR and delete the branch:

```bash
git checkout main
git push origin --delete chore/ci-check
git branch -D chore/ci-check
```

- [ ] **Step 5: Commit**

```bash
git add .github
git commit -m "ci: add quality, commitlint, e2e and gitleaks jobs with dependabot"
git push
```

---

### Task 8: Production deploy (Hetzner + Cloudflare + Dokploy + GHCR)

**Files:**

- Modify: `.github/workflows/ci.yml` (add `publish` and `deploy` jobs)
- Create: `docs/runbooks/deploy.md`, `docs/adr/0003-deployment-platform.md`

**Interfaces:**

- Consumes: Dockerfiles (Task 5), routing contract (Task 6), CI jobs (Task 7).
- Produces: images `ghcr.io/<owner>/<repo>/{api,web,admin}:{latest,sha-<sha>}`; Dokploy applications `shop-api`, `shop-web`, `shop-admin`; GitHub secrets `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_API_APP_ID`, `DOKPLOY_WEB_APP_ID`, `DOKPLOY_ADMIN_APP_ID`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `PROD_URL`; `https://<domain>/api/health` returning the deployed commit SHA.

- [ ] **Step 1: Write the runbook**

`docs/runbooks/deploy.md`:

````markdown
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
````

- [ ] **Step 2: Do the setup**

Follow `docs/runbooks/deploy.md` sections 1–6. The Dokploy apps will fail to pull until Step 4 publishes images — that is expected.

Before adding the deploy job, confirm the Dokploy deploy endpoint and header against the Dokploy API docs (Swagger at `https://deploy.<domain>/swagger` or docs.dokploy.com). The workflow below assumes `POST /api/application.deploy` with body `{"applicationId": "..."}` and header `x-api-key`. If the docs differ, change only the `curl` line.

- [ ] **Step 3: Add `publish` and `deploy` jobs to `.github/workflows/ci.yml`**

Append under `jobs:`:

```yaml
publish:
  needs: [quality, e2e]
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  permissions:
    contents: read
    packages: write
  strategy:
    matrix:
      app: [api, web, admin]
  steps:
    - uses: actions/checkout@v5
    - uses: docker/setup-buildx-action@v3
    - uses: docker/login-action@v3
      with:
        registry: ghcr.io
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    - id: image
      run: echo "name=ghcr.io/${GITHUB_REPOSITORY,,}/${{ matrix.app }}" >> "$GITHUB_OUTPUT"
    - uses: docker/build-push-action@v6
      with:
        context: .
        file: apps/${{ matrix.app }}/Dockerfile
        push: true
        build-args: APP_VERSION=${{ github.sha }}
        tags: |
          ${{ steps.image.outputs.name }}:latest
          ${{ steps.image.outputs.name }}:sha-${{ github.sha }}
        cache-from: type=gha,scope=${{ matrix.app }}
        cache-to: type=gha,mode=max,scope=${{ matrix.app }}

deploy:
  needs: publish
  runs-on: ubuntu-latest
  environment: production
  steps:
    - name: Trigger Dokploy deploys
      env:
        DOKPLOY_URL: ${{ secrets.DOKPLOY_URL }}
        DOKPLOY_API_KEY: ${{ secrets.DOKPLOY_API_KEY }}
        CF_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}
        CF_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}
        APP_IDS: ${{ secrets.DOKPLOY_API_APP_ID }} ${{ secrets.DOKPLOY_WEB_APP_ID }} ${{ secrets.DOKPLOY_ADMIN_APP_ID }}
      run: |
        for id in $APP_IDS; do
          curl --fail-with-body -sS -X POST "$DOKPLOY_URL/api/application.deploy" \
            -H "x-api-key: $DOKPLOY_API_KEY" \
            -H "CF-Access-Client-Id: $CF_ID" \
            -H "CF-Access-Client-Secret: $CF_SECRET" \
            -H 'Content-Type: application/json' \
            -d "{\"applicationId\":\"$id\"}"
        done
    - name: Verify deployed version
      env:
        PROD_URL: ${{ secrets.PROD_URL }}
      run: |
        v=""
        for i in $(seq 1 30); do
          v=$(curl -fsS "$PROD_URL/api/health" | jq -r .version || true)
          if [ "$v" = "$GITHUB_SHA" ]; then echo "prod runs $v"; exit 0; fi
          sleep 10
        done
        echo "prod serves '$v', expected '$GITHUB_SHA'"
        exit 1
```

- [ ] **Step 4: ADR 0003**

`docs/adr/0003-deployment-platform.md`:

```markdown
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

## Alternatives rejected

- Vercel/Render/Fly free tiers: split hosting for web vs api vs databases, sleep on idle, limits on background workers.
- Coolify: comparable; Dokploy chosen for lighter footprint and simple API.
- Dokploy building from the Git repo on the VPS: Next.js builds need more RAM than the VPS can spare.
```

- [ ] **Step 5: Commit, push, verify**

```bash
git add .github/workflows/ci.yml docs/runbooks/deploy.md docs/adr/0003-deployment-platform.md
git commit -m "ci: publish images to GHCR and deploy via Dokploy"
git push
```

Expected: `publish` pushes 3 images; make the packages public (runbook §5.4) if the first `deploy` fails on pull, then re-run the workflow. Final: `deploy` job green with `prod runs <sha>`, and every command in runbook §7 gives the expected output.

---

## Definition of done (sub-project 1)

- `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` passes locally and in CI.
- `docker compose -f compose.yaml -f compose.e2e.yaml up -d --build --wait && pnpm test:e2e` passes locally and in CI.
- A bad commit message is rejected locally and in PR CI.
- `https://<domain>`, `https://admin.<domain>`, `https://<domain>/api/health` work through Cloudflare; the origin IP refuses direct HTTP.
- Merging to `main` redeploys and the deploy job confirms the new SHA.
- `CLAUDE.md`, ADRs 0001–0003, README and deploy runbook are committed.
