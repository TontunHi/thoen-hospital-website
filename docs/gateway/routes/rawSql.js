/**
 * Raw SQL Endpoints (Quarantined for Phase 2 Deprecation)
 * - /api/v1/clinical/query
 * - /api/v1/salary/query, /api/v1/salary/execute
 * - /api/v1/app/query, /api/v1/app/execute, /api/v1/app/transaction
 */
export default async function rawSqlRoutes(fastify, options) {
  const { pools } = options;
  const { hosPool, salaryPool, appPool } = pools;

// 1.13 Universal Read-Only Query for HOSxP
fastify.post('/api/v1/clinical/query', {
  schema: {
    tags: ['1. Clinical Services (HOSxP)'],
    summary: 'Universal Read-Only Query สำหรับดึงตารางใดก็ได้ใน HOSxP (เฉพาะ SELECT)',
    body: {
      type: 'object',
      required: ['sql'],
      properties: {
        sql: { type: 'string', description: 'คำสั่ง SELECT SQL' },
        params: { type: 'array', description: 'พารามิเตอร์ binding ป้องกัน SQL Injection' }
      }
    }
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('EXPLAIN') && !trimmed.startsWith('SHOW')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only SELECT/EXPLAIN queries allowed' }
  }
  if (/;\s*\S/.test(sql)) {
    reply.code(403); return { success: false, error: 'Forbidden: Multi-statements not allowed' }
  }
  try {
    const [rows] = await hosPool.query(sql, params)
    return { success: true, count: Array.isArray(rows) ? rows.length : 1, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})


fastify.post('/api/v1/salary/query', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'Universal Read-Only Query สำหรับฐานข้อมูล salary'
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('EXPLAIN') && !trimmed.startsWith('SHOW')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only SELECT/EXPLAIN queries allowed' }
  }
  try {
    const [rows] = await salaryPool.query(sql, params)
    return { success: true, count: Array.isArray(rows) ? rows.length : 1, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 2.7 Parameterized Execute for Salary DB (INSERT / UPDATE / DELETE) - PERMANENTLY DISABLED (HTTP 410 Gone)
fastify.post('/api/v1/salary/execute', {
  schema: {
    tags: ['2. Salary Services'],
    summary: 'Universal Parameterized Execute สำหรับฐานข้อมูล salary (INSERT / UPDATE / DELETE) [DEPRECATED & DISABLED]'
  }
}, async (req, reply) => {
  reply.code(410).send({
    success: false,
    error: 'This raw SQL endpoint has been permanently deprecated and disabled (HTTP 410 Gone). Please migrate to the designated Named API.'
  })
})


// 4.10 Universal Read-Only Query for Website DB
fastify.post('/api/v1/app/query', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'Universal Read-Only Query สำหรับฐานข้อมูล thoen_hospital_website (เฉพาะ SELECT)'
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  const trimmed = sql.trim().toUpperCase()
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('EXPLAIN') && !trimmed.startsWith('SHOW')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only SELECT/EXPLAIN queries allowed' }
  }
  try {
    const [rows] = await appPool.query(sql, params)
    return { success: true, count: Array.isArray(rows) ? rows.length : 1, data: rows }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.10 Universal Parameterized Execute (INSERT / UPDATE / DELETE)
fastify.post('/api/v1/app/execute', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'Universal Parameterized Execute สำหรับคำสั่งแก้ไขข้อมูล (INSERT / UPDATE / DELETE)',
    body: {
      type: 'object',
      required: ['sql'],
      properties: {
        sql: { type: 'string', description: 'คำสั่ง INSERT, UPDATE หรือ DELETE' },
        params: { type: 'array', description: 'พารามิเตอร์ binding' }
      }
    }
  }
}, async (req, reply) => {
  const { sql, params = [] } = req.body || {}
  if (!sql || typeof sql !== 'string') { reply.code(400); return { success: false, error: 'SQL query required' } }
  if (sql.includes(';')) {
    reply.code(403); return { success: false, error: 'Forbidden: Multi-statements / semicolons are not allowed' }
  }
  const trimmed = sql.trim().toUpperCase()
  const forbiddenKeywords = ['DROP ', 'TRUNCATE ', 'ALTER ', 'GRANT ', 'REVOKE ', 'CREATE USER']
  if (forbiddenKeywords.some(kw => trimmed.includes(kw))) {
    reply.code(403); return { success: false, error: 'Forbidden: DDL operations are not allowed' }
  }
  if (!trimmed.startsWith('INSERT') && !trimmed.startsWith('UPDATE') && !trimmed.startsWith('DELETE')) {
    reply.code(403); return { success: false, error: 'Forbidden: Only INSERT/UPDATE/DELETE queries allowed' }
  }
  try {
    const [res] = await appPool.query(sql, params)
    return {
      success: true,
      affectedRows: res.affectedRows,
      insertId: res.insertId || null
    }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

// 4.11 Universal Interactive Transaction for Multi-step Operations
fastify.post('/api/v1/app/transaction', {
  schema: {
    tags: ['4. Website Application Services'],
    summary: 'Universal Transaction สำหรับคำสั่งหลายรายการที่ต้องทำพร้อมกันแบบ Atomic (Rollback อัตโนมัติเมื่อผิดพลาด)',
    body: {
      type: 'object',
      required: ['statements'],
      properties: {
        statements: {
          type: 'array',
          items: {
            type: 'object',
            required: ['sql'],
            properties: {
              sql: { type: 'string' },
              params: { type: 'array' }
            }
          }
        }
      }
    }
  }
}, async (req, reply) => {
  const { statements } = req.body || {}
  if (!Array.isArray(statements) || statements.length === 0) {
    reply.code(400); return { success: false, error: 'Statements array required' }
  }
  const connection = await appPool.getConnection()
  try {
    await connection.beginTransaction()
    const results = []
    for (const stmt of statements) {
      const [res] = await connection.query(stmt.sql, stmt.params || [])
      results.push({ affectedRows: res.affectedRows, insertId: res.insertId || null })
    }
    await connection.commit()
    return { success: true, count: results.length, results }
  } catch (err) {
    await connection.rollback()
    reply.code(500); return { success: false, error: err.message }
  } finally {
    connection.release()
  }
})


}
