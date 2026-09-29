import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null

function parseDatabaseUrl(urlStr?: string) {
  if (!urlStr) return null
  try {
    const parsed = new URL(urlStr)
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    }
  } catch {
    return null
  }
}

function getPool() {
  if (!pool) {
    const dbUrlConfig = parseDatabaseUrl(process.env.DATABASE_URL)
    const host = process.env.MEMBER_DB_HOST || dbUrlConfig?.host || 'localhost'
    const port = parseInt(process.env.MEMBER_DB_PORT || String(dbUrlConfig?.port || 3306), 10)
    const user = process.env.MEMBER_DB_USER || dbUrlConfig?.user
    const password = process.env.MEMBER_DB_PASSWORD || dbUrlConfig?.password
    const database = process.env.MEMBER_DB_NAME || dbUrlConfig?.database || 'thoen_hospital_website'

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      connectionLimit: 15,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
      charset: 'utf8mb4',
    })
  }
  return pool
}

export async function queryMemberDb(sql: string, params: any[] = []) {
  const currentPool = getPool()

  const connection = await currentPool.getConnection()
  try {
    await connection.query("SET NAMES utf8mb4")
    const [results] = await connection.execute(sql, params)

    // Capture DB modification queries for audit logs
    const trimmedSql = sql.trim().toUpperCase()
    const isModify = /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)/.test(trimmedSql)
    const isAuditLogWrite = /INSERT\s+INTO\s+AUDIT_LOGS/i.test(sql)

    if (isModify && !isAuditLogWrite) {
      // Extract target table name from sql
      let targetTable = 'unknown'
      const tableMatch = sql.match(/(?:from|into|update|table)\s+[\`"']?([a-zA-Z0-9_\-]+)[\`"']?/i)
      if (tableMatch) {
        targetTable = tableMatch[1]
      }

      let actionType = 'UPDATE'
      if (trimmedSql.startsWith('INSERT')) actionType = 'CREATE'
      else if (trimmedSql.startsWith('DELETE')) actionType = 'DELETE'
      else if (trimmedSql.startsWith('CREATE') || trimmedSql.startsWith('DROP') || trimmedSql.startsWith('ALTER')) actionType = 'SYSTEM'

      const { logAudit } = await import('./audit')
      
      // Sanitize params to avoid logging passwords, OTPs, or tokens in audit logs
      const sanitizedParams = params.map((param: any) => {
        if (typeof param === 'string' && param.length >= 6) {
          // If query mentions password, otp, or secret, mask the corresponding values
          if (/password|salary_pass|otp_code|token|secret/i.test(sql)) {
            return '***REDACTED***'
          }
        }
        return param
      })

      const { logger } = await import('./logger')
      logAudit(
        actionType as any,
        targetTable,
        `SQL: ${sql} | Params: ${JSON.stringify(sanitizedParams)}`
      ).catch(err => logger.error({ err }, 'Failed to write CRUD audit log'))
    }

    return results as any[]
  } finally {
    connection.release()
  }
}
