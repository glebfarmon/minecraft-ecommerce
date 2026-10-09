/** Local default matches `compose.yaml`; every deployed environment sets DATABASE_URL. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgresql://shop:shop@localhost:5432/shop'
}
