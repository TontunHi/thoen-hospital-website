// Thoen Hospital API Gateway Plugin: Seamless Visit Enrichment + Enhanced Fund V2 Endpoints
// Serves /api/v1/clinical/rcm/seamless/enrich-visits and upgraded /api/v1/clinical/rcm/funds-v2/*

export default async function rcmSeamlessAndFundsV2Routes(fastify, { pools, getCached }) {
  const { hosPool } = pools

  async function runChunked(items, chunkSize, fn) {
    const out = []
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize)
      const rows = await fn(chunk)
      if (Array.isArray(rows)) out.push(...rows)
    }
    return out
  }

  // 1. Batch Seamless REP enrichment for VN / AN arrays (replaces client-side chunked SQL in rcmSeamlessEnricher.ts)
  fastify.post('/api/v1/clinical/rcm/seamless/enrich-visits', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ดึงเลข REP และยอดชดเชยจาก rcmdb.seamless สำหรับชุด VN / AN (Batch Enrichment)',
    }
  }, async (req, reply) => {
    try {
      const vns = Array.isArray(req.body?.vns)
        ? Array.from(new Set(req.body.vns.map((v) => String(v || '').trim()).filter((v) => v && v !== '-' && v !== '—')))
        : []
      const ans = Array.isArray(req.body?.ans)
        ? Array.from(new Set(req.body.ans.map((v) => String(v || '').trim()).filter((v) => v && v !== '-' && v !== '—')))
        : []

      const queryCol = async (col, keys) => {
        if (keys.length === 0) return []
        return runChunked(keys, 1500, async (chunk) => {
          const ph = chunk.map(() => '?').join(',')
          const [rows] = await hosPool.query(
            `SELECT
              ${col} AS k,
              Rep AS rep,
              GROUP_CONCAT(DISTINCT Fund ORDER BY Fund SEPARATOR ', ') AS fund,
              GROUP_CONCAT(DISTINCT Type ORDER BY Type SEPARATOR ', ') AS type,
              SUM(IFNULL(Collected, 0)) AS collected,
              SUM(IFNULL(Compensated, 0)) AS compensated,
              GROUP_CONCAT(DISTINCT Rep ORDER BY Rep SEPARATOR ',') AS rep_seamless,
              GROUP_CONCAT(DISTINCT Fund ORDER BY Fund SEPARATOR ',') AS seamless_funds,
              SUM(IFNULL(Compensated, 0)) AS compensated_seamless
            FROM rcmdb.seamless
            WHERE ${col} IN (${ph})
              AND IFNULL(Rep, '') <> ''
            GROUP BY ${col}, Rep
            ORDER BY Rep ASC`,
            chunk
          )
          return rows || []
        })
      }

      const [vnRows, anRows] = await Promise.all([
        queryCol('VN', vns),
        queryCol('AN', ans),
      ])

      return { success: true, data: { vnRows, anRows } }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 2. Enhanced ADP Mapping lookup across both s_drugitems and nondrugitems (supports comma-separated codes + refresh)
  fastify.get('/api/v1/clinical/rcm/funds/adp-mapping-v2/:adpCode', {
    schema: {
      tags: ['1. Clinical Services (HOSxP)'],
      summary: 'ตรวจสอบการผูก NHSO ADP Code ทั้ง s_drugitems และ nondrugitems (รองรับ refresh)',
    }
  }, async (req, reply) => {
    try {
      const cleanAdpCode = String(req.params?.adpCode || '').trim()
      if (!cleanAdpCode) {
        reply.code(400)
        return { success: false, error: 'adpCode is required' }
      }
      const includeNonDrug = req.query?.includeNonDrug === 'true' || req.query?.includeNonDrug === '1'
      const forceRefresh = req.query?.refresh === 'true' || req.query?.refresh === '1'
      const codes = cleanAdpCode.split(',').map((s) => s.trim()).filter(Boolean)
      const ph = codes.map(() => '?').join(',')

      const fetchMapping = async () => {
        const sql = includeNonDrug
          ? `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${ph})
             UNION
             SELECT icode, name, NULL AS strength, nhso_adp_code FROM nondrugitems WHERE TRIM(nhso_adp_code) IN (${ph})
             ORDER BY nhso_adp_code ASC, icode ASC`
          : `SELECT icode, name, strength, nhso_adp_code FROM s_drugitems WHERE TRIM(nhso_adp_code) IN (${ph}) ORDER BY nhso_adp_code ASC, icode ASC`
        const params = includeNonDrug ? [...codes, ...codes] : codes
        const [rows] = await hosPool.query(sql, params)
        return {
          adpCode: cleanAdpCode,
          isMapped: (rows || []).length > 0,
          mappedCount: (rows || []).length,
          items: rows || [],
        }
      }

      const data = forceRefresh
        ? await fetchMapping()
        : await getCached(`rcm-adp-map-v2-${cleanAdpCode}-${includeNonDrug ? 'both' : 'drug'}`, 600_000, fetchMapping)
      return { success: true, ...data }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })
}
