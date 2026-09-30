import mysql from 'mysql2/promise'
import { logger } from './logger'

let gtwPool: mysql.Pool | null = null

export function getGtwPool(): mysql.Pool {
  if (!gtwPool) {
    gtwPool = mysql.createPool({
      host: process.env.GTW_DB_HOST || 'db.gtwoffice.com',
      port: parseInt(process.env.GTW_DB_PORT || '15301', 10),
      user: process.env.GTW_DB_USER || '11152',
      password: process.env.GTW_DB_PASSWORD || '',
      database: process.env.GTW_DB_NAME || 'bo_customer_11152',
      charset: process.env.GTW_DB_CHARSET || 'utf8mb4',
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 10000,
    })
  }
  return gtwPool
}

export type QueryExecutor = (sql: string, params?: any[]) => Promise<any[]>

export async function queryGtwDb(sql: string, params: any[] = []): Promise<any[]> {
  try {
    const pool = getGtwPool()
    const [results] = await pool.query(sql, params)
    return results as any[]
  } catch (error: any) {
    logger.error({ error: error.message, sql }, 'Failed to query GTW Database')
    throw error
  }
}
