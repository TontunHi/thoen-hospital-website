import { NextResponse } from 'next/server'
import { apiGateway } from '@/lib/apiGateway'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

interface ServiceCheck {
  status: 'UP' | 'DOWN'
  latencyMs: number
  error?: string
}

export async function GET() {
  try {
    // Rate limit health checks: max 60 calls per minute
    const rateCheck = await checkRateLimit({
      key: 'health-check',
      maxAttempts: 60,
      windowSeconds: 60,
    })
    if (!rateCheck.allowed) {
      return rateCheck.response!
    }

    let primaryDb: ServiceCheck
    let hosxpDb: ServiceCheck
    let salaryDb: ServiceCheck

    const start = Date.now()
    try {
      const gwHealth = await apiGateway.health()
      const dbs = gwHealth?.databases
      primaryDb = {
        status: dbs?.website?.connected ? 'UP' : 'DOWN',
        latencyMs: dbs?.website?.latencyMs ?? 0,
      }
      hosxpDb = {
        status: dbs?.hosxp?.connected ? 'UP' : 'DOWN',
        latencyMs: dbs?.hosxp?.latencyMs ?? 0,
      }
      salaryDb = {
        status: dbs?.salary?.connected ? 'UP' : 'DOWN',
        latencyMs: dbs?.salary?.latencyMs ?? 0,
      }
    } catch (err: unknown) {
      // Strict Fail-Closed Zero-DB Architecture: if API Gateway is unreachable, report all services DOWN
      const latencyMs = Date.now() - start
      const message = err instanceof Error ? err.message : 'API Gateway unreachable'
      primaryDb = { status: 'DOWN', latencyMs, error: message }
      hosxpDb = { status: 'DOWN', latencyMs, error: message }
      salaryDb = { status: 'DOWN', latencyMs, error: message }
    }

    const allUp = primaryDb.status === 'UP' && hosxpDb.status === 'UP' && salaryDb.status === 'UP'
    const primaryUp = primaryDb.status === 'UP'

    const overallStatus = allUp ? 'healthy' : primaryUp ? 'degraded' : 'unhealthy'
    const httpStatus = primaryUp ? 200 : 503

    const responsePayload = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'production',
      services: {
        primaryDatabase: primaryDb,
        hosxpReplicaDatabase: hosxpDb,
        salaryDatabase: salaryDb,
      },
    }

    if (overallStatus !== 'healthy') {
      logger.warn({ health: responsePayload }, 'System health check reported degraded or unhealthy services')
    }

    return NextResponse.json(responsePayload, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error: unknown) {
    logger.error({ error }, 'Health check failed unexpectedly')
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check probe internal failure',
      },
      { status: 500 }
    )
  }
}
