import type { NextConfig } from 'next'
import { buildSecurityHeaders } from './src/lib/securityHeaders'

const securityHeaders = buildSecurityHeaders(process.env.NODE_ENV === 'development')

const isFastBuild = process.env.FAST_BUILD === 'true'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: isFastBuild,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
    '@prisma/client',
    'nodemailer',
    'pino',
    'sharp',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'three'],
    turbopackFileSystemCacheForBuild: true,
  },
  allowedDevOrigins: [
    '172.16.0.*',
    '192.168.1.*',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig

