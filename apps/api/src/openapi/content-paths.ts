import * as v from 'valibot'

import {
  AdminMessageSchema,
  AdminMessagesSchema,
  AdminSiteSettingsSchema,
  MessageLocaleSchema,
  MessageOverrideInputSchema,
  PublicMessagesSchema,
  RulesDraftSchema,
  RulesDraftUpdateSchema,
  RulesVersionListSchema,
  SiteSettingsSchema,
  SiteSettingsUpdateSchema
} from '@shop/shared/content'
import {PublicRulesSchema} from '@shop/shared/rules'

import {type Method, type Operation, body, guarded, json, pathParam, queryParam} from './helpers'

const LIVE =
  'The storefront caches this content for up to a minute, so the change is live within a minute.'
const NO_SESSION = 'No session needed.'
const write = 'Needs `content.write`.'

const localeQuery = queryParam('locale', MessageLocaleSchema, true)
const stale = (what: string) => ({
  '409': {description: `\`stale\`: ${what} changed since you read it (send the current value)`}
})
const placeholderMismatch = {
  '422': {
    description:
      '`placeholder_mismatch`: the text must use exactly the placeholders of the default; `issues.expected` lists them and `issues.found` the ones sent'
  }
}

const publicOp = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags: ['Content']})
const adminOp = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags: ['Content admin']})

export const contentPaths: Record<string, Partial<Record<Method, Operation>>> = {
  '/api/content/rules': {
    get: publicOp({
      operationId: 'getPublicRules',
      summary: 'The published rules in one language',
      description: `The latest published edition, localized, with the date it was published. ${NO_SESSION} Never cached by the browser.`,
      parameters: [localeQuery],
      responses: {
        '200': json('The published rules', PublicRulesSchema),
        '400': {description: 'Missing or unsupported locale'},
        '404': {description: '`not_published`: no edition has been published yet'}
      }
    })
  },
  '/api/content/messages': {
    get: publicOp({
      operationId: 'getPublicMessages',
      summary: 'Message overrides in one language',
      description: `Only the texts an admin overrode, by key; every other key uses the built-in default. ${NO_SESSION} Never cached by the browser.`,
      parameters: [localeQuery],
      responses: {
        '200': json('Overrides by message key', PublicMessagesSchema),
        '400': {description: 'Missing or unsupported locale'}
      }
    })
  },
  '/api/content/settings': {
    get: publicOp({
      operationId: 'getPublicSettings',
      summary: 'Site name, server address and contacts',
      description: `${NO_SESSION} Never cached by the browser.`,
      responses: {'200': json('Site settings', SiteSettingsSchema)}
    })
  },
  '/api/admin/content/rules/draft': {
    get: adminOp({
      operationId: 'getRulesDraft',
      summary: 'The rules draft',
      description: `The working copy of the rules with its \`revision\`; it is invisible to players until published. ${write}`,
      responses: {'200': json('The draft', RulesDraftSchema), ...guarded}
    }),
    put: adminOp({
      operationId: 'saveRulesDraft',
      summary: 'Save the rules draft',
      description: `Replaces the draft; send the \`revision\` you read. Players see nothing until you publish. ${write}`,
      requestBody: body(RulesDraftUpdateSchema),
      responses: {
        '200': json('The saved draft with its new revision', RulesDraftSchema),
        '400': {description: 'Invalid document, or a link that is not safe'},
        ...guarded,
        ...stale('the draft')
      }
    })
  },
  '/api/admin/content/rules/publish': {
    post: adminOp({
      operationId: 'publishRules',
      summary: 'Publish the draft as a new edition',
      description: `Stores the current draft as a new version. ${write} ${LIVE}`,
      responses: {
        '201': json('The new version', v.object({id: v.number(), publishedAt: v.string()})),
        ...guarded
      }
    })
  },
  '/api/admin/content/rules/versions': {
    get: adminOp({
      operationId: 'listRulesVersions',
      summary: 'Published editions, newest first',
      description: `Pass the previous page's \`nextCursor\` as \`cursor\` for older editions. ${write}`,
      parameters: [
        queryParam('cursor', v.pipe(v.string(), v.description('nextCursor of the previous page')))
      ],
      responses: {
        '200': json('A page of editions', RulesVersionListSchema),
        '400': {description: 'Invalid cursor'},
        ...guarded
      }
    })
  },
  '/api/admin/content/rules/versions/{id}/restore': {
    post: adminOp({
      operationId: 'restoreRulesVersion',
      summary: 'Copy an old edition into the draft',
      description: `Overwrites the draft with the chosen edition; nothing goes live until you publish. ${write}`,
      parameters: [pathParam('id')],
      responses: {
        '201': json('The draft after the restore', RulesDraftSchema),
        ...guarded,
        '404': {description: 'No such edition (`not_found`)'}
      }
    })
  },
  '/api/admin/content/messages': {
    get: adminOp({
      operationId: 'listContentMessages',
      summary: 'Every editable message in one language',
      description: `Each message with its default, current text and whether it is overridden. ${write}`,
      parameters: [localeQuery],
      responses: {
        '200': json('Messages', AdminMessagesSchema),
        '400': {description: 'Missing or unsupported locale'},
        ...guarded
      }
    })
  },
  '/api/admin/content/messages/{locale}/{key}': {
    put: adminOp({
      operationId: 'setContentMessage',
      summary: 'Override one message',
      description: `Sets the text for a key and language; it must keep the placeholders of the default. ${write} ${LIVE}`,
      parameters: [pathParam('locale'), pathParam('key')],
      requestBody: body(MessageOverrideInputSchema),
      responses: {
        '200': json('The message with its new text', AdminMessageSchema),
        '400': {
          description: '`unknown_key`, `invalid_locale`, or Validation failed (invalid body)'
        },
        ...guarded,
        ...placeholderMismatch
      }
    }),
    delete: adminOp({
      operationId: 'resetContentMessage',
      summary: 'Reset one message to its default',
      description: `Removes the override; the built-in text applies again. ${write} ${LIVE}`,
      parameters: [pathParam('locale'), pathParam('key')],
      responses: {
        '204': {description: 'Reset'},
        '400': {description: '`unknown_key` or `invalid_locale`'},
        ...guarded
      }
    })
  },
  '/api/admin/content/settings': {
    get: adminOp({
      operationId: 'getContentSettings',
      summary: 'Site settings with their version',
      description: `Site name, server address and contacts. ${write}`,
      responses: {'200': json('Settings', AdminSiteSettingsSchema), ...guarded}
    }),
    put: adminOp({
      operationId: 'updateContentSettings',
      summary: 'Update the site settings',
      description: `Send the \`version\` you read. ${write} ${LIVE}`,
      requestBody: body(SiteSettingsUpdateSchema),
      responses: {
        '200': json('The saved settings', AdminSiteSettingsSchema),
        '400': {description: 'Invalid body'},
        ...guarded,
        ...stale('the settings')
      }
    })
  }
}
