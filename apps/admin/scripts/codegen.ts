import path from 'node:path'

import {generateEndpoints} from '@rtk-query/codegen-openapi'

import config from '../openapi-config'

// The package CLI needs esbuild-runner or ts-node to load a TS config; tsx runs this directly.
process.chdir(path.resolve(__dirname, '..'))
generateEndpoints(config).catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
