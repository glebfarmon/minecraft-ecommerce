import type {MetadataRoute} from 'next'

/** The admin is private: no crawler should list it (the layout metadata and an X-Robots-Tag header say the same). */
export default function robots(): MetadataRoute.Robots {
  return {rules: {userAgent: '*', disallow: '/'}}
}
