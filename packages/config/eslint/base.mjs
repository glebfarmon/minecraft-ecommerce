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
