import {defineConfig} from 'eslint/config'

import {base} from '@shop/config/eslint/base'

export default defineConfig(base, {ignores: ['src/generated/**']})
