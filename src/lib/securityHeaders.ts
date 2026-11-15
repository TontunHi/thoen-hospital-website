export interface SecurityHeader {
  key: string
  value: string
}

/**
 * Builds the Content-Security-Policy header string.
 * React development mode uses `eval` for call-stack reconstruction, so `'unsafe-eval'`
 * is allowed only in development and stripped in production.
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:"
    : "script-src 'self' 'unsafe-inline' blob:"

  return [
    "default-src 'self'",
    scriptSrc,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "frame-src 'self' https://app.powerbi.com https://*.moph.go.th https://*.youtube.com https://youtube.com https://docs.google.com https://*.facebook.com https://facebook.com https://*.google.com https://google.com",
    "connect-src 'self' ws: wss:",
    "media-src 'self' data: blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')
}

/**
 * Returns HTTP security headers applied globally by Next.js.
 */
export function buildSecurityHeaders(isDev: boolean): SecurityHeader[] {
  return [
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY',
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    },
    {
      key: 'Referrer-Policy',
      value: 'strict-origin-when-cross-origin',
    },
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy(isDev),
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    },
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on',
    },
  ]
}
