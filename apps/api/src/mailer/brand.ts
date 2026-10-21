import {DEFAULT_SITE_SETTINGS, type SiteSettings} from '@shop/shared/content'

/** The site name as one string ("Block" + "haus"), for mail subjects and bodies. */
export const brandOf = ({siteName}: Pick<SiteSettings, 'siteName'>) =>
  siteName.plain + siteName.accent

/** Static brand for values read once at boot (Better Auth `appName`, the TOTP issuer). */
export const DEFAULT_BRAND = brandOf(DEFAULT_SITE_SETTINGS)

/** The live brand; a mail must still go out if settings cannot be read, so it falls back to the default. */
export async function siteBrand(content: {settings(): Promise<SiteSettings>}): Promise<string> {
  try {
    return brandOf(await content.settings())
  } catch {
    return DEFAULT_BRAND
  }
}
