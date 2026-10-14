import {writeFileSync} from 'node:fs'
import path from 'node:path'

import {buildOpenApiDocument} from './openapi'

const file = path.join(__dirname, '../../openapi.json')
writeFileSync(file, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`)
console.log(`wrote ${file}`)
