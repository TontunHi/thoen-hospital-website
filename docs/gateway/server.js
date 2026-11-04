import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUi from '@fastify/swagger-ui'
import mysql from 'mysql2/promise'
import 'dotenv/config'

// Route Plugins
import healthRoutes from './routes/health.js'
import auditRoutes from './routes/audit.js'
import clinicalRoutes from './routes/clinical.js'
import palliativeRoutes from './routes/palliative.js'
import salaryRoutes from './routes/salary.js'
import appRoutes from './routes/app.js'
import gtwRoutes from './routes/gtw.js'
import rawSqlRoutes from './routes/rawSql.js'

const fastify = Fastify({
  logger: { level: 'info' }
})

await fastify.register(cors, { origin: true })
await fastify.register(rateLimit, { max: 600, timeWindow: '1 minute' })

// ------------------------------------------------------------------
// Swagger / OpenAPI Documentation
// ------------------------------------------------------------------
await fastify.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Thoen Hospital Unified API Gateway',
      description: 'ระบบศูนย์กลางเชื่อมต่อข้อมูลโรงพยาบาลเถิน (HOSxP, Salary, และ Website Application) ปลอดภัย ได้มาตรฐาน พร้อม In-Memory Caching',
      version: '1.0.0'
    },
    servers: [
      { url: '/', description: 'Current Gateway Server' }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          name: 'x-api-key',
          in: 'header',
          description: 'กรุณาระบุ x-api-key ที่ได้รับมอบหมายเพื่อยืนยันสิทธิ์การใช้งาน'
        }
      }
    },
    security: [{ ApiKeyAuth: [] }]
  }
})

await fastify.register(fastifySwaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  },
  staticCSP: false
})

// ------------------------------------------------------------------
// Database Connection Pools (3 Databases)
// ------------------------------------------------------------------
function getRequiredEnv(key) {
  const val = process.env[key]
  if (!val || typeof val !== 'string' || !val.trim()) {
    throw new Error(`CRITICAL CONFIG ERROR: Required environment variable "${key}" is missing or empty in .env`)
  }
  return val.trim()
}

const hosPool = mysql.createPool({
  host: process.env.HOSXP_DB_HOST || '192.168.1.4',
  port: parseInt(process.env.HOSXP_DB_PORT || '3306', 10),
  user: process.env.HOSXP_DB_USER || 'guest',
  password: getRequiredEnv('HOSXP_DB_PASSWORD'),
  database: process.env.HOSXP_DB_NAME || 'hos',
  charset: process.env.HOSXP_DB_CHARSET || 'tis620',
  connectionLimit: 25,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

const salaryPool = mysql.createPool({
  host: process.env.SALARY_DB_HOST || '192.168.1.4',
  port: parseInt(process.env.SALARY_DB_PORT || '3306', 10),
  user: process.env.SALARY_DB_USER || 'guest',
  password: getRequiredEnv('SALARY_DB_PASSWORD'),
  database: process.env.SALARY_DB_NAME || 'salary',
  charset: process.env.SALARY_DB_CHARSET || 'tis620',
  connectionLimit: 15,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

const salaryEditPool = mysql.createPool({
  host: process.env.SALARY_EDIT_DB_HOST || '192.168.1.4',
  port: parseInt(process.env.SALARY_EDIT_DB_PORT || '3306', 10),
  user: process.env.SALARY_EDIT_DB_USER || 'salary',
  password: getRequiredEnv('SALARY_EDIT_DB_PASSWORD'),
  database: process.env.SALARY_EDIT_DB_NAME || 'salary',
  charset: process.env.SALARY_EDIT_DB_CHARSET || 'tis620',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

const appPool = mysql.createPool({
  host: process.env.APP_DB_HOST || '192.168.1.7',
  port: parseInt(process.env.APP_DB_PORT || '3306', 10),
  user: process.env.APP_DB_USER || 'prnew',
  password: getRequiredEnv('APP_DB_PASSWORD'),
  database: process.env.APP_DB_NAME || 'thoen_hospital_website',
  charset: 'utf8mb4',
  timezone: '+07:00',
  dateStrings: true,
  connectionLimit: 25,
  waitForConnections: true,
  queueLimit: 0,
  connectTimeout: 5000
})

// Ensure utf8mb4 on every acquired connection to bypass MariaDB global init_connect='SET NAMES tis620'
appPool.on('connection', (conn) => {
  conn.query('SET NAMES utf8mb4', () => {})
})

// ------------------------------------------------------------------
// GTW (Gotowin) Database Connection Pool (Lazy Loaded)
// ------------------------------------------------------------------
let gtwPool = null
function getGtwPool() {
  if (!gtwPool) {
    const host = process.env.GTW_DB_HOST
    const port = parseInt(process.env.GTW_DB_PORT || '15301', 10)
    const user = process.env.GTW_DB_USER
    const password = process.env.GTW_DB_PASSWORD
    const database = process.env.GTW_DB_NAME
    if (!host || !user || !password || !database) {
      throw new Error('GTW Database is not configured: Missing GTW_DB_HOST, GTW_DB_USER, GTW_DB_PASSWORD, or GTW_DB_NAME in gateway .env')
    }
    gtwPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      charset: process.env.GTW_DB_CHARSET || 'utf8mb4',
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000
    })
  }
  return gtwPool
}

// ------------------------------------------------------------------
// In-Memory Short-Lived Caching
// ------------------------------------------------------------------
const cache = new Map()
function getCached(key, ttlMs, fetcher) {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return Promise.resolve(hit.data)
  return fetcher().then(data => {
    cache.set(key, { data, expiresAt: now + ttlMs })
    if (cache.size > 500) {
      for (const [k, v] of cache.entries()) {
        if (v.expiresAt <= now) cache.delete(k)
      }
    }
    return data
  })
}

// ------------------------------------------------------------------
// Authentication Security Hook
// ------------------------------------------------------------------
const API_KEY = getRequiredEnv('GATEWAY_API_KEY')
fastify.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health' || req.url === '/' || req.url.startsWith('/docs')) return
  const clientKey = req.headers['x-api-key'] || req.query?.apiKey
  if (!clientKey || clientKey !== API_KEY) {
    reply.code(401).send({ success: false, error: 'Unauthorized: Invalid or missing x-api-key' })
  }
})

// ------------------------------------------------------------------
// Anti-Caching & Security Headers Hook (PDPA & Cloudflare Protection)
// ------------------------------------------------------------------
fastify.addHook('onSend', async (req, reply, payload) => {
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private')
  reply.header('Pragma', 'no-cache')
  reply.header('Expires', '0')
  reply.header('X-Content-Type-Options', 'nosniff')
  return payload
})

// ------------------------------------------------------------------
// Register Route Plugins
// ------------------------------------------------------------------
const routeContext = {
  pools: {
    hosPool,
    salaryPool,
    salaryEditPool,
    appPool,
    getGtwPool
  },
  getCached
}

await fastify.register(healthRoutes, routeContext)
await fastify.register(auditRoutes, routeContext)
await fastify.register(clinicalRoutes, routeContext)
await fastify.register(palliativeRoutes, routeContext)
await fastify.register(salaryRoutes, routeContext)
await fastify.register(appRoutes, routeContext)
await fastify.register(gtwRoutes, routeContext)
await fastify.register(rawSqlRoutes, routeContext)

// ------------------------------------------------------------------
// Start Server
// ------------------------------------------------------------------
const port = parseInt(process.env.PORT || '8443', 10)
const host = process.env.HOST || '0.0.0.0'
try {
  await fastify.listen({ port, host })
  console.log(`Thoen Unified API Gateway running on http://${host}:${port}`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
