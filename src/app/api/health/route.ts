import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { queryHosDb } from '@/lib/hosDb'
import { querySalaryDb } from '@/lib/salaryDb'
import { checkRateLimit } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

interface ServiceCheck {
  status: 'UP' | 'DOWN'
  latencyMs: number
  error?: string
}

async function checkService(fn: () => Promise<any>): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    await fn()
    return {
      status: 'UP',
      latencyMs: Date.now() - start,
    }
  } catch (err: any) {
    return {
      status: 'DOWN',
      latencyMs: Date.now() - start,
      error: err?.message || 'Connection failed',
    }
  }
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

    const [primaryDb, hosxpDb, salaryDb] = await Promise.all([
      checkService(async () => {
        await prisma.$queryRaw`SELECT 1`
      }),
      checkService(async () => {
        await queryHosDb('SELECT 1')
      }),
      checkService(async () => {
        await querySalaryDb('SELECT 1')
      }),
    ])

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
  } catch (error: any) {
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
