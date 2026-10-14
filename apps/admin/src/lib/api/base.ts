import {createApi, fetchBaseQuery} from '@reduxjs/toolkit/query/react'

/** Generated endpoints are injected into this API (openapi-config.ts). */
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({baseUrl: '/', credentials: 'same-origin'}),
  endpoints: () => ({})
})
