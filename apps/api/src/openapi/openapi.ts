import {toJsonSchema} from '@valibot/to-json-schema'
import type * as v from 'valibot'

import {CatalogResponseSchema, LocaleSchema} from '@shop/shared/catalog'

type JsonSchema = Record<string, unknown>

export type OpenApiDocument = {
  openapi: '3.1.0'
  info: {title: string; version: string}
  paths: Record<
    string,
    {
      get?: {
        summary: string
        parameters: {name: string; in: 'query'; required: boolean; schema: JsonSchema}[]
        responses: Record<
          string,
          {description: string; content?: Record<string, {schema: JsonSchema}>}
        >
      }
    }
  >
}

/** JSON Schema of a Valibot schema without the top-level `$schema` key, which OpenAPI does not want inline. */
function schema(s: v.GenericSchema): JsonSchema {
  const json = {...(toJsonSchema(s) as JsonSchema)}
  delete json.$schema
  return json
}

/** The API contract, generated from the same Valibot schemas the API validates with (parent spec §5). */
export function buildOpenApiDocument(): OpenApiDocument {
  return {
    openapi: '3.1.0',
    info: {title: 'Shop API', version: '1'},
    paths: {
      '/api/catalog': {
        get: {
          summary: 'Public catalog: servers with ordered categories, products with prices',
          parameters: [{name: 'locale', in: 'query', required: true, schema: schema(LocaleSchema)}],
          responses: {
            '200': {
              description: 'Catalog in the requested locale (missing texts fall back to en)',
              content: {'application/json': {schema: schema(CatalogResponseSchema)}}
            },
            '400': {description: 'Missing or unsupported locale'}
          }
        }
      }
    }
  }
}
