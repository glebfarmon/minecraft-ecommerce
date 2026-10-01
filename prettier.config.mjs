/** @type {import('prettier').Config} */
export default {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  plugins: ['@trivago/prettier-plugin-sort-imports', 'prettier-plugin-tailwindcss'],
  importOrder: ['^node:', '<THIRD_PARTY_MODULES>', '^@shop/(.*)$', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ['typescript', 'jsx', 'decorators-legacy'],
  overrides: [
    { files: 'apps/web/**', options: { tailwindStylesheet: './apps/web/src/app/globals.css' } },
    { files: 'apps/admin/**', options: { tailwindStylesheet: './apps/admin/src/app/globals.css' } },
    { files: 'packages/ui/**', options: { tailwindStylesheet: './apps/web/src/app/globals.css' } },
  ],
};
