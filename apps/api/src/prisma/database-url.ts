/** Local default matches `compose.yaml`; every deployed environment sets DATABASE_URL. */
export function databaseUrl(): string {
  return process.env.DATABASE_URL ?? 'postgresql://shop:shop@localhost:5432/shop'
}

/** Fail a connect in 5 s instead of waiting forever (node-postgres defaults to no timeout). */
export function poolConfig(): {connectionString: string; connectionTimeoutMillis: number} {
  return {connectionString: databaseUrl(), connectionTimeoutMillis: 5000}
}
