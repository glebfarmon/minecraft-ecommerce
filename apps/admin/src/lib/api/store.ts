import {configureStore} from '@reduxjs/toolkit'

import {api} from './generated'

export const makeStore = () =>
  configureStore({
    reducer: {[api.reducerPath]: api.reducer},
    middleware: d => d().concat(api.middleware)
  })
