# ADR 0006: Forms with react-hook-form and Valibot

- Status: Accepted
- Date: 2026-10-02

## Context

Checkout is the first real form (nickname, email, promo code, two consents). Native validation cannot show translated, per-field messages, and the same nickname rule has to run in the browser and again on the API before any RCON command is rendered.

## Decision

Forms use `react-hook-form` with `@hookform/resolvers/valibot`. A feature keeps its schema in `features/<name>/schemas.ts`. Valibot is framework-neutral, so when the API starts, schemas that both sides need move to `packages/shared` and are imported as `@shop/shared`.

- Schema messages are `<namespace>.errors.*` keys, not text; the component translates them with next-intl.
- Read errors with `useFormState({control})` and live values with `useWatch`, never from `formState` or `watch()`: the React Compiler (enabled in `apps/web`) would memoize those mutable reads and the UI would stop updating.
- A form whose state must survive its container unmounting (a modal) creates `useForm` in the parent that stays mounted.

## Consequences

- Three small dependencies in `apps/web`; Valibot tree-shakes per used validator.
- One schema can later validate the browser form and the `POST /api/orders` body.
