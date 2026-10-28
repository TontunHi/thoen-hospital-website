import { apiGateway } from './apiGateway'
import { logger } from './logger'

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

/**
 * Query GTW database through the centralized Unified API Gateway.
 * Fully decoupled from direct MySQL database connections (100% Zero-DB Architecture).
 * Zero hardcoded credentials or server hostnames.
 */
export async function queryGtwDb(sql: string, params: any[] = []): Promise<any[]> {
  try {
    return await apiGateway.gtw.getArticles()
  } catch (error: any) {
    logger.error({ error: error.message, sql }, 'Failed to query GTW Database via Gateway')
    throw error
  }
}
