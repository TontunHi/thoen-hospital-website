// Thoen Hospital API Gateway Plugin: Salary Portal Member Lookups & Access Verification
// Uses appPool for member salary linking, finance upload RBAC, and feature flag check.

export default async function salaryPortalRoutes(fastify, { pools }) {
  const { appPool } = pools

  // 1. Lookup member by username or salary_user (omits password fields)
  fastify.get('/api/v1/salary/member-lookup', {
    schema: {
      tags: ['07. Salary & Finance Portal'],
      summary: 'ค้นหาข้อมูลสมาชิกสำหรับสลิปเงินเดือนด้วย username หรือ salary_user',
    }
  }, async (req, reply) => {
    try {
      const target = String(req.query?.target || '').trim()
      if (!target) {
        reply.code(400)
        return { success: false, error: 'target parameter is required' }
      }
      const [rows] = await appPool.query(
        'SELECT id, username, email, name, department, position, salary_user FROM members WHERE username = ? OR salary_user = ? LIMIT 1',
        [target, target]
      )
      return { success: true, data: rows?.[0] || null }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 2. Fetch stored salary credentials for a verified member session
  fastify.post('/api/v1/salary/member-credentials', {
    schema: {
      tags: ['07. Salary & Finance Portal'],
      summary: 'ดึง salary_user / salary_pass ที่ผูกกับสมาชิก',
    }
  }, async (req, reply) => {
    try {
      const username = String(req.body?.username || '').trim()
      const email = String(req.body?.email || '').trim()
      if (!username || !email) {
        reply.code(400)
        return { success: false, error: 'username and email are required' }
      }
      const [rows] = await appPool.query(
        'SELECT salary_user, salary_pass FROM members WHERE username = ? AND email = ? LIMIT 1',
        [username, email]
      )
      return { success: true, data: rows?.[0] || null }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 3. Verify finance upload access (admin, finance position, or upload_salary permission)
  fastify.post('/api/v1/salary/verify-finance-access', {
    schema: {
      tags: ['07. Salary & Finance Portal'],
      summary: 'ตรวจสอบสิทธิ์อัปโหลดข้อมูลเงินเดือน/ค่าเวร',
    }
  }, async (req, reply) => {
    try {
      const username = String(req.body?.username || '').trim()
      const email = String(req.body?.email || '').trim()
      if (!username || !email) {
        return { success: true, data: { allowed: false, error: 'ไม่พบข้อมูลสมาชิกในระบบ', status: 403 } }
      }
      const [users] = await appPool.query(
        'SELECT role, position FROM members WHERE username = ? AND email = ? LIMIT 1',
        [username, email]
      )
      if (!users || users.length === 0) {
        return { success: true, data: { allowed: false, error: 'ไม่พบข้อมูลสมาชิกในระบบ', status: 403 } }
      }
      const member = users[0]
      let isFinance =
        member.role === 'admin' ||
        Boolean(member.position && String(member.position).includes('เจ้าพนักงานการเงินและบัญชี'))

      if (!isFinance && member.position) {
        const [finPerms] = await appPool.query(
          "SELECT COUNT(*) as count FROM position_permissions WHERE permission_key = 'upload_salary' AND TRIM(position_name) = TRIM(?)",
          [member.position]
        )
        isFinance = Number(finPerms?.[0]?.count || 0) > 0
      }

      if (!isFinance) {
        return { success: true, data: { allowed: false, error: 'คุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้', status: 403 } }
      }
      return { success: true, data: { allowed: true } }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 4. Check whether feature_salary is enabled in member_system_settings
  fastify.get('/api/v1/salary/feature-enabled', {
    schema: {
      tags: ['07. Salary & Finance Portal'],
      summary: 'ตรวจสอบสถานะเปิดใช้งานระบบสลิปเงินเดือน',
    }
  }, async (_req, reply) => {
    try {
      const [rows] = await appPool.query(
        "SELECT config_value FROM member_system_settings WHERE config_key = 'feature_salary' LIMIT 1"
      )
      const enabled = !rows || rows.length === 0 || rows[0].config_value !== '0'
      return { success: true, data: { enabled } }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })
}
