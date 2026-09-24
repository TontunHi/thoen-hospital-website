import mysql from 'mysql2/promise'

export interface ClinicalDbConfig {
  host: string
  port: number
  user: string
  password?: string
  database: string
  charset: string
}

let pool: mysql.Pool | null = null

/**
 * Resolve HOSxP connection credentials with backward compatibility.
 * Priority:
 * 1. HOSXP_DB_* (New unified standard)
 * 2. APPOINT_DB_* (Legacy appointment DB)
 * 3. ER_DB_* (Legacy ER DB)
 */
export function getClinicalDbConfig(): ClinicalDbConfig {
  return {
    host: process.env.HOSXP_DB_HOST || process.env.APPOINT_DB_HOST || process.env.ER_DB_HOST || 'localhost',
    port: parseInt(
      process.env.HOSXP_DB_PORT || process.env.APPOINT_DB_PORT || process.env.ER_DB_PORT || '3306',
      10
    ),
    user: process.env.HOSXP_DB_USER || process.env.APPOINT_DB_USER || process.env.ER_DB_USER || 'guest',
    password: process.env.HOSXP_DB_PASSWORD || process.env.APPOINT_DB_PASSWORD || process.env.ER_DB_PASSWORD || 'guest',
    database: process.env.HOSXP_DB_NAME || process.env.APPOINT_DB_NAME || process.env.ER_DB_NAME || 'hos',
    charset: process.env.HOSXP_DB_CHARSET || process.env.APPOINT_DB_CHARSET || process.env.ER_DB_CHARSET || 'tis620',
  }
}

/**
 * Returns a singleton connection pool for HOSxP.
 */
export function getClinicalPool(): mysql.Pool {
  if (!pool) {
    const config = getClinicalDbConfig()
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: config.charset,
      connectionLimit: 15,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
    })
  }
  return pool
}

/**
 * Execute raw SQL with parameter binding on the HOSxP pool.
 */
export async function queryClinicalDb<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const currentPool = getClinicalPool()
  const [results] = await currentPool.execute(sql, params)
  return results as T[]
}

// -------------------------------------------------------------
// Domain Queries (Deep Module Interface)
// -------------------------------------------------------------

export interface AppointmentMismatchRecord {
  hn: string
  department: string
  vstdate: string
  nextdate: string
  appUser: string
}

/**
 * Retrieve appointments booked to inactive or misconfigured examination rooms.
 */
export async function fetchAppointmentMismatches(
  queryExecutor = queryClinicalDb
): Promise<AppointmentMismatchRecord[]> {
  const sql = `
    SELECT 
      o.hn,
      o.vstdate,
      o.nextdate,
      k.department,
      o.app_user
    FROM oapp o
    LEFT OUTER JOIN kskdepartment k ON o.depcode = k.depcode
    WHERE o.nextdate > CURRENT_DATE
      AND (k.depcode_active IS NULL OR k.depcode_active = '')
    ORDER BY o.app_user
  `
  const rows = await queryExecutor<Record<string, unknown>>(sql)
  return rows.map((row) => ({
    hn: String(row.hn || ''),
    department: row.department ? String(row.department).trim() : '',
    vstdate: row.vstdate ? String(row.vstdate) : '',
    nextdate: row.nextdate ? String(row.nextdate) : '',
    appUser: row.app_user ? String(row.app_user).trim() : '',
  }))
}
