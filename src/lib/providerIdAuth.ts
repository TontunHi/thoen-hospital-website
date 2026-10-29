import crypto from 'crypto'
import { logger } from './logger'

export interface ProviderIdConfig {
  env: 'PRD' | 'UAT'
  healthIdBaseUrl: string
  providerIdBaseUrl: string
  healthIdClientId: string
  healthIdClientSecret: string
  providerIdClientId: string
  providerIdSecretKey: string
  redirectUri: string
}

export interface ProviderOrganization {
  business_id?: string
  position?: string
  affiliation?: string
  license_id?: string
  hcode?: string
  code9?: string
  hcode9?: string
  level?: string
  hname_th?: string
  hname_eng?: string
  tax_id?: string
  license_expired_date?: string | null
  license_id_verify?: boolean
  expertise?: string
  expertise_id?: string
  is_private_provider?: boolean
  is_hr_admin?: boolean
  is_director?: boolean
  position_type?: string
  [key: string]: any
}

export interface ProviderIdProfile {
  account_id: string
  hash_cid: string
  provider_id?: string
  title_th?: string | null
  special_title_th?: string | null
  name_th?: string
  name_eng?: string
  firstname_th?: string
  lastname_th?: string
  organization?: ProviderOrganization[]
  rawPayload?: Record<string, any>
}

export class NotAProviderError extends Error {
  constructor(message = 'This user has not provider id') {
    super(message)
    this.name = 'NotAProviderError'
  }
}

/**
 * Returns Provider ID & Health ID configuration from environment variables.
 */
export function getProviderIdConfig(): ProviderIdConfig | null {
  const env = ((process.env.PROVIDER_ID_ENV || 'PRD').trim().toUpperCase() === 'UAT' ? 'UAT' : 'PRD') as 'PRD' | 'UAT'

  const healthIdClientId = env === 'UAT'
    ? (process.env.HEALTH_ID_UAT_CLIENT_ID || process.env.HEALTH_ID_CLIENT_ID)
    : process.env.HEALTH_ID_CLIENT_ID

  const healthIdClientSecret = env === 'UAT'
    ? (process.env.HEALTH_ID_UAT_CLIENT_SECRET || process.env.HEALTH_ID_CLIENT_SECRET)
    : process.env.HEALTH_ID_CLIENT_SECRET

  const providerIdClientId = env === 'UAT'
    ? (process.env.PROVIDER_ID_UAT_CLIENT_ID || process.env.PROVIDER_ID_CLIENT_ID)
    : process.env.PROVIDER_ID_CLIENT_ID

  const providerIdSecretKey = env === 'UAT'
    ? (process.env.PROVIDER_ID_UAT_SECRET_KEY || process.env.PROVIDER_ID_SECRET_KEY)
    : process.env.PROVIDER_ID_SECRET_KEY

  if (!healthIdClientId || !healthIdClientSecret || !providerIdClientId || !providerIdSecretKey) {
    return null
  }

  const healthIdBaseUrl = env === 'UAT' ? 'https://uat-moph.id.th' : 'https://moph.id.th'
  const providerIdBaseUrl = env === 'UAT' ? 'https://uat-provider.id.th' : 'https://provider.id.th'

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thlp.moph.go.th'
  const redirectUri = process.env.PROVIDER_ID_REDIRECT_URI || `${baseUrl.replace(/\/+$/, '')}/api/auth/provider-id/callback`

  return {
    env,
    healthIdBaseUrl,
    providerIdBaseUrl,
    healthIdClientId,
    healthIdClientSecret,
    providerIdClientId,
    providerIdSecretKey,
    redirectUri,
  }
}

function getSecretForState(customSecret?: string): string {
  return (
    customSecret ||
    process.env.PROVIDER_ID_SECRET_KEY ||
    process.env.HEALTH_ID_CLIENT_SECRET ||
    process.env.MEMBER_SESSION_SECRET ||
    (() => { throw new Error('OAuth state secret is required: set PROVIDER_ID_SECRET_KEY or MEMBER_SESSION_SECRET') })()
  )
}

/**
 * Generates an HMAC-signed state token containing timestamp, random nonce, and signature.
 * Prevents CSRF attacks and allows stateless verification.
 */
export function generateProviderIdOAuthState(customSecret?: string): string {
  const secret = getSecretForState(customSecret)
  const timestamp = Date.now()
  const nonce = crypto.randomBytes(16).toString('hex')
  const payload = `pid_${timestamp}.${nonce}`
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${hmac}`
}

/**
 * Verifies that the Provider ID OAuth state parameter is authentic and not expired.
 */
export function verifyProviderIdOAuthState(
  state: string,
  customSecret?: string,
  maxAgeMs = 15 * 60 * 1000 // 15 minutes
): boolean {
  if (!state || typeof state !== 'string') return false
  const parts = state.split('.')
  if (parts.length !== 3) return false
  const [prefixTimestamp, nonce, hmac] = parts
  if (!prefixTimestamp.startsWith('pid_')) return false
  const timestampStr = prefixTimestamp.slice(4)
  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp) || !nonce || !hmac) return false

  const now = Date.now()
  if (now - timestamp > maxAgeMs || timestamp > now + 60 * 1000) {
    return false
  }

  const secret = getSecretForState(customSecret)
  const payload = `${prefixTimestamp}.${nonce}`
  const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('base64url')

  if (expectedHmac.length !== hmac.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedHmac), Buffer.from(hmac))
  } catch {
    return false
  }
}

/**
 * Builds the Health ID authorization redirect URL for Provider ID login.
 */
export function buildProviderIdAuthorizeUrl(state: string, config: ProviderIdConfig): string {
  const params = new URLSearchParams({
    client_id: config.healthIdClientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
  })

  return `${config.healthIdBaseUrl}/oauth/redirect?${params.toString()}`
}

/**
 * Step 1: Exchanges authorization code with Health ID to get Health ID access token.
 */
export async function exchangeHealthIdCode(
  code: string,
  config: ProviderIdConfig
): Promise<string> {
  const tokenUrl = `${config.healthIdBaseUrl}/api/v1/token`
  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.healthIdClientId,
    client_secret: config.healthIdClientSecret,
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: bodyParams.toString(),
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || !data) {
    logger.error(
      { status: res.status, errorData: data },
      'Health ID token exchange failed'
    )
    throw new Error(data?.message || `Health ID token request failed with status ${res.status}`)
  }

  const accessToken = data?.data?.access_token || data?.access_token
  if (!accessToken) {
    logger.error({ responseData: data }, 'Health ID did not return access_token')
    throw new Error('Health ID response did not contain access_token')
  }

  return accessToken
}

/**
 * Step 2: Exchanges Health ID access token for Provider ID access token.
 */
export async function exchangeProviderIdToken(
  healthIdAccessToken: string,
  config: ProviderIdConfig
): Promise<string> {
  const tokenUrl = `${config.providerIdBaseUrl}/api/v1/services/token`

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: config.providerIdClientId,
      secret_key: config.providerIdSecretKey,
      token_by: 'Health ID',
      token: healthIdAccessToken,
    }),
  })

  const data = await res.json().catch(() => null)

  if (res.status === 400 && data?.message?.includes('provider id')) {
    logger.warn({ data }, 'User does not have a Provider ID')
    throw new NotAProviderError(data?.message || 'This user has not provider id')
  }

  if (!res.ok || !data) {
    logger.error(
      { status: res.status, errorData: data },
      'Provider ID service token exchange failed'
    )
    throw new Error(data?.message || `Provider ID token exchange failed with status ${res.status}`)
  }

  const accessToken = data?.data?.access_token || data?.access_token
  if (!accessToken) {
    logger.error({ responseData: data }, 'Provider ID did not return access_token')
    throw new Error('Provider ID response did not contain access_token')
  }

  return accessToken
}

/**
 * Step 3: Fetches Provider Profile using Provider ID access token.
 */
export async function getProviderIdProfile(
  providerIdAccessToken: string,
  config: ProviderIdConfig
): Promise<ProviderIdProfile> {
  const profileUrl = new URL(`${config.providerIdBaseUrl}/api/v1/services/profile`)
  profileUrl.searchParams.set('position_type', '1')
  profileUrl.searchParams.set('moph_idp_permission', '1')

  const res = await fetch(profileUrl.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${providerIdAccessToken}`,
      'client-id': config.providerIdClientId,
      'secret-key': config.providerIdSecretKey,
    },
  })

  const data = await res.json().catch(() => null)

  if (!res.ok || !data) {
    logger.error(
      { status: res.status, errorData: data },
      'Provider ID profile request failed'
    )
    throw new Error(data?.message || `Provider ID profile request failed with status ${res.status}`)
  }

  const profileData = data?.data || data
  if (!profileData || !profileData.hash_cid) {
    logger.error({ profileData }, 'Provider ID profile missing hash_cid')
    throw new Error('Provider ID profile did not return hash_cid')
  }

  return {
    account_id: profileData.account_id,
    hash_cid: profileData.hash_cid,
    provider_id: profileData.provider_id,
    title_th: profileData.title_th,
    special_title_th: profileData.special_title_th,
    name_th: profileData.name_th,
    name_eng: profileData.name_eng,
    firstname_th: profileData.firstname_th,
    lastname_th: profileData.lastname_th,
    organization: profileData.organization,
    rawPayload: profileData,
  }
}

// In-flight deduplication cache to handle concurrent/duplicate callbacks safely
const inFlightProviderExchanges = new Map<string, Promise<ProviderIdProfile>>()
const completedProviderExchanges = new Map<string, { profile: ProviderIdProfile; timestamp: number }>()

function cleanExpiredProviderExchanges() {
  const now = Date.now()
  for (const [codeKey, record] of completedProviderExchanges.entries()) {
    if (now - record.timestamp > 60_000) {
      completedProviderExchanges.delete(codeKey)
    }
  }
}

/**
 * Executes full Provider ID authentication flow:
 * Health ID Code -> Health ID Token -> Provider ID Token -> Provider Profile
 */
export async function authenticateWithProviderId(
  code: string,
  config: ProviderIdConfig
): Promise<ProviderIdProfile> {
  cleanExpiredProviderExchanges()

  const cached = completedProviderExchanges.get(code)
  if (cached && Date.now() - cached.timestamp < 60_000) {
    return cached.profile
  }

  if (inFlightProviderExchanges.has(code)) {
    return inFlightProviderExchanges.get(code)!
  }

  const exchangePromise = (async () => {
    // 1. Health ID token
    const healthIdToken = await exchangeHealthIdCode(code, config)
    // 2. Provider ID token
    const providerIdToken = await exchangeProviderIdToken(healthIdToken, config)
    // 3. Provider profile
    const profile = await getProviderIdProfile(providerIdToken, config)
    return profile
  })()

  inFlightProviderExchanges.set(code, exchangePromise)

  try {
    const profile = await exchangePromise
    completedProviderExchanges.set(code, { profile, timestamp: Date.now() })
    return profile
  } finally {
    inFlightProviderExchanges.delete(code)
  }
}
