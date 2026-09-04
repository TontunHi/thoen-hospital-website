import { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  // 1. Static Public Routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/about/history`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about/vision-mission`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about/board`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ita`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/package/vip-room`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/package/childbirth`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/package/thai-traditional-and-alternative-medicine`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/package/specialized-clinics`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/service/er-in-status`,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/service/lab-tracker`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/service/loratadine-dispense`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  // 2. Dynamic News Articles
  let newsRoutes: MetadataRoute.Sitemap = [];
  try {
    const now = new Date();
    const publishedNews = await prisma.news.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        slug: true,
        updatedAt: true,
        startDate: true,
      },
      orderBy: {
        startDate: 'desc',
      },
      take: 200,
    });

    newsRoutes = publishedNews.map((item: { slug: string; updatedAt: Date | null; startDate: Date | null }) => ({
      url: `${baseUrl}/news/${encodeURIComponent(item.slug)}`,
      lastModified: item.updatedAt || item.startDate || new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));
  } catch (error) {
    console.error('Error generating sitemap for news:', error);
  }

  return [...staticRoutes, ...newsRoutes];
}
