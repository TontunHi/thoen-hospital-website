/**
 * Health Check Routes
 * GET /health
 */
export default async function healthRoutes(fastify, options) {
  const { pools } = options;
  const { hosPool, salaryPool, appPool } = pools;

fastify.get('/health', {
  schema: {
    tags: ['0. Health & Monitoring'],
    summary: 'ตรวจสอบสถานะและความเร็ว Latency ของทั้ง 3 ฐานข้อมูล'
  }
}, async (req, reply) => {
  try {
    const t0 = Date.now(); await hosPool.query('SELECT 1'); const hosMs = Date.now() - t0
    const t1 = Date.now(); await salaryPool.query('SELECT 1'); const salMs = Date.now() - t1
    const t2 = Date.now(); await appPool.query('SELECT 1'); const appMs = Date.now() - t2
    return {
      status: 'UP',
      service: 'Thoen Hospital Unified API Gateway',
      databases: {
        hosxp: { host: '192.168.1.4:3306', database: 'hos', connected: true, latencyMs: hosMs },
        salary: { host: '192.168.1.4:3306', database: 'salary', connected: true, latencyMs: salMs },
        website: { host: '192.168.1.7:3306', database: 'thoen_hospital_website', connected: true, latencyMs: appMs }
      },
      uptime: process.uptime()
    }
  } catch (err) {
    reply.code(503); return { status: 'DOWN', error: err.message }
  }
})

}
