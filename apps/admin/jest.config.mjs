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

// next-intl, use-intl and the formatjs packages they build on ship ESM only. next/jest keeps an allow-list of
// packages SWC compiles (three patterns, each spelling the names its own way), so add them to it.
const ESM_PACKAGES = ['next-intl', 'use-intl', 'intl-messageformat', 'icu-minify']

export default async () => {
  const resolved = await config()
  return {
    ...resolved,
    transformIgnorePatterns: resolved.transformIgnorePatterns.map(pattern =>
      pattern.replaceAll(
        'geist',
        [
          'geist',
          ...ESM_PACKAGES,
          pattern.includes('\\+') ? '@formatjs\\+[a-z-]+' : '@formatjs'
        ].join('|')
      )
    )
  }
}
