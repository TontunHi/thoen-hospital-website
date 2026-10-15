import { apiGateway } from '@/lib/apiGateway'

/**
 * Execute Member & Website CMS queries via the Thoen Unified API Gateway.
 * Fully decoupled from direct MySQL database connections (Zero-DB Architecture).
 * Strict fail-closed: Throws GatewayUnavailableError if the Gateway is down.
 */
export async function queryMemberDb(sql: string, params: any[] = []): Promise<any[]> {
  const trimmedSql = sql.trim().toUpperCase()
  const isSelect = trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('EXPLAIN') || trimmedSql.startsWith('SHOW')

  let results: any
  if (isSelect) {
    results = await apiGateway.app.query(sql, params)
  } else {
    results = await apiGateway.app.execute(sql, params)
  }

  // Capture DB modification queries for audit logs
  const isModify = /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)/.test(trimmedSql)
  const isAuditLogWrite = /INSERT\s+INTO\s+AUDIT_LOGS/i.test(sql)

  if (isModify && !isAuditLogWrite) {
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

    const sanitizedParams = params.map((param: any) => {
      if (typeof param === 'string' && param.length >= 6) {
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
}
