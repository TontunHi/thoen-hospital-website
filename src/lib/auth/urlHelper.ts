/**
 * URL and Host Validation Helper
 * Protects against Host Header Injection and Open Redirects (CWE-601 / OWASP A01).
 */

const DEFAULT_ALLOWED_HOSTNAMES = [
  'thlp.moph.go.th',
  'thoenhospital.com',
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
]

/**
 * Checks if a given host or hostname (with or without port) is trusted.
 */
export function isAllowedHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false

  const cleanHost = host.trim().toLowerCase()
  const [hostname] = cleanHost.split(':')

  // Check custom configured ALLOWED_HOSTS from environment
  if (process.env.ALLOWED_HOSTS) {
    const customAllowed = process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim().toLowerCase())
    if (customAllowed.includes(cleanHost) || customAllowed.includes(hostname)) {
      return true
    }
  }

  // Check standard hospital & ministry hosts
  if (DEFAULT_ALLOWED_HOSTNAMES.includes(hostname)) {
    return true
  }

  // Allow subdomains of official hospital and ministry domains
  if (hostname.endsWith('.moph.go.th') || hostname.endsWith('.thoenhospital.com')) {
    return true
  }

  return false
}

/**
 * Safely resolves the application base URL for OAuth callbacks and internal redirects,
 * preventing Host Header Injection and Open Redirect attacks (CWE-601 / OWASP A01).
 */
export function getSafeBaseUrl(request: Request): string {
  // 1. Explicitly configured public domain
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (siteUrl && siteUrl !== 'undefined' && siteUrl !== 'null') {
    try {
      const parsed = new URL(siteUrl)
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      // invalid URL in env, fallback below
    }
  }

  // 2. Validate incoming reverse-proxy or host headers against allowed whitelist
  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const rawProto = request.headers.get('x-forwarded-proto') || 'https'
  const protocol = rawProto.split(',')[0].trim().toLowerCase() === 'http' ? 'http' : 'https'

  if (rawHost) {
    const host = rawHost.split(',')[0].trim()
    if (isAllowedHost(host)) {
      return `${protocol}://${host}`
    }
  }

  // 3. Fallback to request.url origin if it matches allowed hosts
  try {
    const reqUrl = new URL(request.url)
    if (isAllowedHost(reqUrl.host)) {
      return reqUrl.origin
    }
  } catch {
    // fallback below
  }

  // 4. Default secure fallback origin
  return process.env.NODE_ENV === 'production'
    ? 'https://thlp.moph.go.th'
    : 'http://localhost:3000'
}
