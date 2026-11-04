/**
 * GTW (Gotowin) Integration Services
 * Article Sync
 */
export default async function gtwRoutes(fastify, options) {
  const { pools } = options;
  const { getGtwPool } = pools;

fastify.get('/api/v1/gtw/articles', {
  schema: {
    tags: ['5. GTW Integration Services'],
    summary: 'ดึงข้อมูลครุภัณฑ์จากฐานข้อมูล Gotowin (GTW Articles)',
    querystring: {
      type: 'object',
      properties: {
        limit: { type: 'integer' },
        offset: { type: 'integer' },
        since: { type: 'string' }
      }
    }
  }
}, async (req, reply) => {
  try {
    const pool = getGtwPool()
    const { limit, offset, since } = req.query || {}
    let sql = `
      SELECT 
        a.ARTICLE_ID,
        a.ARTICLE_NUM,
        COALESCE(a.SUP_FSN, s.SUP_FSN_NUM) as SUP_FSN,
        a.ARTICLE_NAME,
        a.ARTICLE_MODELS,
        a.SERIAL_NO,
        a.RECEIVE_DATE,
        a.INS_START_DATE,
        a.INS_END_DATE,
        a.EXPIRE_DATE,
        a.PRICE_PER_UNIT,
        a.VENDOR_ID,
        a.DOC_NO_NUM,
        a.DEP_SUB_SUB_NAME,
        a.LOCATEDEPT,
        a.STATUS_ID,
        a.STATUS_DELETE,
        a.updated_at
      FROM asset_article a
      LEFT JOIN supplies s ON a.SUP_ID = s.ID
      WHERE a.ARTICLE_NUM IS NOT NULL 
        AND a.ARTICLE_NUM != ''
        AND (a.STATUS_DELETE = 'false' OR a.STATUS_DELETE IS NULL)
    `
    const params = []
    if (since) {
      sql += ' AND a.updated_at >= ?'
      params.push(since)
    }
    sql += ' ORDER BY a.ARTICLE_ID DESC'
    if (limit) {
      sql += ' LIMIT ?'
      params.push(Number(limit))
      if (offset) {
        sql += ' OFFSET ?'
        params.push(Number(offset))
      }
    }
    const [rows] = await pool.query(sql, params)
    return { success: true, count: rows.length, data: rows }
  } catch (err) {
    const status = err.message.includes('not configured') ? 503 : 500
    reply.code(status)
    return { success: false, error: err.message }
  }
})

}
