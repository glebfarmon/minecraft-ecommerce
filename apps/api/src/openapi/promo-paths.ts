import * as v from 'valibot'

import {
  AdminPromoCodeSchema,
  PromoActiveSchema,
  PromoCodeInputSchema,
  PromoCodeUpdateSchema
} from '@shop/shared/promo'

import {
  type Method,
  type Operation,
  body,
  guarded,
  json,
  missing,
  pathParam,
  queryParam
} from './helpers'

const needs = 'Needs `promo.write`.'
const op = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags: ['promo-codes']})
const invalid = {
  '400': {description: 'Invalid body, or `invalid`: an unknown category or product id'}
}
const writeConflict =
  '`code_taken` (a live code has this text), `promo_locked` (the code was used, so its text, kind, value, currency and scope are fixed), `max_uses_below_used`, or `stale` (out-of-date `version`)'
const stale = {
  '409': {description: '`stale`: the code changed since you read it (send the current `version`)'}
}

export const promoPaths: Record<string, Partial<Record<Method, Operation>>> = {
  '/api/admin/promo-codes': {
    get: op({
      operationId: 'listPromoCodes',
      summary: 'Promo codes, newest first',
      description: `Every live (not deleted) code with its status, use count and whether it is locked. ${needs}`,
      responses: {'200': json('Promo codes', v.array(AdminPromoCodeSchema)), ...guarded}
    }),
    post: op({
      operationId: 'createPromoCode',
      summary: 'Create a promo code',
      description: `Creates a code, optionally limited to categories and products (empty lists mean the whole cart). ${needs}`,
      requestBody: body(PromoCodeInputSchema),
      responses: {
        '201': json('The new code', AdminPromoCodeSchema),
        ...invalid,
        ...guarded,
        '409': {description: '`code_taken`: a live code already has this text'}
      }
    })
  },
  '/api/admin/promo-codes/{id}': {
    get: op({
      operationId: 'getPromoCode',
      summary: 'One promo code',
      description: `A live code by id. ${needs}`,
      parameters: [pathParam('id')],
      responses: {'200': json('The code', AdminPromoCodeSchema), ...guarded, ...missing}
    }),
    patch: op({
      operationId: 'updatePromoCode',
      summary: 'Edit a promo code',
      description: `Replaces the code's fields. Once a code has been used or attached to an order only the limit, dates and active flag may change. ${needs}`,
      parameters: [pathParam('id')],
      requestBody: body(PromoCodeUpdateSchema),
      responses: {
        '200': json('The updated code', AdminPromoCodeSchema),
        ...invalid,
        ...guarded,
        ...missing,
        '409': {description: writeConflict}
      }
    }),
    delete: op({
      operationId: 'deletePromoCode',
      summary: 'Delete a promo code',
      description: `Soft delete: the code stops working and its text can be reused, orders keep their record of it. ${needs}`,
      parameters: [
        pathParam('id'),
        queryParam('version', v.pipe(v.string(), v.description('The version you read')), true)
      ],
      responses: {
        '204': {description: 'Deleted'},
        '400': {description: 'Missing or invalid `version`'},
        ...guarded,
        ...missing,
        ...stale
      }
    })
  },
  '/api/admin/promo-codes/{id}/active': {
    patch: op({
      operationId: 'setPromoCodeActive',
      summary: 'Enable or disable a promo code',
      description: `Flips the active flag without touching the rest. ${needs}`,
      parameters: [pathParam('id')],
      requestBody: body(PromoActiveSchema),
      responses: {
        '200': json('The updated code', AdminPromoCodeSchema),
        '400': {description: 'Invalid body'},
        ...guarded,
        ...missing,
        ...stale
      }
    })
  }
}
