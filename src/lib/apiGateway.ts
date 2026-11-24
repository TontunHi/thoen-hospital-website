/**
 * Thoen Hospital Centralized API Gateway Client SDK
 * 
 * Provides unified, type-safe, and fail-closed access to the Thoen Hospital Unified API Gateway.
 * Supports HOSxP Clinical Services, Salary Database, Members CRUD & Permissions,
 * Website CMS, and Universal Parameterized Data Access.
 * 
 * Strictly follows the Fail-Closed Security Policy:
 * If the Gateway is unreachable, a GatewayUnavailableError is thrown immediately.
 * Never silently fallback to direct database sockets.
 */

import {
  GatewayError,
  GatewayUnavailableError,
  GatewayTimeoutError,
  GatewayAuthError,
  GatewayNotFoundError,
  type ApiGatewayConfig,
  type RequestOptions,
  type GatewayApiResponse,
  type HealthResponse,
} from './gateway/gatewayTypes'
import { createClinicalNamespace } from './gateway/clinicalGatewayNamespace'
import { createSalaryNamespace } from './gateway/salaryGatewayNamespace'
import { createAppNamespace } from './gateway/appGatewayNamespace'

export {
  GatewayError,
  GatewayUnavailableError,
  GatewayTimeoutError,
  GatewayAuthError,
  GatewayNotFoundError,
  type ApiGatewayConfig,
  type RequestOptions,
  type GatewayApiResponse,
  type HealthResponse,
}

export class ApiGatewayClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly fetchFn: typeof fetch

  constructor(config?: ApiGatewayConfig) {
    this.baseUrl = (config?.baseUrl || process.env.API_GATEWAY_URL || 'http://192.168.1.208:8443').replace(/\/+$/, '')
    this.apiKey = config?.apiKey || process.env.API_GATEWAY_KEY || 'thoen_gw_sec_7a8b9c2d1e0f3456'
    this.timeoutMs = config?.timeoutMs || (process.env.API_GATEWAY_TIMEOUT_MS ? parseInt(process.env.API_GATEWAY_TIMEOUT_MS, 10) : 30000)
    this.fetchFn = config?.fetchFn || fetch
  }

  public getBaseUrl(): string {
    return this.baseUrl
  }

  /**
   * Core request dispatcher with timeout, automatic x-api-key header, and fail-closed error handling.
   */
  public async request<T = unknown>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    const url = `${this.baseUrl}${cleanPath}`
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs

    const controller = new AbortController()
    let timedOut = false
    const timeoutId = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'x-api-key': this.apiKey,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {})
    }

    try {
      const response = await this.fetchFn(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: options?.signal || controller.signal
      })

      clearTimeout(timeoutId)

      let json: GatewayApiResponse<T>
      try {
        json = await response.json()
      } catch (parseErr) {
        if (!response.ok) {
          throw new GatewayError(`API Gateway HTTP ${response.status}: ${response.statusText}`, {
            status: response.status,
            details: parseErr
          })
        }
        throw new GatewayError('Failed to parse response JSON from API Gateway.', {
          status: response.status,
          details: parseErr
        })
      }

      if (!response.ok) {
        const errorMsg = json.error || `API Gateway error (${response.status})`
        if (response.status === 401 || response.status === 403) {
          throw new GatewayAuthError(errorMsg, response.status, json)
        }
        if (response.status === 404) {
          throw new GatewayNotFoundError(errorMsg, json)
        }
        if (response.status === 503) {
          throw new GatewayUnavailableError(errorMsg, json)
        }
        if (response.status === 504) {
          throw new GatewayTimeoutError(errorMsg, json)
        }
        throw new GatewayError(errorMsg, { status: response.status, details: json })
      }

      if (json.success === false) {
        throw new GatewayError(json.error || 'Operation failed on API Gateway', { details: json })
      }

      // Return unwrapped data if response follows standard { success: true, data: ... }
      // but preserve full envelope if response has pagination metadata or custom envelope fields like slideDuration
      if (
        json.data !== undefined &&
        json.pagination === undefined &&
        json.slideDuration === undefined
      ) {
        return json.data as T
      }

      return json as unknown as T
    } catch (err: unknown) {
      clearTimeout(timeoutId)

      if (err instanceof GatewayError) {
        throw err
      }

      const isAbort = (err as Error)?.name === 'AbortError'
      if (timedOut || (isAbort && !options?.signal?.aborted)) {
        throw new GatewayTimeoutError(`Gateway request to ${path} timed out after ${timeoutMs}ms.`, err)
      }
      if (isAbort) {
        throw new GatewayUnavailableError(`Gateway request to ${path} was aborted.`, err)
      }

      const cause = (err as Error & { cause?: { code?: string; message?: string } })?.cause
      const causeDetail = cause?.code || cause?.message ? ` (${[cause.code, cause.message].filter(Boolean).join(': ')})` : ''
      const errorMsg = `Connection to API Gateway failed: ${(err as Error)?.message || 'Network error'}${causeDetail}`

      throw new GatewayUnavailableError(errorMsg, err)
    }
  }

  public get<T = unknown>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'GET', undefined, options)
  }

  public post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'POST', body, options)
  }

  public put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PUT', body, options)
  }

  public patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'PATCH', body, options)
  }

  public delete<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(path, 'DELETE', body, options)
  }

  public async health(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/health')
  }

  // ================================================================
  // Domain Namespace: Clinical Services (HOSxP)
  // ================================================================
  public readonly clinical = createClinicalNamespace({
    get: (path, options) => this.get(path, options),
    post: (path, body, options) => this.post(path, body, options),
    patch: (path, body, options) => this.patch(path, body, options),
    delete: (path, body, options) => this.delete(path, body, options),
  })



  // ================================================================
  // Domain Namespace: Salary Services
  // ================================================================
  public readonly salary = createSalaryNamespace({
    get: (path, options) => this.get(path, options),
    post: (path, body, options) => this.post(path, body, options),
    put: (path, body, options) => this.put(path, body, options),
    delete: (path, body, options) => this.delete(path, body, options),
  })

  // ================================================================
  // Domain Namespace: Website Core Application (CMS, Members, Tasks)
  // ================================================================
  public readonly app = createAppNamespace({
    get: (path, options) => this.get(path, options),
    post: (path, body, options) => this.post(path, body, options),
    put: (path, body, options) => this.put(path, body, options),
    patch: (path, body, options) => this.patch(path, body, options),
    delete: (path, body, options) => this.delete(path, body, options),
  })

  // ================================================================
  // Domain Namespace: GTW (Gotowin) Office Integration
  // ================================================================
  public readonly gtw = {
    /**
     * Fetch raw articles from GTW database via Centralized API Gateway.
     */
    getArticles: async <T = Record<string, unknown>>(options?: { limit?: number; offset?: number; since?: string }): Promise<T[]> => {
      const q = new URLSearchParams()
      if (options?.limit) q.set('limit', String(options.limit))
      if (options?.offset) q.set('offset', String(options.offset))
      if (options?.since) q.set('since', options.since)
      const qs = q.toString() ? `?${q.toString()}` : ''
      const res = await this.get<{ data?: T[] } | T[]>(`/api/v1/gtw/articles${qs}`)
      if (Array.isArray(res)) return res
      return (res as { data?: T[] })?.data || []
    }
  }

  // ================================================================
  // Domain Namespace: Tasks & Workflow
  // ================================================================
  public get tasks() {
    return this.app
  }
}

/**
 * Singleton instance of ApiGatewayClient configured from environment variables.
 */
export const apiGateway = new ApiGatewayClient()

/**
 * Factory function for creating custom instances (e.g. for testing with custom fetchFn or baseUrl).
 */
export function createApiGatewayClient(config?: ApiGatewayConfig): ApiGatewayClient {
  return new ApiGatewayClient(config)
}

export default apiGateway
