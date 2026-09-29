import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/member',
          '/member/*',
          '/salary',
          '/salary/*',
          '/service',
          '/service/*',
          '/api',
          '/api/*',
          '/news-login',
          '/unauthorized',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  }
}
