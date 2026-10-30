# ADR 0011: Delivery queue on BullMQ with a Postgres outbox

- Status: Accepted
- Date: 2026-10-30

## Context

A paid order must reach the Minecraft server over RCON, with retries, delays, an outbox sweeper, hourly grant expiry and owner alerts (delivery spec `docs/superpowers/specs/2026-10-30-delivery-design.md` §4, parent spec §8). ADR 0001 runs the backend as two processes from one image, `api` and `worker`, and keeps the order and its outbox rows in one Postgres transaction. ADR 0010 makes the payment webhook idempotent and runs side effects after the commit. Redis already runs for rate limits and caches, with `noeviction` and AOF on.

## Decision

- **Postgres is the source of truth.** The payment transaction writes the `deliveries` rows (the outbox); their status, attempts, `nextAttemptAt` and progress decide everything. Losing Redis loses no paid delivery.
- **BullMQ on the existing Redis**, one queue `delivery`. After the commit the API adds a job `deliver` with data `{id}` and `jobId = deliveryId`, so duplicates collapse; `removeOnComplete` and `removeOnFail` keep Redis empty, so the same id can be queued again later. A failed enqueue (or one that takes more than 3 s) is logged and never fails the payment.
- **No BullMQ retries** (`attempts` 1): the retry policy and backoff live in the delivery row. A retry enqueued during its own attempt would collapse into the running job, so the worker queues it again, with the remaining delay, once that job is removed.
- **The worker process** (`node dist/worker-main.js`, the api image with another command) is a Nest application context without HTTP: one `Worker` on `delivery` with `concurrency: 1`, so RCON connections never overlap and a `REVOKE` cannot race a `GRANT`. Three job schedulers on the same queue: `sweep` every minute (re-enqueues due `PENDING` deliveries, escalates stale `RUNNING` ones; the only recovery path for lost jobs), `expire` every hour (grant expiry), `alert` every five minutes (owner emails). A scheduler that throws is logged and waits for its next run. SIGTERM closes the worker after the running job.
- BullMQ gets its own ioredis connections from `REDIS_URL` (`maxRetriesPerRequest: null`, as a Worker requires); the API's shared lazy client stays for the rest. The API only produces and opens its connection on the first enqueue, so it boots without Redis.
- **No broker** (RabbitMQ, Kafka): one codebase, tens of orders a day, and BullMQ covers retries, delays and scheduling.

## Consequences

- At most one minute between a lost job and its recovery; a Redis outage delays deliveries, never drops them.
- Throughput is one delivery at a time. That is enough at this volume; more needs per-server concurrency, not more workers.
- A deploy needs the worker application next to the API (`shop-worker` in Dokploy, `worker` in `compose.yaml`); without it payments succeed but nothing is delivered until it runs.

## When a broker would be justified

As ADR 0001 says: if `delivery` became its own service, or another service had to react to `order.paid`, an event would go through RabbitMQ (fan-out to independent consumers with their own acknowledgements). If the event volume outgrew what Postgres and Redis handle comfortably, or events had to be replayed as a log, Kafka. Neither is the case today.
