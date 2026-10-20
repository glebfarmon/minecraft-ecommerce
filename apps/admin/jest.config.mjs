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
  if (!resolved.transformIgnorePatterns.some(pattern => pattern.includes('geist')))
    throw new Error(
      'jest.config.mjs: next/jest no longer lists geist in transformIgnorePatterns; update the ESM allow-list hook.'
    )
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
