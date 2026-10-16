import * as v from 'valibot'

import {RulesDocumentSchema} from './rules'

const NamePart = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(24))
// hostname (labels of a-z0-9-) or dotted IPv4, optional :port
const HOST =
  /^(?=.{1,253}$)((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?::\d{1,5})?$/i

export const SiteSettingsSchema = v.object({
  siteName: v.object({
    plain: v.pipe(NamePart, v.description('Plain part of the site name')),
    accent: v.pipe(NamePart, v.description('Accent-coloured part of the site name'))
  }),
  serverIp: v.pipe(
    v.string(),
    v.trim(),
    v.regex(HOST, 'Use a host name or IP, optionally with :port'),
    v.description('Minecraft server address shown to players, optionally with :port')
  ),
  discordUrl: v.pipe(
    v.string(),
    v.trim(),
    v.url(),
    v.startsWith('https://', 'Use an https:// link'),
    v.description('Discord invite link (https://)')
  ),
  supportEmail: v.pipe(v.string(), v.trim(), v.email(), v.description('Support contact address'))
})
export type SiteSettings = v.InferOutput<typeof SiteSettingsSchema>
const Version = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(1),
  v.maxValue(2_147_483_647),
  v.description('Row version for optimistic locking')
)
export const AdminSiteSettingsSchema = v.object({...SiteSettingsSchema.entries, version: Version})
export const SiteSettingsUpdateSchema = AdminSiteSettingsSchema

export const RulesDraftSchema = v.object({
  content: RulesDocumentSchema,
  revision: v.number(),
  updatedAt: v.string(),
  updatedBy: v.string()
})
export const RulesDraftUpdateSchema = v.object({
  content: RulesDocumentSchema,
  revision: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(2_147_483_647),
    v.description('The draft revision this edit was made from')
  )
})
export const RulesPublishInputSchema = v.object({
  revision: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.maxValue(2_147_483_647),
    v.description('The draft revision being published; 409 `stale` if someone saved since')
  )
})
export const RulesVersionListSchema = v.object({
  versions: v.array(v.object({id: v.number(), publishedAt: v.string(), publishedBy: v.string()})),
  nextCursor: v.nullable(v.number())
})
export const RulesVersionsQuerySchema = v.object({
  cursor: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^[1-9]\d{0,9}$/),
      v.transform(Number),
      v.description('nextCursor of the previous page')
    )
  )
})

export const MessageLocaleSchema = v.picklist(['en', 'pl'])
export const MessageOverrideInputSchema = v.object({
  value: v.pipe(v.string(), v.maxLength(2000), v.description('Replacement text, up to 2000 chars'))
})
export const AdminMessageSchema = v.object({
  key: v.string(),
  namespace: v.string(),
  default: v.pipe(v.string(), v.description('Built-in text')),
  override: v.pipe(v.nullable(v.string()), v.description('Edited text, null when not overridden')),
  stale: v.pipe(
    v.boolean(),
    v.description(
      'The override no longer has the placeholders or tags of the default (changed by a deploy); the site shows the default until it is fixed'
    )
  )
})
export const AdminMessagesSchema = v.array(AdminMessageSchema)
export const PublicMessagesSchema = v.record(v.string(), v.string())

export type AdminSiteSettings = v.InferOutput<typeof AdminSiteSettingsSchema>
export type RulesDraft = v.InferOutput<typeof RulesDraftSchema>
export type RulesDraftUpdate = v.InferOutput<typeof RulesDraftUpdateSchema>
export type RulesPublishInput = v.InferOutput<typeof RulesPublishInputSchema>
export type RulesVersionList = v.InferOutput<typeof RulesVersionListSchema>
export type AdminMessage = v.InferOutput<typeof AdminMessageSchema>
