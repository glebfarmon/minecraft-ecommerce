import {toJsonSchema} from '@valibot/to-json-schema'
import * as v from 'valibot'

export type JsonSchema = Record<string, unknown>

export type Parameter = {name: string; in: 'query' | 'path'; required: boolean; schema: JsonSchema}
export type Response = {description: string; content?: Record<string, {schema: JsonSchema}>}
export type Operation = {
  operationId?: string
  tags?: string[]
  summary: string
  description?: string
  parameters?: Parameter[]
  requestBody?: {required: true; content: {'application/json': {schema: JsonSchema}}}
  responses: Record<string, Response>
}
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete'

export type OpenApiDocument = {
  openapi: '3.1.0'
  info: {title: string; version: string}
  paths: Record<string, Partial<Record<Method, Operation>>>
}

/**
 * JSON Schema of a Valibot schema without the top-level `$schema` key, which OpenAPI does not want
 * inline. Normalising actions (`trim`, `toLowerCase`) have no JSON Schema form and are skipped.
 */
export function schema(s: v.GenericSchema): JsonSchema {
  const json = {...(toJsonSchema(s, {errorMode: 'ignore'}) as JsonSchema)}
  delete json.$schema
  return json
}

export const json = (description: string, s: v.GenericSchema): Response => ({
  description,
  content: {'application/json': {schema: schema(s)}}
})
export const body = (s: v.GenericSchema): Operation['requestBody'] => ({
  required: true,
  content: {'application/json': {schema: schema(s)}}
})
export const pathParam = (name: string): Parameter => ({
  name,
  in: 'path',
  required: true,
  schema: {type: 'string'}
})

/** Every admin route: a session that passed TOTP, then the route's permission. */
export const guarded = {
  '401': {description: 'No session, or the admin is disabled'},
  '403': {description: '`2fa_required`, or the role lacks the permission (`forbidden`)'}
}
/** Same as `guarded`, plus the rule that an admin only grants permissions they hold. */
export const guardedGrant = {
  ...guarded,
  '403': {
    description:
      '`2fa_required`, `forbidden` (the role lacks the permission), or `cannot_grant` (the target role or body holds a permission the admin lacks)'
  }
}
export const invalid = {'400': {description: 'Invalid body'}}
export const protectedOwner = {
  '400': {description: 'Invalid body, unknown role, or `owner_protected`'}
}
export const missing = {'404': {description: 'No such record'}}

export const queryParam = (name: string, s: v.GenericSchema, required = false): Parameter => ({
  name,
  in: 'query',
  required,
  schema: schema(s)
})
