import crypto from 'crypto'
import { logger } from './logger'

export interface ThaidConfig {
  clientId: string
  clientSecret: string
  apiKey?: string
  redirectUri: string
  authUrl: string
  tokenUrl: string
}

const DEFAULT_AUTH_URL = 'https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/'
const DEFAULT_TOKEN_URL = 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/'

/**
 * Returns ThaID configuration from environment variables.
 */
export function getThaidConfig(): ThaidConfig | null {
  const clientId = process.env.THAID_CLIENT_ID
  const clientSecret = process.env.THAID_CLIENT_SECRET
  const apiKey = process.env.THAID_API_KEY
  
  if (!clientId || !clientSecret) {
    return null
  }

  // Fallback redirect URI based on NEXT_PUBLIC_SITE_URL if THAID_REDIRECT_URI is not explicitly set
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const redirectUri = process.env.THAID_REDIRECT_URI || `${baseUrl.replace(/\/+$/, '')}/api/auth/thaid/callback`

  return {
    clientId,
    clientSecret,
    apiKey: apiKey || undefined,
    redirectUri,
    authUrl: process.env.THAID_AUTH_URL || DEFAULT_AUTH_URL,
    tokenUrl: process.env.THAID_TOKEN_URL || DEFAULT_TOKEN_URL,
  }
}

function getSecretForState(customSecret?: string): string {
  return (
    customSecret ||
    process.env.THAID_CLIENT_SECRET ||
    process.env.JWT_SECRET ||
    'thoen-thaid-oauth-state-secret-fallback'
  )
}

/**
 * Generates an HMAC-signed state token containing timestamp, random nonce, and signature.
 * Allows stateless verification even if cross-site redirects drop cookies or multi-tabs overwrite them.
 */
export function generateOAuthState(customSecret?: string): string {
  const secret = getSecretForState(customSecret)
  const timestamp = Date.now()
  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = `${timestamp}.${nonce}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${hmac}`
}

/**
 * Verifies that the OAuth state parameter is authentic, has not been tampered with,
 * and is within its validity period (default 10 minutes).
 */
export function verifyOAuthState(
  state: string,
  customSecret?: string,
  maxAgeMs = 10 * 60 * 1000 // 10 minutes
): boolean {
  if (!state || typeof state !== 'string') return false
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const [timestampStr, nonce, hmac] = parts
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp) || !nonce || !hmac) return false

  const now = Date.now()
  // Check validity window with 60-second forward clock drift allowance
  if (now - timestamp > maxAgeMs || timestamp > now + 60 * 1000) {
    return false
  }

  const secret = getSecretForState(customSecret)
  const payload = `${timestampStr}.${nonce}`
  const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')

  if (expectedHmac.length !== hmac.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(hmac))
  } catch {
    return false
  }
}

/**
 * Generates an HMAC-signed state token embedding the event QR token.
 */
export function generateEventOAuthState(qrToken: string, customSecret?: string): string {
  const secret = getSecretForState(customSecret)
  const timestamp = Date.now()
  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = `evt_${qrToken}.${timestamp}.${nonce}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${hmac}`
}

/**
 * Verifies that the OAuth state parameter for an event check-in is authentic and returns the qrToken.
 */
export function verifyEventOAuthState(
  state: string,
  customSecret?: string,
  maxAgeMs = 15 * 60 * 1000
): { isValid: boolean; qrToken?: string } {
  if (!state || typeof state !== 'string') return { isValid: false }
  const parts = state.split('.')
  if (parts.length !== 4) return { isValid: false }
  const [prefixToken, timestampStr, nonce, hmac] = parts
  if (!prefixToken.startsWith('evt_')) return { isValid: false }
  const qrToken = prefixToken.slice(4)
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp) || !nonce || !hmac || !qrToken) return { isValid: false }

  const now = Date.now()
  if (now - timestamp > maxAgeMs || timestamp > now + 60 * 1000) {
    return { isValid: false }
  }

  const secret = getSecretForState(customSecret)
  const payload = `${prefixToken}.${timestampStr}.${nonce}`
  const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')

  if (expectedHmac.length !== hmac.length) return { isValid: false }
  try {
    const match = crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(hmac))
    return { isValid: match, qrToken: match ? qrToken : undefined }
  } catch {
    return { isValid: false }
  }
}

/**
 * Builds the ThaID authorization redirect URL.
 */
export function buildThaidAuthorizeUrl(state: string, config: ThaidConfig): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: 'openid pid',
    state,
  })

  return `${config.authUrl}?${params.toString()}`
}

export interface ThaidTokenResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  id_token?: string
  pid?: string
  [key: string]: any
}

export interface ThaidUserInfo {
  pid: string
  title?: string
  firstName?: string
  lastName?: string
  rawPayload?: Record<string, any>
}

/**
 * Safely decodes a JWT token without verifying cryptographic signature.
 * Note: DOPA token endpoint is reached directly over TLS/HTTPS with Client Secret authentication,
 * so the response token payload is verified by transport security.
 */
function decodeJwtPayload(jwtToken: string): Record<string, any> | null {
  try {
    const parts = jwtToken.split('.')
    if (parts.length < 2) return null
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8')
    return JSON.parse(payloadJson)
  } catch (err) {
    logger.warn({ err }, 'Failed to decode JWT payload from ThaID')
    return null
  }
}

/**
 * Exchanges the authorization code received from ThaID for user credentials and extracts the citizen ID (pid).
 */
export async function exchangeThaidAuthorizationCode(
  code: string,
  config: ThaidConfig
): Promise<ThaidUserInfo | null> {
  try {
    const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    })

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
    }

    if (config.apiKey) {
      headers['x-api-key'] = config.apiKey
      headers['api-key'] = config.apiKey
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: bodyParams.toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({ status: response.status, errorText }, 'ThaID token exchange returned error status')
      return null
    }

    const data: ThaidTokenResponse = await response.json()

    // 1. Check if PID is directly in the JSON response
    let pid = data.pid || (data as any).PID || (data as any).citizen_id || (data as any).sub

    // 2. If not found, inspect id_token JWT
    let payload: Record<string, any> | null = null
    if (data.id_token) {
      payload = decodeJwtPayload(data.id_token)
      if (payload && !pid) {
        pid = payload.pid || payload.PID || payload.citizen_id || payload.sub
      }
    }

    // 3. Fallback check on access_token if it's a JWT
    if (!pid && data.access_token && data.access_token.includes('.')) {
      const accessPayload = decodeJwtPayload(data.access_token)
      if (accessPayload) {
        pid = accessPayload.pid || accessPayload.PID || accessPayload.citizen_id || accessPayload.sub
        payload = payload || accessPayload
      }
    }

    if (!pid || typeof pid !== 'string') {
      logger.error({ dataKeys: Object.keys(data) }, 'ThaID token response did not contain a valid PID')
      return null
    }

    // Sanitize PID (keep only numeric 13 digits)
    const sanitizedPid = pid.replace(/\D/g, '')

    return {
      pid: sanitizedPid,
      title: payload?.title || (data as any).title,
      firstName: payload?.given_name || (data as any).given_name || payload?.first_name,
      lastName: payload?.family_name || (data as any).family_name || payload?.last_name,
      rawPayload: payload || data,
    }
  } catch (error) {
    logger.error({ error }, 'Exception during ThaID authorization code exchange')
    return null
  }
}
