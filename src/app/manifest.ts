import type { MetadataRoute } from 'next'
import { siteConfig } from '@/config/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} | ${siteConfig.englishName}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0D7446',
    icons: [
      {
        src: '/images/common/logo-website.webp',
        sizes: '192x192',
        type: 'image/webp',
        purpose: 'any',
      },
      {
        src: '/images/common/logo-website.webp',
        sizes: '512x512',
        type: 'image/webp',
        purpose: 'maskable',
      },
    ],
  }
}
