import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'โรงพยาบาลเถิน | Thoen Hospital',
    short_name: 'โรงพยาบาลเถิน',
    description: 'ระบบสารสนเทศและการบริการออนไลน์ โรงพยาบาลเถิน จังหวัดลำปาง',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0284c7',
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
