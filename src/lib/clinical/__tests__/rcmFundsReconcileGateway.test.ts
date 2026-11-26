import { describe, it, expect, vi, beforeEach } from 'vitest'
import rcmFundsReconcileRoutes from '../../../../docs/gateway/routes/rcmFundsReconcile.js'

interface MockRouteEntry {
  handler: (req: any, reply: any) => Promise<any>
}

function createMockFastify() {
  const routes = new Map<string, MockRouteEntry>()
  const hooks = new Map<string, Array<() => Promise<void>>>()
  return {
    routes,
    hooks,
    log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    get(path: string, _opts: any, handler: (req: any, reply: any) => Promise<any>) {
      routes.set(path, { handler })
    },
    addHook(name: string, fn: () => Promise<void>) {
      const list = hooks.get(name) || []
      list.push(fn)
      hooks.set(name, list)
    },
  }
}

function createMockReply() {
  const state = { statusCode: 200 }
  return {
    state,
    code(c: number) {
      state.statusCode = c
      return this
    },
  }
}

describe('Gateway rcmFundsReconcileRoutes (Optimized SQL, Selective Enrichment, Caching)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupMockGateway(options: { enablePrewarm?: boolean } = {}) {
    const executedSql: Array<{ sql: string; params: any[] }> = []

    const hosPool = {
      query: vi.fn(async (sql: string, params: any[] = []) => {
        executedSql.push({ sql, params })

        if (sql.includes('FROM s_drugitems')) {
          return [[{ icode: 'IC_CLOP', adp_code: '37999771001' }], []]
        }
        if (sql.includes('FROM nondrugitems')) {
          return [[{ icode: 'IC_INST', adp_code: '', nhso_adp_type_id: 2 }], []]
        }
        if (sql.includes('FROM rcmdb.seamless') && !sql.includes('WHERE VN = ?')) {
          return [[
            {
              id: 10,
              rep: 'DCCS69010001',
              fund: 'ระบบบริการตรวจคัดกรองมะเร็งปากมดลูก',
              subfund: 'OP',
              period: '6901',
              vn: '6901010001',
              an: null,
              hn: '000001',
              cid: '1100000000001',
              ptname: 'นาง สมร คัดกรอง',
              admdate: '2026-10-10',
              department: 'OP',
              main_inscl: 'UCS',
              income: 350,
              compensated: 350,
              error_code: null,
              seamless_status: 'จ่ายแล้ว',
              pay_no: 'P001',
              pay_date: '2026-10-20',
              stmid: 'STM1',
              file_name: 'SM.xlsx',
            },
          ], []]
        }
        if (sql.includes('FROM rcmdb.repdata') && !sql.includes('WHERE VN = ?')) {
          return [[
            // Explicit keyword match (CANCER) -> needs lightweight cid only
            {
              id: 21,
              rep: '691000201',
              hn: '000002',
              vn: '6901010002',
              an: null,
              eclaim_no: 'EC201',
              ptname: 'นาย กฤษณะ มะเร็ง',
              admdate: '2026-10-12',
              department: 'OP',
              main_inscl: 'UCS',
              fund: 'CANCER',
              subfund: 'OP',
              project_code: null,
              income: 2000,
              compensated: 1800,
              error_code: null,
              appeal: 'N',
              file_name: 'REP201.xls',
            },
            // Generic UCS -> needs full classification (vn_stat + opitemrece) + cid
            {
              id: 22,
              rep: '691000202',
              hn: '000003',
              vn: '6901010003',
              an: null,
              eclaim_no: 'EC202',
              ptname: 'นาย ขจร หัวใจ',
              admdate: '2026-10-15',
              department: 'OP',
              main_inscl: 'UCS',
              fund: 'UCS',
              subfund: 'OP',
              project_code: null,
              income: 1200,
              compensated: 1000,
              error_code: null,
              appeal: 'N',
              file_name: 'REP202.xls',
            },
            // Pending REP row (no rep number)
            {
              id: 23,
              rep: '',
              hn: '000004',
              vn: '6901010004',
              an: null,
              eclaim_no: 'EC204',
              ptname: 'นาง คคนางค์ รอตอบรับ',
              admdate: '2026-10-16',
              department: 'OP',
              main_inscl: 'UCS',
              fund: 'UCS',
              subfund: 'OP',
              project_code: null,
              income: 500,
              compensated: 0,
              error_code: null,
              appeal: 'N',
              file_name: 'EC204.xls',
            },
          ], []]
        }
        if (sql.includes('FROM rcmdb.repeclaim') && !sql.includes('WHERE VN = ?')) {
          return [[], []]
        }
        // Full ovst + vn_stat query for unclassified VNs
        if (sql.includes('FROM ovst o') && sql.includes('vn_stat')) {
          const rows = (params as string[]).map((vn) => ({
            visit_key: vn,
            cid: vn === '6901010003' ? '1100000000003' : '1100000000004',
            ptname: vn === '6901010003' ? 'นาย ขจร หัวใจ' : 'นาง คคนางค์ รอตอบรับ',
            pttype_name: 'บัตรทอง UC',
            export_code: '',
            pdx: 'I251',
            dx0: null,
            dx1: null,
            dx2: null,
            dx3: null,
            dx4: null,
            dx5: null,
          }))
          return [rows, []]
        }
        // Lightweight ovst + patient cid-only query for explicit-fund VNs missing cid
        if (sql.includes('FROM ovst o') && !sql.includes('vn_stat') && sql.includes('o.vn IN')) {
          const rows = (params as string[]).map((vn) => ({
            visit_key: vn,
            cid: '1100000000099',
            ptname: 'นาย กฤษณะ มะเร็ง',
          }))
          return [rows, []]
        }
        // opitemrece query for unclassified VNs
        if (sql.includes('FROM opitemrece oo') && sql.includes('oo.vn IN')) {
          return [[{ visit_key: '6901010003', icode: 'IC_CLOP' }], []]
        }
        // vn-details queries
        if (sql.includes('WHERE o.vn = ? LIMIT 1')) {
          return [[{ vn: params[0], hn: '000003', cid: '1100000000003', ptname: 'นาย ขจร หัวใจ', admdate: '2026-10-15', pttype_name: 'UC', pdx: 'I251' }], []]
        }
        if (sql.includes('WHERE i.an = ? LIMIT 1')) {
          return [[], []]
        }
        if (sql.includes('FROM opitemrece oo') && sql.includes('UNION ALL')) {
          return [[{ icode: 'IC_CLOP', name: 'Clopidogrel', adp_code: '37999771001', qty: 30, sum_price: 1200 }], []]
        }
        if (sql.includes('FROM rcmdb.repdata WHERE VN = ?')) {
          return [[{ rep: '691000202', fund: 'UCS', subfund: 'OP', income: 1200, compensated: 1000, error_code: null, appeal: 'N', eclaim_no: 'EC202', file_name: 'REP202.xls', hn: '000003', ptname: 'นาย ขจร หัวใจ', admdate: '2026-10-15' }], []]
        }
        if (sql.includes('FROM rcmdb.repeclaim WHERE VN = ?')) {
          return [[], []]
        }
        if (sql.includes('FROM rcmdb.seamless WHERE VN = ?')) {
          return [[], []]
        }
        return [[], []]
      }),
    }

    const fastify = createMockFastify()
    const localCache = new Map<string, any>()
    const getCached = async (key: string, _ttl: number, fetcher: () => Promise<any>) => {
      if (localCache.has(key)) return localCache.get(key)
      const val = await fetcher()
      localCache.set(key, val)
      return val
    }

    return { fastify, hosPool, getCached, executedSql, enablePrewarm: options.enablePrewarm }
  }

  it('uses UNION ALL without ORDER BY for repdata/repeclaim and selectively enriches only non-explicit visits while preserving cid', async () => {
    const ctx = setupMockGateway({ enablePrewarm: false })
    await rcmFundsReconcileRoutes(ctx.fastify, {
      pools: { hosPool: ctx.hosPool },
      getCached: ctx.getCached,
      enablePrewarm: false,
    })

    const handler = ctx.fastify.routes.get('/api/v1/clinical/rcm/funds-rep-reconcile')!.handler
    const reply = createMockReply()
    const res = await handler({ query: { ds1: '2026-10-01', ds2: '2026-10-31' } }, reply)

    expect(reply.state.statusCode).toBe(200)
    expect(res.success).toBe(true)
    // 3 non-pending lines (DCCS, CANCER, UCS->clopidogrel)
    expect(res.data.totalCount).toBe(3)
    expect(res.data.summary.totalCompensated).toBe(3150)

    // Verify SQL optimizations on repdata/repeclaim/seamless
    const repdataQuery = ctx.executedSql.find((q) => q.sql.includes('FROM rcmdb.repdata') && !q.sql.includes('WHERE VN = ?'))!
    expect(repdataQuery.sql).toContain('UNION ALL')
    expect(repdataQuery.sql).not.toContain('OR (AdmDate IS NULL')
    expect(repdataQuery.sql).not.toContain('ORDER BY AdmDate DESC')

    const seamlessQuery = ctx.executedSql.find((q) => q.sql.includes('FROM rcmdb.seamless') && !q.sql.includes('WHERE VN = ?'))!
    expect(seamlessQuery.sql).not.toContain('ORDER BY AdmDate DESC')

    // Verify selective enrichment:
    // 1) Seamless 6901010001 (explicit + already has cid) is NOT in ovst or opitemrece
    // 2) CANCER 6901010002 (explicit, missing cid) is ONLY in lightweight ovst+patient, NOT in vn_stat or opitemrece
    // 3) UCS 6901010003 & pending 6901010004 are in full vn_stat + opitemrece (without DISTINCT)
    const fullOvstQuery = ctx.executedSql.find((q) => q.sql.includes('FROM ovst o') && q.sql.includes('vn_stat'))!
    expect(fullOvstQuery.params).not.toContain('6901010001')
    expect(fullOvstQuery.params).not.toContain('6901010002')
    expect(fullOvstQuery.params).toContain('6901010003')

    const cidOnlyQuery = ctx.executedSql.find((q) => q.sql.includes('FROM ovst o') && !q.sql.includes('vn_stat'))!
    expect(cidOnlyQuery.params).toEqual(['6901010002'])

    const opitemQuery = ctx.executedSql.find((q) => q.sql.includes('FROM opitemrece oo'))!
    expect(opitemQuery.sql).not.toContain('SELECT DISTINCT')
    expect(opitemQuery.params).not.toContain('6901010001')
    expect(opitemQuery.params).not.toContain('6901010002')
    expect(opitemQuery.params).toContain('6901010003')

    // Verify cid was preserved on explicit-fund repdata line and classification still works
    const cancerItem = res.data.items.find((i: any) => i.vn === '6901010002')
    expect(cancerItem.primaryFundId).toBe('cancer')
    expect(cancerItem.cid).toBe('1100000000099')

    const clopItem = res.data.items.find((i: any) => i.vn === '6901010003')
    expect(clopItem.primaryFundId).toBe('clopidogrel')
    expect(clopItem.cid).toBe('1100000000003')
  })

  it('reuses unified base cache for includePendingRep=true, filter cache for pagination, and invalidates on refresh=true', async () => {
    const ctx = setupMockGateway({ enablePrewarm: false })
    await rcmFundsReconcileRoutes(ctx.fastify, {
      pools: { hosPool: ctx.hosPool },
      getCached: ctx.getCached,
      enablePrewarm: false,
    })

    const handler = ctx.fastify.routes.get('/api/v1/clinical/rcm/funds-rep-reconcile')!.handler

    // 1. Initial load (default includePendingRep=false)
    const r1 = await handler({ query: { ds1: '2026-10-01', ds2: '2026-10-31', page: '1', pageSize: '2' } }, createMockReply())
    expect(r1.data.totalCount).toBe(3)
    expect(r1.data.items).toHaveLength(2)
    expect(r1.data.summary.totalCompensated).toBe(3150)
    const queriesAfterFirst = ctx.executedSql.length

    // 2. Toggle includePendingRep=true -> ZERO additional SQL queries!
    const r2 = await handler({ query: { ds1: '2026-10-01', ds2: '2026-10-31', includePendingRep: 'true', page: '1', pageSize: '50' } }, createMockReply())
    expect(ctx.executedSql.length).toBe(queriesAfterFirst)
    expect(r2.data.totalCount).toBe(4)
    expect(r2.data.summary.pendingRepCount).toBe(1)

    // 3. Pagination page=2 -> hits filter cache, ZERO SQL queries, preserves full summary
    const r3 = await handler({ query: { ds1: '2026-10-01', ds2: '2026-10-31', page: '2', pageSize: '2' } }, createMockReply())
    expect(ctx.executedSql.length).toBe(queriesAfterFirst)
    expect(r3.data.items).toHaveLength(1)
    expect(r3.data.summary.totalCompensated).toBe(3150)

    // 4. Search by cid of explicit-fund repdata row -> works via precomputed searchTexts
    const r4 = await handler({ query: { ds1: '2026-10-01', ds2: '2026-10-31', search: '1100000000099' } }, createMockReply())
    expect(ctx.executedSql.length).toBe(queriesAfterFirst)
    expect(r4.data.totalCount).toBe(1)
    expect(r4.data.items[0].vn).toBe('6901010002')

    // 5. Sort by ptname asc
    const r5 = await handler({ query: { ds1: '2026-10-01', ds2: '2026-10-31', sortBy: 'ptname', sortOrder: 'asc' } }, createMockReply())
    expect(ctx.executedSql.length).toBe(queriesAfterFirst)
    expect(r5.data.items).toHaveLength(3)

    // 6. Force refresh -> re-queries DB
    await handler({ query: { ds1: '2026-10-01', ds2: '2026-10-31', refresh: 'true' } }, createMockReply())
    expect(ctx.executedSql.length).toBeGreaterThan(queriesAfterFirst)
  })

  it('uses UNION ALL without OR in vn-details endpoint', async () => {
    const ctx = setupMockGateway({ enablePrewarm: false })
    await rcmFundsReconcileRoutes(ctx.fastify, {
      pools: { hosPool: ctx.hosPool },
      getCached: ctx.getCached,
      enablePrewarm: false,
    })

    const detailHandler = ctx.fastify.routes.get('/api/v1/clinical/rcm/funds-rep-reconcile/vn-details')!.handler
    const reply = createMockReply()
    const res = await detailHandler({ query: { vn: '6901010003' } }, reply)

    expect(reply.state.statusCode).toBe(200)
    expect(res.success).toBe(true)
    expect(res.data.adpItems).toHaveLength(1)
    expect(res.data.allRepLines).toHaveLength(1)

    const opitemDetailSql = ctx.executedSql.find((q) => q.sql.includes('FROM opitemrece oo') && q.sql.includes('UNION ALL'))!
    expect(opitemDetailSql.sql).not.toContain('oo.vn = ? OR oo.an = ?')

    const repdataDetailSql = ctx.executedSql.find((q) => q.sql.includes('FROM rcmdb.repdata WHERE VN = ?'))!
    expect(repdataDetailSql.sql).toContain('UNION ALL')
    expect(repdataDetailSql.sql).not.toContain('WHERE VN = ? OR AN = ?')
  })

  it('registers onClose hook when prewarm is enabled and cleans up without error', async () => {
    const ctx = setupMockGateway({ enablePrewarm: true })
    await rcmFundsReconcileRoutes(ctx.fastify, {
      pools: { hosPool: ctx.hosPool },
      getCached: ctx.getCached,
      enablePrewarm: true,
    })

    const closeHooks = ctx.fastify.hooks.get('onClose') || []
    expect(closeHooks.length).toBeGreaterThan(0)
    for (const h of closeHooks) {
      await expect(h()).resolves.toBeUndefined()
    }
  })
})
