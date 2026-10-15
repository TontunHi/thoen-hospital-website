import { apiGateway } from '@/lib/apiGateway'

/**
 * Execute salary read queries via the Thoen Unified API Gateway.
 * Fully decoupled from direct MySQL database connections (Zero-DB Architecture).
 * Strict fail-closed: Throws GatewayUnavailableError if the Gateway is down.
 */
export async function querySalaryDb(sql: string, params: any[] = []): Promise<any[]> {
  return apiGateway.salary.query(sql, params)
}

/**
 * Execute salary write or edit queries via the Thoen Unified API Gateway.
 * Selects route through query, while mutations route through execute.
 */
export async function querySalaryEditDb(sql: string, params: any[] = []): Promise<any> {
  const trimmed = sql.trim().toUpperCase()
  if (trimmed.startsWith('SELECT') || trimmed.startsWith('EXPLAIN') || trimmed.startsWith('SHOW')) {
    return apiGateway.salary.query(sql, params)
  }
  return apiGateway.salary.execute(sql, params)
}
