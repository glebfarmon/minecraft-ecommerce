import type {ConfigFile} from '@rtk-query/codegen-openapi'

const config: ConfigFile = {
  schemaFile: '../api/openapi.json',
  apiFile: './src/lib/api/base.ts',
  apiImport: 'baseApi',
  outputFile: './src/lib/api/generated.ts',
  exportName: 'api',
  hooks: true,
  filterEndpoints: (_name, {path}) => /\/(admin|invite)/.test(path)
}

export default config
