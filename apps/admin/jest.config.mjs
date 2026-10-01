import nextJest from 'next/jest.js'

const createJestConfig = nextJest({dir: './'})

export default createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Mirrors the `@/*` path in tsconfig.json; next/jest does not read it.
  moduleNameMapper: {'^@/(.*)$': '<rootDir>/src/$1'}
})
