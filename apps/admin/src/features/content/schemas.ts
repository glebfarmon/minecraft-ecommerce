import * as v from 'valibot'

import {SiteSettingsSchema} from '@shop/shared/content'

const {siteName, serverIp, discordUrl, supportEmail} = SiteSettingsSchema.entries

/** The settings form is flat; `toSettings` nests the name parts again for the API. */
export const SettingsFormSchema = v.object({
  plain: siteName.entries.plain,
  accent: siteName.entries.accent,
  serverIp,
  discordUrl,
  supportEmail
})
export type SettingsForm = v.InferOutput<typeof SettingsFormSchema>

export function toSettings(f: SettingsForm) {
  return {
    siteName: {plain: f.plain, accent: f.accent},
    serverIp: f.serverIp,
    discordUrl: f.discordUrl,
    supportEmail: f.supportEmail
  }
}
