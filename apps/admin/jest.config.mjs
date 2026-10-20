import nextJest from 'next/jest.js'

const createJestConfig = nextJest({dir: './'})

const config = createJestConfig({
  testEnvironment: '<rootDir>/jest.environment.mjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Mirrors the `@/*` path in tsconfig.json; next/jest does not read it.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^server-only$': '<rootDir>/src/test/empty.ts'
  }
})

// next-intl and use-intl ship ESM only; next/jest keeps an allow-list of packages SWC compiles, so add them to it.
export default async () => {
  const resolved = await config()
  return {
    ...resolved,
    transformIgnorePatterns: resolved.transformIgnorePatterns.map(pattern =>
      pattern.replaceAll('geist', 'geist|next-intl|use-intl')
    )
  }
}
