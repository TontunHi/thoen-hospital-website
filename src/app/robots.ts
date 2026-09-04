import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/member/',
          '/member/*',
          '/admin/',
          '/admin/*',
          '/salary/',
          '/salary/*',
          '/api/',
          '/api/*',
          '/service/outgoing-document/',
          '/service/outgoing-document/*',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
