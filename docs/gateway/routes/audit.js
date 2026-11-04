/**
 * Audit Log Routes (PDPA Compliance)
 * POST /api/v1/audit/log
 */
export default async function auditRoutes(fastify, options) {
  const { pools } = options;
  const { appPool } = pools;

fastify.post('/api/v1/audit/log', {
  schema: {
    tags: ['0. Health & Monitoring'],
    summary: 'บันทึกประวัติการทำรายการความปลอดภัย (Audit Log)',
    body: {
      type: 'object',
      required: ['actionType'],
      properties: {
        actionType: { type: 'string', description: 'ประเภทการกระทำ เช่น AUTH_LOGIN, VIEW_PHI, EDIT_MEMBER' },
        targetTable: { type: 'string', description: 'ชื่อตารางเป้าหมาย' },
        actionDetails: { type: 'string', description: 'รายละเอียด' },
        username: { type: 'string' },
        email: { type: 'string' },
        ipAddress: { type: 'string' },
        userAgent: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  const { actionType, targetTable = '', actionDetails = '', username = 'system', email = '', ipAddress = '', userAgent = '' } = req.body || {}
  try {
    const [result] = await appPool.query(
      'INSERT INTO audit_logs (action_type, target_table, action_details, username, email, ip_address, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [actionType, targetTable, actionDetails, username, email, ipAddress, userAgent]
    )
    return { success: true, logId: result.insertId }
  } catch (err) {
    reply.code(500); return { success: false, error: err.message }
  }
})

}
