import * as v from 'valibot'

import {
  AdminCategorySchema,
  AdminProductListItemSchema,
  AdminProductSchema,
  AdminServerSchema,
  CategoryInputSchema,
  CategoryUpdateSchema,
  OrderInputSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  RconInputSchema,
  RconTestResultSchema,
  ServerCategoriesInputSchema,
  ServerCreateSchema,
  ServerUpdateSchema
} from '@shop/shared/catalog-admin'

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

const tags = ['Catalog admin']
const LIVE = 'The storefront caches the catalog for 60 s, so the change is live within a minute.'

const read = 'Any signed-in admin (session with TOTP) may call it.'
const write = 'Needs `catalog.write`.'
const rcon = 'Needs `server.rcon`.'

const invalid = (what: string) => ({'400': {description: `Invalid body: ${what}`}})
const stale = {
  '409': {
    description: '`stale`: the record changed since you read it (send the current `version`)'
  }
}
const slugTaken = {'409': {description: '`slug_taken`, or `stale` (out-of-date `version`)'}}
const inUse = (what: string) => ({
  '409': {
    description: `\`in_use\`: ${what}; \`issues\` carries the counts. Or \`stale\` (out-of-date \`version\`).`
  }
})
const versionQuery = queryParam(
  'version',
  v.pipe(v.string(), v.description('The version you read')),
  true
)
const noContent = {'204': {description: 'Deleted'}}
const orderStale = {
  '409': {
    description:
      '`stale`: the ids are not exactly the current list (someone added, removed or reordered)'
  }
}

const op = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags})

export const catalogAdminPaths: Record<string, Partial<Record<Method, Operation>>> = {
  '/api/admin/catalog/servers': {
    get: op({
      operationId: 'listCatalogServers',
      summary: 'Servers in storefront tab order',
      description: `Every server, enabled or not, with its attached categories in display order and its product count. RCON host and port are filled only for viewers with \`server.rcon\`. ${read}`,
      responses: {'200': json('Servers', v.array(AdminServerSchema)), ...guarded}
    }),
    post: op({
      operationId: 'createCatalogServer',
      summary: 'Create a server (disabled, last tab)',
      description: `Creates a disabled server at the end of the tab order; enable it with PATCH once it has categories and products. ${write}`,
      requestBody: body(ServerCreateSchema),
      responses: {
        '201': json('The new server', AdminServerSchema),
        ...invalid('slug, name or colors'),
        ...guarded,
        '409': {description: '`slug_taken`'}
      }
    })
  },
  '/api/admin/catalog/servers/order': {
    put: op({
      operationId: 'orderCatalogServers',
      summary: 'Reorder the server tabs',
      description: `Send every server id in the new tab order. Versions do not change. ${write} ${LIVE}`,
      requestBody: body(OrderInputSchema),
      responses: {
        '200': json('Servers in the new order', v.array(AdminServerSchema)),
        ...invalid('duplicate or empty ids'),
        ...guarded,
        ...orderStale
      }
    })
  },
  '/api/admin/catalog/servers/{id}': {
    get: op({
      operationId: 'getCatalogServer',
      summary: 'One server',
      description: `RCON host and port only with \`server.rcon\`; the password is never returned, only \`rconPasswordSet\`. ${read}`,
      parameters: [pathParam('id')],
      responses: {'200': json('The server', AdminServerSchema), ...guarded, ...missing}
    }),
    patch: op({
      operationId: 'updateCatalogServer',
      summary: 'Edit name, slug, colors or enabled state',
      description: `The slug can change only while the server is disabled (it is in storefront URLs and cart cookies). ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(ServerUpdateSchema),
      responses: {
        '200': json('The updated server', AdminServerSchema),
        '400': {description: 'Invalid body, or `slug_locked` (slug change on an enabled server)'},
        ...guarded,
        ...missing,
        ...slugTaken
      }
    }),
    delete: op({
      operationId: 'deleteCatalogServer',
      summary: 'Delete a server without products',
      description: `Allowed only while the server has no products; otherwise disable it. Its category links go with it. ${write}`,
      parameters: [pathParam('id'), versionQuery],
      responses: {...noContent, ...guarded, ...missing, ...inUse('the server still has products')}
    })
  },
  '/api/admin/catalog/servers/{id}/categories': {
    put: op({
      operationId: 'setCatalogServerCategories',
      summary: 'Attach, detach and order a server’s categories',
      description: `Send the full list of attached category ids in display order. Ids not in the list are detached, which is refused while the server has products in them. ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(ServerCategoriesInputSchema),
      responses: {
        '200': json('The server with its categories', AdminServerSchema),
        '400': {description: 'Invalid body, or `unknown_category`'},
        ...guarded,
        ...missing,
        '409': {
          description:
            '`in_use`: a detached category still has products on this server (`issues.products`), or `stale` (concurrent change)'
        }
      }
    })
  },
  '/api/admin/catalog/servers/{id}/rcon': {
    put: op({
      operationId: 'updateCatalogServerRcon',
      summary: 'Set the RCON address and password',
      description: `Host and port of the game server’s RCON. Send \`password\` to replace it (stored AES-256-GCM encrypted, never returned) or \`clearPassword: true\` to remove it. Internal addresses are refused. ${rcon}`,
      parameters: [pathParam('id')],
      requestBody: body(RconInputSchema),
      responses: {
        '200': json('The server', AdminServerSchema),
        '400': {
          description:
            'Invalid body, `rcon_host_private` (loopback, private or link-local address) or `rcon_host_unresolvable`'
        },
        ...guarded,
        ...missing,
        '503': {description: '`rcon_key_missing`: RCON_ENCRYPTION_KEY is not configured'}
      }
    })
  },
  '/api/admin/catalog/servers/{id}/rcon/test': {
    post: op({
      operationId: 'testCatalogServerRcon',
      summary: 'Test the RCON connection',
      description: `Connects to the stored address, signs in and runs \`list\` with a 5 s timeout. A failed connection is a 200 with \`ok: false\`, not an error. At most 5 per minute per session. ${rcon}`,
      parameters: [pathParam('id')],
      responses: {
        '200': json('`{ok: true, ms}` or `{ok: false, error}`', RconTestResultSchema),
        '400': {
          description:
            '`rcon_not_configured` (host, port or password missing) or `rcon_host_private`'
        },
        ...guarded,
        ...missing,
        '429': {description: 'More than 5 tests in a minute'},
        '503': {description: '`rcon_key_missing`'}
      }
    })
  },
  '/api/admin/catalog/categories': {
    get: op({
      operationId: 'listCatalogCategories',
      summary: 'All categories',
      description: `Each with its English and Polish name, the servers it is attached to and its product count. ${read}`,
      responses: {'200': json('Categories', v.array(AdminCategorySchema)), ...guarded}
    }),
    post: op({
      operationId: 'createCatalogCategory',
      summary: 'Create a category',
      description: `Both names are required. Attach it to servers with PUT /servers/{id}/categories. ${write}`,
      requestBody: body(CategoryInputSchema),
      responses: {
        '201': json('The new category', AdminCategorySchema),
        ...invalid('slug or names'),
        ...guarded,
        '409': {description: '`slug_taken`'}
      }
    })
  },
  '/api/admin/catalog/categories/{id}': {
    patch: op({
      operationId: 'updateCatalogCategory',
      summary: 'Rename a category',
      description: `Changes slug and names. ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(CategoryUpdateSchema),
      responses: {
        '200': json('The updated category', AdminCategorySchema),
        ...invalid('slug or names'),
        ...guarded,
        ...missing,
        ...slugTaken
      }
    }),
    delete: op({
      operationId: 'deleteCatalogCategory',
      summary: 'Delete an unused category',
      description: `Allowed only while no product uses it and no server has it attached. ${write}`,
      parameters: [pathParam('id'), versionQuery],
      responses: {
        ...noContent,
        ...guarded,
        ...missing,
        ...inUse('products use it or servers have it attached')
      }
    })
  },
  '/api/admin/catalog/products': {
    get: op({
      operationId: 'listCatalogProducts',
      summary: 'Products in display order',
      description: `Filter by server and category to get one storefront list. Disabled and incomplete products are included, with \`missing\`. ${read}`,
      parameters: [
        queryParam('serverId', v.pipe(v.string(), v.description('Only this server'))),
        queryParam('categoryId', v.pipe(v.string(), v.description('Only this category')))
      ],
      responses: {
        '200': json('Products', v.array(AdminProductListItemSchema)),
        '400': {description: 'Invalid query'},
        ...guarded
      }
    }),
    post: op({
      operationId: 'createCatalogProduct',
      summary: 'Create a product (disabled draft)',
      description: `Created disabled and last in its category; prices and translations may still be missing. The category must be attached to the server. Commands may only use the \`{nick}\` placeholder. ${write}`,
      requestBody: body(ProductCreateSchema),
      responses: {
        '201': json('The new product', AdminProductSchema),
        '400': {
          description:
            'Invalid body (slug, price, `{nick}`-only commands, durationDays vs kind) or `category_not_on_server`'
        },
        ...guarded,
        '409': {description: '`slug_taken` on this server'}
      }
    })
  },
  '/api/admin/catalog/products/{id}': {
    get: op({
      operationId: 'getCatalogProduct',
      summary: 'One product with commands, prices and translations',
      description: `Everything the editor shows, including \`missing\`. ${read}`,
      parameters: [pathParam('id')],
      responses: {'200': json('The product', AdminProductSchema), ...guarded, ...missing}
    }),
    patch: op({
      operationId: 'updateCatalogProduct',
      summary: 'Edit a product',
      description: `Replaces fields, prices and translations (null removes one). An enabled product must keep both prices and both translations; slug and server change only while it is disabled. Moving it to another category puts it last there. ${write} ${LIVE}`,
      parameters: [pathParam('id')],
      requestBody: body(ProductUpdateSchema),
      responses: {
        '200': json('The updated product', AdminProductSchema),
        '400': {
          description:
            'Invalid body, `incomplete` (`issues.missing` lists the gaps), `slug_locked` or `category_not_on_server`'
        },
        ...guarded,
        ...missing,
        ...slugTaken
      }
    }),
    delete: op({
      operationId: 'deleteCatalogProduct',
      summary: 'Delete a product',
      description: `Removes the product with its prices and translations. Once orders exist, a product with orders can only be disabled. ${write}`,
      parameters: [pathParam('id'), versionQuery],
      responses: {...noContent, ...guarded, ...missing, ...stale}
    })
  },
  '/api/admin/catalog/servers/{serverId}/categories/{categoryId}/products/order': {
    put: op({
      operationId: 'orderCatalogProducts',
      summary: 'Reorder the products of one category on one server',
      description: `Send every product id of that list in the new order (this is the order on the storefront). Versions do not change. ${write} ${LIVE}`,
      parameters: [pathParam('serverId'), pathParam('categoryId')],
      requestBody: body(OrderInputSchema),
      responses: {
        '200': json('The list in its new order', v.array(AdminProductListItemSchema)),
        ...invalid('duplicate or empty ids'),
        ...guarded,
        ...orderStale
      }
    })
  }
}
