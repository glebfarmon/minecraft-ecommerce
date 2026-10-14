import {configureStore} from '@reduxjs/toolkit'

import {api} from './generated'
import './tags'

export const makeStore = () =>
  configureStore({
    reducer: {[api.reducerPath]: api.reducer},
    middleware: d => d().concat(api.middleware)
  })
