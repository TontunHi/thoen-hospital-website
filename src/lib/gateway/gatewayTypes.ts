export class GatewayError extends Error {
  public readonly status?: number
  public readonly code?: string
  public readonly details?: unknown

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message)
    this.name = 'GatewayError'
    this.status = options?.status
    this.code = options?.code
    this.details = options?.details
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GatewayUnavailableError extends GatewayError {
  constructor(
    message = 'Thoen Hospital API Gateway is currently unreachable. Fail-closed: refusing unauthenticated direct database access.',
    details?: unknown,
    overrides?: { status?: number; code?: string }
  ) {
    super(message, {
      status: overrides?.status ?? 503,
      code: overrides?.code ?? 'GATEWAY_UNAVAILABLE',
      details,
    })
    this.name = 'GatewayUnavailableError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GatewayTimeoutError extends GatewayUnavailableError {
  constructor(
    message = 'Thoen Hospital API Gateway request timed out.',
    details?: unknown
  ) {
    super(message, details, { status: 504, code: 'GATEWAY_TIMEOUT' })
    this.name = 'GatewayTimeoutError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GatewayAuthError extends GatewayError {
  constructor(message = 'Unauthorized or forbidden access to API Gateway.', status = 401, details?: unknown) {
    super(message, { status, code: 'GATEWAY_AUTH_ERROR', details })
    this.name = 'GatewayAuthError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class GatewayNotFoundError extends GatewayError {
  constructor(message = 'Requested resource not found on API Gateway.', details?: unknown) {
    super(message, { status: 404, code: 'GATEWAY_NOT_FOUND', details })
    this.name = 'GatewayNotFoundError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export interface ApiGatewayConfig {
  baseUrl?: string
  apiKey?: string
  timeoutMs?: number
  fetchFn?: typeof fetch
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeoutMs?: number
  signal?: AbortSignal
}

export interface GatewayApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  count?: number
  status?: string
  [key: string]: unknown
}

export interface HealthResponse {
  status: 'UP' | 'DOWN'
  service: string
  databases: {
    hosxp: { host: string; database: string; connected: boolean; latencyMs: number }
    salary: { host: string; database: string; connected: boolean; latencyMs: number }
    website: { host: string; database: string; connected: boolean; latencyMs: number }
  }
  uptime: number
}
