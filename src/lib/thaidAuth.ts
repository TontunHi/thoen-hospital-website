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

/**
 * Generates a secure, cryptographically random state token to prevent CSRF attacks.
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('hex')
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
