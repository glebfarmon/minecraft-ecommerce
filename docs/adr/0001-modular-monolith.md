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
