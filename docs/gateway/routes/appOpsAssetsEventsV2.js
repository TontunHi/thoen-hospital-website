/**
 * Phase 4B: Hospital Assets, Equipment Borrowing & Hospital Events / Leaderboard Routes
 * Zero-SQL Named Endpoints for thoen-api-gateway-v2
 */

async function withUtf8Conn(pool, fn) {
  const conn = await pool.getConnection()
  try {
    await conn.query('SET NAMES utf8mb4')
    return await fn(conn)
  } finally {
    conn.release()
  }
}

async function withUtf8Tx(pool, fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query('SET NAMES utf8mb4')
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    try { await conn.rollback() } catch {}
    throw err
  } finally {
    conn.release()
  }
}

const ASSET_SELECT_SQL = `
  SELECT
    a.id, a.article_num AS articleNum, a.fsn_num AS fsnNum, a.name, a.brand, a.model, a.serial_no AS serialNo,
    a.category, a.location_id AS locationId, a.location_full_name AS locationFullName, a.department,
    a.custodian_id AS custodianId, a.received_date AS receivedDate, a.warranty_start_date AS warrantyStartDate,
    a.warranty_end_date AS warrantyEndDate, a.expire_date AS expireDate, a.price, a.vendor_name AS vendorName,
    a.vendor_contact AS vendorContact, a.contract_no AS contractNo, a.status, a.image_url AS imageUrl,
    a.notes, a.is_loanable AS isLoanable, a.created_at AS createdAt, a.updated_at AS updatedAt,
    l.id AS loc_id, l.room_name AS loc_room_name, l.floor_name AS loc_floor_name, l.building_name AS loc_building_name, l.full_name AS loc_full_name,
    m.id AS cust_id, m.name AS cust_name, m.position AS cust_position, m.department AS cust_department
  FROM hospital_assets a
  LEFT JOIN hospital_locations l ON a.location_id = l.id
  LEFT JOIN members m ON a.custodian_id = m.id
`

const BORROW_ITEMS_JOIN_SQL = `
  SELECT
    i.*,
    a.name AS asset_name, a.brand AS asset_brand, a.article_num AS asset_code, a.image_url AS asset_image_url,
    m.name AS mat_name, m.unit AS mat_unit, m.material_type AS mat_type, m.image_url AS mat_image_url
  FROM equipment_borrow_items i
  LEFT JOIN hospital_assets a ON i.asset_id = a.id
  LEFT JOIN hospital_materials m ON i.material_id = m.id
`

async function loadBorrowRequestFull(pool, id) {
  const [reqRows] = await pool.query('SELECT * FROM equipment_borrow_requests WHERE id = ? LIMIT 1', [id])
  if (!reqRows || reqRows.length === 0) return null
  const [itemRows] = await pool.query(`${BORROW_ITEMS_JOIN_SQL} WHERE i.request_id = ?`, [id])
  return { request: reqRows[0], items: itemRows || [] }
}

async function attachBorrowItemsToRequests(pool, reqRows) {
  if (!reqRows || reqRows.length === 0) return []
  const ids = reqRows.map((r) => r.id)
  const ph = ids.map(() => '?').join(', ')
  const [allItems] = await pool.query(`${BORROW_ITEMS_JOIN_SQL} WHERE i.request_id IN (${ph})`, ids)
  const byReq = new Map()
  for (const it of allItems || []) {
    const arr = byReq.get(it.request_id) || []
    arr.push(it)
    byReq.set(it.request_id, arr)
  }
  return reqRows.map((r) => ({ request: r, items: byReq.get(r.id) || [] }))
}

export default async function appOpsAssetsEventsV2Routes(fastify, opts) {
  const appPool = opts.appPool || opts.pools?.appPool

  // =========================================================================
  // 1. HOSPITAL ASSETS V2
  // =========================================================================

  fastify.get('/api/v1/app/v2/assets', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายการครุภัณฑ์ทั้งหมดพร้อมตัวกรองและค้นหา (V2)' } }, async (req, reply) => {
    try {
      const { search, category, warrantyStatus, department, status, sortBy = 'receivedDate', sortOrder = 'desc' } = req.query || {}
      const page = Math.max(1, Number(req.query?.page || 1))
      const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 20)))
      const skip = (page - 1) * limit
      const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'

      const where = []
      const params = []
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`
        where.push(`(a.article_num LIKE ? OR a.fsn_num LIKE ? OR a.name LIKE ? OR a.model LIKE ? OR a.brand LIKE ? OR a.serial_no LIKE ? OR a.department LIKE ? OR a.location_full_name LIKE ?)`)
        params.push(q, q, q, q, q, q, q, q)
      }
      if (category && category !== 'ALL') { where.push('a.category = ?'); params.push(category) }
      if (status && status !== 'ALL') { where.push('a.status = ?'); params.push(status) }
      if (department && department !== 'ALL') { where.push('a.department = ?'); params.push(department) }
      if (warrantyStatus === 'ACTIVE') {
        where.push('(a.warranty_end_date >= NOW() OR (a.warranty_end_date IS NULL AND a.expire_date >= NOW()))')
      } else if (warrantyStatus === 'EXPIRED') {
        where.push('(a.warranty_end_date < NOW() OR (a.warranty_end_date IS NULL AND a.expire_date < NOW()))')
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

      let sortSql = 'a.received_date DESC, a.id DESC'
      if (sortBy === 'receivedDate') sortSql = `a.received_date ${dir}, a.id ${dir}`
      else if (sortBy === 'createdAt') sortSql = `a.created_at ${dir}, a.id ${dir}`
      else if (sortBy === 'price') sortSql = `a.price ${dir}, a.id DESC`
      else if (sortBy === 'articleNum') sortSql = `a.article_num ${dir}, a.id DESC`
      else if (sortBy === 'name') sortSql = `a.name ${dir}, a.id DESC`
      else if (sortBy === 'warrantyEndDate') sortSql = `a.warranty_end_date ${dir}, a.id DESC`

      const [[countRows], [itemRows]] = await Promise.all([
        appPool.query(`SELECT COUNT(*) AS total FROM hospital_assets a ${whereSql}`, params),
        appPool.query(`${ASSET_SELECT_SQL} ${whereSql} ORDER BY ${sortSql} LIMIT ? OFFSET ?`, [...params, limit, skip]),
      ])
      return { success: true, data: { total: Number(countRows?.[0]?.total || 0), items: itemRows || [] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/assets/stats', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'สรุปสถิติครุภัณฑ์แยกตามหมวดหมู่และสถานะ' } }, async (_req, reply) => {
    try {
      const [rows] = await appPool.query(`
        SELECT
          COUNT(*) AS totalAssets,
          COALESCE(SUM(CASE WHEN category = 'IT' THEN 1 ELSE 0 END), 0) AS itCount,
          COALESCE(SUM(CASE WHEN category = 'MEDICAL' THEN 1 ELSE 0 END), 0) AS medicalCount,
          COALESCE(SUM(CASE WHEN category = 'GENERAL' THEN 1 ELSE 0 END), 0) AS generalCount,
          COALESCE(SUM(CASE WHEN status = 'IN_REPAIR' THEN 1 ELSE 0 END), 0) AS inRepairCount,
          COALESCE(SUM(CASE WHEN warranty_end_date >= NOW() OR (warranty_end_date IS NULL AND expire_date >= NOW()) THEN 1 ELSE 0 END), 0) AS activeWarrantyCount
        FROM hospital_assets
      `)
      return { success: true, data: rows?.[0] ?? {} }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/assets/by-article', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ค้นหาครุภัณฑ์ตามเลขที่ครุภัณฑ์ (Article Number)' } }, async (req, reply) => {
    try {
      const articleNum = String(req.query?.articleNum || '').trim()
      if (!articleNum) return { success: true, data: null }
      const [rows] = await appPool.query(`${ASSET_SELECT_SQL} WHERE a.article_num = ? LIMIT 1`, [articleNum])
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/assets/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายละเอียดครุภัณฑ์ตาม ID' } }, async (req, reply) => {
    try {
      const [rows] = await appPool.query(`${ASSET_SELECT_SQL} WHERE a.id = ? LIMIT 1`, [Number(req.params.id)])
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/assets', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'เพิ่มรายการครุภัณฑ์ใหม่' } }, async (req, reply) => {
    try {
      const d = req.body || {}
      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO hospital_assets (
            article_num, fsn_num, name, brand, model, serial_no, category,
            location_id, location_full_name, department, custodian_id,
            received_date, warranty_start_date, warranty_end_date, expire_date,
            price, vendor_name, vendor_contact, contract_no, status, image_url, notes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            d.articleNum, d.fsnNum ?? null, d.name, d.brand ?? null, d.model ?? null, d.serialNo ?? null, d.category,
            d.locationId ?? null, d.locationFullName ?? null, d.department ?? null, d.custodianId ?? null,
            d.receivedDate ?? null, d.warrantyStartDate ?? null, d.warrantyEndDate ?? null, d.expireDate ?? null,
            d.price ?? null, d.vendorName ?? null, d.vendorContact ?? null, d.contractNo ?? null,
            d.status || 'ACTIVE', d.imageUrl ?? null, d.notes ?? null,
          ]
        )
        const [rows] = await conn.query(`${ASSET_SELECT_SQL} WHERE a.id = ? LIMIT 1`, [res.insertId])
        return rows?.[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/assets/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'แก้ไขข้อมูลครุภัณฑ์ตาม ID' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const d = req.body || {}
      const map = [
        ['articleNum', 'article_num'], ['fsnNum', 'fsn_num'], ['name', 'name'], ['brand', 'brand'],
        ['model', 'model'], ['serialNo', 'serial_no'], ['category', 'category'], ['locationId', 'location_id'],
        ['locationFullName', 'location_full_name'], ['department', 'department'], ['custodianId', 'custodian_id'],
        ['receivedDate', 'received_date'], ['warrantyStartDate', 'warranty_start_date'],
        ['warrantyEndDate', 'warranty_end_date'], ['expireDate', 'expire_date'], ['price', 'price'],
        ['vendorName', 'vendor_name'], ['vendorContact', 'vendor_contact'], ['contractNo', 'contract_no'],
        ['status', 'status'], ['imageUrl', 'image_url'], ['notes', 'notes'],
      ]
      const fields = []
      const params = []
      for (const [k, col] of map) {
        if (d[k] !== undefined) { fields.push(`${col} = ?`); params.push(d[k]) }
      }
      const updated = await withUtf8Conn(appPool, async (conn) => {
        if (fields.length > 0) {
          fields.push('updated_at = NOW()')
          params.push(id)
          await conn.query(`UPDATE hospital_assets SET ${fields.join(', ')} WHERE id = ?`, params)
        }
        const [rows] = await conn.query(`${ASSET_SELECT_SQL} WHERE a.id = ? LIMIT 1`, [id])
        return rows?.[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/assets/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ลบรายการครุภัณฑ์ตาม ID' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      await appPool.query('DELETE FROM hospital_assets WHERE id = ?', [id])
      return { success: true, data: { id } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 2. EQUIPMENT BORROWING V2
  // =========================================================================

  fastify.get('/api/v1/app/v2/equipment-borrow/materials', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายการวัสดุสิ้นเปลือง/อุปกรณ์ยืม-คืน' } }, async (req, reply) => {
    try {
      const { search, category, materialType, isActive } = req.query || {}
      const page = Math.max(1, Number(req.query?.page || 1))
      const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 20)))
      const skip = (page - 1) * limit
      const where = []
      const params = []
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`
        where.push('(name LIKE ? OR location LIKE ? OR notes LIKE ?)')
        params.push(q, q, q)
      }
      if (category && category !== 'ALL') { where.push('category = ?'); params.push(category) }
      if (materialType && materialType !== 'ALL') { where.push('material_type = ?'); params.push(materialType) }
      if (isActive === 'true' || isActive === 'false') {
        where.push('is_active = ?')
        params.push(isActive === 'true' ? 1 : 0)
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const [[cnt], [items]] = await Promise.all([
        appPool.query(`SELECT COUNT(*) AS total FROM hospital_materials ${whereSql}`, params),
        appPool.query(`SELECT * FROM hospital_materials ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`, [...params, limit, skip]),
      ])
      return { success: true, data: { total: Number(cnt?.[0]?.total || 0), items: items || [] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/equipment-borrow/materials', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'เพิ่มรายการวัสดุ/อุปกรณ์สำหรับระบบยืม-คืน' } }, async (req, reply) => {
    try {
      const d = req.body || {}
      const created = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO hospital_materials (name, category, material_type, total_qty, available_qty, unit, location, image_url, notes, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [d.name, d.category, d.materialType, d.totalQty, d.availableQty, d.unit, d.location ?? null, d.imageUrl ?? null, d.notes ?? null, d.isActive ? 1 : 0]
        )
        const [rows] = await conn.query('SELECT * FROM hospital_materials WHERE id = ? LIMIT 1', [res.insertId])
        return rows?.[0] ?? null
      })
      return { success: true, data: created }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/equipment-borrow/materials/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'แก้ไขข้อมูลหรือปรับจำนวนคงเหลือวัสดุยืม-คืน' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [existingRows] = await appPool.query('SELECT * FROM hospital_materials WHERE id = ? LIMIT 1', [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, error: `ไม่พบวัสดุรหัส ${id}` })
      }
      const d = req.body || {}
      const fields = []
      const params = []
      if (d.name !== undefined) { fields.push('name = ?'); params.push(d.name) }
      if (d.category !== undefined) { fields.push('category = ?'); params.push(d.category) }
      if (d.materialType !== undefined) { fields.push('material_type = ?'); params.push(d.materialType) }
      if (d.unit !== undefined) { fields.push('unit = ?'); params.push(d.unit) }
      if (d.location !== undefined) { fields.push('location = ?'); params.push(d.location) }
      if (d.imageUrl !== undefined) { fields.push('image_url = ?'); params.push(d.imageUrl) }
      if (d.notes !== undefined) { fields.push('notes = ?'); params.push(d.notes) }
      if (d.isActive !== undefined) { fields.push('is_active = ?'); params.push(d.isActive ? 1 : 0) }
      if (d.totalQty !== undefined) {
        const newTotal = Math.max(0, Number(d.totalQty))
        fields.push('total_qty = ?'); params.push(newTotal)
        if (d.availableQty !== undefined) {
          fields.push('available_qty = ?'); params.push(Math.max(0, Number(d.availableQty)))
        } else {
          const [bRows] = await appPool.query(
            `SELECT COALESCE(SUM(i.quantity - i.returned_qty), 0) AS borrowed
             FROM equipment_borrow_items i JOIN equipment_borrow_requests r ON i.request_id = r.id
             WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED') AND i.status = 'BORROWED' AND i.material_id = ?`,
            [id]
          )
          const borrowed = Number(bRows?.[0]?.borrowed || 0)
          fields.push('available_qty = ?'); params.push(Math.max(0, newTotal - borrowed))
        }
      } else if (d.availableQty !== undefined) {
        fields.push('available_qty = ?'); params.push(Math.max(0, Number(d.availableQty)))
      }
      const updated = await withUtf8Conn(appPool, async (conn) => {
        if (fields.length > 0) {
          fields.push('updated_at = NOW()')
          params.push(id)
          await conn.query(`UPDATE hospital_materials SET ${fields.join(', ')} WHERE id = ?`, params)
        }
        const [rows] = await conn.query('SELECT * FROM hospital_materials WHERE id = ? LIMIT 1', [id])
        return rows?.[0] ?? null
      })
      return { success: true, data: updated }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/equipment-borrow/materials/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ลบรายการวัสดุยืม-คืน' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [existingRows] = await appPool.query('SELECT * FROM hospital_materials WHERE id = ? LIMIT 1', [id])
      if (!existingRows || existingRows.length === 0) {
        return reply.code(404).send({ success: false, error: `ไม่พบวัสดุรหัส ${id}` })
      }
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query('UPDATE equipment_borrow_items SET material_id = NULL WHERE material_id = ?', [id])
        await conn.query('DELETE FROM hospital_materials WHERE id = ?', [id])
      })
      return { success: true, data: { name: existingRows[0].name } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/equipment-borrow/assets/:assetId/loanable', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ตั้งค่าสถานะอนุญาตให้ยืมครุภัณฑ์' } }, async (req, reply) => {
    try {
      const assetId = Number(req.params.assetId)
      const isLoanable = Boolean(req.body?.isLoanable)
      const [existing] = await appPool.query('SELECT id, article_num FROM hospital_assets WHERE id = ? LIMIT 1', [assetId])
      if (!existing || existing.length === 0) {
        return reply.code(404).send({ success: false, error: `ไม่พบครุภัณฑ์รหัส ${assetId}` })
      }
      await appPool.query('UPDATE hospital_assets SET is_loanable = ?, updated_at = NOW() WHERE id = ?', [isLoanable ? 1 : 0, assetId])
      const [rows] = await appPool.query('SELECT * FROM hospital_assets WHERE id = ? LIMIT 1', [assetId])
      return { success: true, data: { asset: rows?.[0], articleNum: existing[0].article_num } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/equipment-borrow/loanable-assets', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายการครุภัณฑ์ที่เปิดให้ยืมได้' } }, async (req, reply) => {
    try {
      const { search, category } = req.query || {}
      const isLoanable = req.query?.isLoanable !== 'false'
      const page = Math.max(1, Number(req.query?.page || 1))
      const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 20)))
      const skip = (page - 1) * limit
      const where = ['is_loanable = ?']
      const params = [isLoanable ? 1 : 0]
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`
        where.push('(name LIKE ? OR article_num LIKE ? OR brand LIKE ? OR model LIKE ?)')
        params.push(q, q, q, q)
      }
      if (category && category !== 'ALL') { where.push('category = ?'); params.push(category) }
      const whereSql = `WHERE ${where.join(' AND ')}`
      const [[cnt], [items]] = await Promise.all([
        appPool.query(`SELECT COUNT(*) AS total FROM hospital_assets ${whereSql}`, params),
        appPool.query(
          `SELECT id, article_num AS articleNum, fsn_num AS fsnNum, name, brand, model, serial_no AS serialNo, category, location_full_name AS locationFullName, is_loanable AS isLoanable, status, image_url AS imageUrl FROM hospital_assets ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`,
          [...params, limit, skip]
        ),
      ])
      return { success: true, data: { total: Number(cnt?.[0]?.total || 0), items: items || [] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/equipment-borrow/catalog', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงแคตตาล็อกครุภัณฑ์และวัสดุที่พร้อมให้ยืม' } }, async (req, reply) => {
    try {
      const { search, category, type = 'ALL' } = req.query || {}
      let assets = []
      let borrowedAssetIds = []
      let materials = []
      if (type === 'ALL' || type === 'ASSET') {
        const ac = ['is_loanable = 1', "status = 'ACTIVE'"]
        const ap = []
        if (search && String(search).trim()) {
          const q = `%${String(search).trim()}%`
          ac.push('(name LIKE ? OR article_num LIKE ? OR brand LIKE ?)')
          ap.push(q, q, q)
        }
        if (category && category !== 'ALL') { ac.push('category = ?'); ap.push(category) }
        const [[aRows], [bRows]] = await Promise.all([
          appPool.query(`SELECT id, name, brand, article_num AS articleNum, category, location_full_name AS locationFullName, image_url AS imageUrl FROM hospital_assets WHERE ${ac.join(' AND ')} ORDER BY name ASC LIMIT 100`, ap),
          appPool.query(`SELECT DISTINCT i.asset_id FROM equipment_borrow_items i JOIN equipment_borrow_requests r ON i.request_id = r.id WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED') AND i.status = 'BORROWED' AND i.item_type = 'ASSET' AND (i.quantity - i.returned_qty) > 0 AND i.asset_id IS NOT NULL`),
        ])
        assets = aRows || []
        borrowedAssetIds = (bRows || []).map((r) => Number(r.asset_id))
      }
      if (type === 'ALL' || type === 'MATERIAL') {
        const mc = ['is_active = 1', 'available_qty > 0']
        const mp = []
        if (search && String(search).trim()) {
          const q = `%${String(search).trim()}%`
          mc.push('(name LIKE ? OR location LIKE ?)')
          mp.push(q, q)
        }
        if (category && category !== 'ALL') { mc.push('category = ?'); mp.push(category) }
        const [mRows] = await appPool.query(`SELECT id, name, category, material_type AS materialType, available_qty AS availableQty, unit, location, image_url AS imageUrl FROM hospital_materials WHERE ${mc.join(' AND ')} ORDER BY name ASC LIMIT 100`, mp)
        materials = mRows || []
      }
      return { success: true, data: { assets, borrowedAssetIds, materials } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/equipment-borrow/requests', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'สร้างคำขอยืมครุภัณฑ์/วัสดุ' } }, async (req, reply) => {
    try {
      const { input, requester } = req.body || {}
      for (const item of input.items || []) {
        if (item.quantity <= 0) return reply.code(400).send({ success: false, error: `จำนวนของรายการ ${item.itemName} ต้องมากกว่า 0` })
        if (item.itemType === 'MATERIAL') {
          if (!item.materialId) return reply.code(400).send({ success: false, error: 'ไม่พบรหัสวัสดุ' })
          const [matRows] = await appPool.query('SELECT id, is_active, available_qty, unit FROM hospital_materials WHERE id = ? LIMIT 1', [item.materialId])
          if (!matRows.length || !matRows[0].is_active) return reply.code(400).send({ success: false, error: `วัสดุ ${item.itemName} ไม่พร้อมให้บริการ` })
          if (matRows[0].available_qty < item.quantity) return reply.code(400).send({ success: false, error: `ยอดคงเหลือไม่เพียงพอสำหรับ ${item.itemName} (คงเหลือ ${matRows[0].available_qty} ${matRows[0].unit})` })
        } else if (item.itemType === 'ASSET') {
          if (!item.assetId) return reply.code(400).send({ success: false, error: 'ไม่พบรหัสครุภัณฑ์' })
          const [assetRows] = await appPool.query('SELECT id, is_loanable, status FROM hospital_assets WHERE id = ? LIMIT 1', [item.assetId])
          if (!assetRows.length || !assetRows[0].is_loanable || assetRows[0].status !== 'ACTIVE') return reply.code(400).send({ success: false, error: `ครุภัณฑ์ ${item.itemName} ไม่อยู่ในสถานะพร้อมให้ยืม` })
          const [activeLoans] = await appPool.query(
            `SELECT i.id FROM equipment_borrow_items i JOIN equipment_borrow_requests r ON i.request_id = r.id
             WHERE i.item_type = 'ASSET' AND i.asset_id = ? AND i.status = 'BORROWED' AND r.status IN ('APPROVED', 'PARTIAL_RETURNED') LIMIT 1`,
            [item.assetId]
          )
          if (activeLoans.length > 0) return reply.code(400).send({ success: false, error: `ครุภัณฑ์ ${item.itemName} อยู่ระหว่างการยืมโดยผู้อื่นในขณะนี้` })
        }
      }

      const now = new Date()
      const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
      const prefix = `BR-${ym}-`
      const [latestRows] = await appPool.query('SELECT request_no FROM equipment_borrow_requests WHERE request_no LIKE ? ORDER BY request_no DESC LIMIT 1', [`${prefix}%`])
      let nextSeq = 1
      if (latestRows.length > 0 && latestRows[0].request_no) {
        const lastNum = parseInt(String(latestRows[0].request_no).split('-').pop(), 10)
        if (!isNaN(lastNum)) nextSeq = lastNum + 1
      }
      const requestNo = `${prefix}${String(nextSeq).padStart(4, '0')}`

      const requestId = await withUtf8Tx(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO equipment_borrow_requests (
            request_no, requester_id, requester_name, requester_dept, purpose,
            location, borrow_date, expected_return_date, phone, notes, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
          [
            requestNo, requester.id, requester.name, requester.department || null,
            input.purpose, input.location ?? null, input.borrowDate, input.expectedReturnDate ?? null,
            input.phone ?? null, input.notes ?? null,
          ]
        )
        const reqId = res.insertId
        for (const it of input.items || []) {
          await conn.query(
            `INSERT INTO equipment_borrow_items (request_id, item_type, asset_id, material_id, item_name, item_code, quantity, returned_qty, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'PENDING', NOW(), NOW())`,
            [reqId, it.itemType, it.assetId || null, it.materialId || null, it.itemName, it.itemCode || null, it.quantity]
          )
        }
        return reqId
      })
      const full = await loadBorrowRequestFull(appPool, requestId)
      return { success: true, data: full }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/equipment-borrow/requests', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายการคำขอยืม-คืนอุปกรณ์ตามตัวกรอง' } }, async (req, reply) => {
    try {
      const { requesterId, status, search, overdueOnly, activeOnly } = req.query || {}
      const page = Math.max(1, Number(req.query?.page || 1))
      const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 20)))
      const skip = (page - 1) * limit
      const where = []
      const params = []
      if (requesterId) { where.push('requester_id = ?'); params.push(Number(requesterId)) }
      if (activeOnly === 'true') {
        where.push("status IN ('APPROVED', 'PARTIAL_RETURNED')")
        if (overdueOnly === 'true') where.push('expected_return_date < CURDATE()')
      } else if (status && status !== 'ALL') {
        where.push('status = ?'); params.push(status)
      }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`
        where.push('(request_no LIKE ? OR requester_name LIKE ? OR purpose LIKE ? OR location LIKE ?)')
        params.push(q, q, q, q)
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const orderBy = activeOnly === 'true' ? 'expected_return_date ASC' : 'created_at DESC'
      const [[cnt], [reqRows]] = await Promise.all([
        appPool.query(`SELECT COUNT(*) AS total FROM equipment_borrow_requests ${whereSql}`, params),
        appPool.query(`SELECT * FROM equipment_borrow_requests ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...params, limit, skip]),
      ])
      const bundles = await attachBorrowItemsToRequests(appPool, reqRows)
      return { success: true, data: { total: Number(cnt?.[0]?.total || 0), bundles } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/equipment-borrow/requests/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายละเอียดคำขอยืม-คืนอุปกรณ์ตาม ID' } }, async (req, reply) => {
    try {
      const full = await loadBorrowRequestFull(appPool, Number(req.params.id))
      return { success: true, data: full }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/equipment-borrow/requests/:id/approve', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'อนุมัติคำขอยืมอุปกรณ์และตัดยอดคงเหลือ' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const { actor = {} } = req.body || {}
      const full = await loadBorrowRequestFull(appPool, id)
      if (!full) return reply.code(404).send({ success: false, error: `ไม่พบคำขอยืมรหัส ${id}` })
      if (full.request.status !== 'PENDING') return reply.code(400).send({ success: false, error: `คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${full.request.status})` })

      for (const item of full.items) {
        if (item.item_type === 'ASSET' && item.asset_id) {
          const [activeLoans] = await appPool.query(
            `SELECT i.id FROM equipment_borrow_items i JOIN equipment_borrow_requests r ON i.request_id = r.id
             WHERE i.item_type = 'ASSET' AND i.asset_id = ? AND i.status = 'BORROWED' AND i.request_id != ? AND r.status IN ('APPROVED', 'PARTIAL_RETURNED') LIMIT 1`,
            [item.asset_id, id]
          )
          if (activeLoans.length > 0) return reply.code(400).send({ success: false, error: `ครุภัณฑ์ ${item.item_name} กำลังถูกยืมโดยคำขออื่นในขณะนี้ ไม่สามารถอนุมัติจ่ายซ้ำได้` })
        }
      }

      const reqQty = new Map()
      for (const item of full.items) {
        if (item.item_type === 'MATERIAL' && item.material_id) {
          reqQty.set(item.material_id, (reqQty.get(item.material_id) || 0) + Number(item.quantity))
        }
      }
      const matCache = new Map()
      for (const [matId, needed] of reqQty.entries()) {
        const [mRows] = await appPool.query('SELECT id, name, available_qty, unit, material_type FROM hospital_materials WHERE id = ? LIMIT 1', [matId])
        const mat = mRows?.[0]
        if (!mat || Number(mat.available_qty) < needed) {
          const item = full.items.find((i) => i.material_id === matId)
          return reply.code(400).send({ success: false, error: `ยอดคงเหลือไม่เพียงพอสำหรับ ${mat?.name || item?.item_name || 'วัสดุ'} (ต้องการ ${needed}, คงเหลือ ${mat?.available_qty || 0})` })
        }
        matCache.set(matId, mat)
      }

      const hasReturnable = full.items.some((it) => it.item_type === 'ASSET' || it.mat_type !== 'CONSUMABLE')
      const nextStatus = hasReturnable ? 'APPROVED' : 'RETURNED'

      await withUtf8Tx(appPool, async (conn) => {
        for (const item of full.items) {
          if (item.item_type === 'MATERIAL' && item.material_id) {
            const mat = matCache.get(item.material_id)
            await conn.query('UPDATE hospital_materials SET available_qty = available_qty - ?, updated_at = NOW() WHERE id = ?', [item.quantity, item.material_id])
            if (mat?.material_type === 'CONSUMABLE') {
              await conn.query("UPDATE equipment_borrow_items SET status = 'CONSUMED', returned_qty = ?, returned_at = NOW(), updated_at = NOW() WHERE id = ?", [item.quantity, item.id])
            } else {
              await conn.query("UPDATE equipment_borrow_items SET status = 'BORROWED', updated_at = NOW() WHERE id = ?", [item.id])
            }
          } else if (item.item_type === 'ASSET') {
            await conn.query("UPDATE equipment_borrow_items SET status = 'BORROWED', updated_at = NOW() WHERE id = ?", [item.id])
          }
        }
        await conn.query(
          `UPDATE equipment_borrow_requests SET status = ?, approved_by_id = ?, approved_by_name = ?, approved_at = NOW(),
           actual_return_date = CASE WHEN ? = 'RETURNED' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = ?`,
          [nextStatus, actor.id || null, actor.name || actor.username || 'Admin', nextStatus, id]
        )
      })
      const updated = await loadBorrowRequestFull(appPool, id)
      return { success: true, data: { updated, nextStatus, requestNo: full.request.request_no } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/equipment-borrow/requests/:id/reject', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ไม่อนุมัติ/ปฏิเสธคำขอยืมอุปกรณ์' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const { reason = '', actor = {} } = req.body || {}
      const full = await loadBorrowRequestFull(appPool, id)
      if (!full) return reply.code(404).send({ success: false, error: `ไม่พบคำขอยืมรหัส ${id}` })
      if (full.request.status !== 'PENDING') return reply.code(400).send({ success: false, error: `คำขอนี้ไม่ได้อยู่ในสถานะรออนุมัติ (สถานะปัจจุบัน: ${full.request.status})` })
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query(
          `UPDATE equipment_borrow_requests SET status = 'REJECTED', reject_reason = ?, approved_by_id = ?, approved_by_name = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?`,
          [String(reason).trim(), actor.id || null, actor.name || actor.username || 'Admin', id]
        )
        await conn.query("UPDATE equipment_borrow_items SET status = 'REJECTED', updated_at = NOW() WHERE request_id = ?", [id])
      })
      const updated = await loadBorrowRequestFull(appPool, id)
      return { success: true, data: updated }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/equipment-borrow/requests/:id/return', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'บันทึกการคืนอุปกรณ์และคืนยอดคงเหลือ' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const { returns = [], actor = {} } = req.body || {}
      const full = await loadBorrowRequestFull(appPool, id)
      if (!full) return reply.code(404).send({ success: false, error: `ไม่พบคำขอยืมรหัส ${id}` })
      if (!['APPROVED', 'PARTIAL_RETURNED'].includes(full.request.status)) {
        return reply.code(400).send({ success: false, error: `คำขอนี้ไม่ได้อยู่ในสถานะกำลังยืม (สถานะปัจจุบัน: ${full.request.status})` })
      }
      const allDone = await withUtf8Tx(appPool, async (conn) => {
        for (const ret of returns) {
          const item = full.items.find((i) => i.id === ret.itemId)
          if (!item) continue
          const returnQty = Math.min(Number(ret.returnedQty), Number(item.quantity) - Number(item.returned_qty || 0))
          if (returnQty <= 0) continue
          const totalReturned = Number(item.returned_qty || 0) + returnQty
          const fully = totalReturned >= Number(item.quantity)
          let itemStatus = 'BORROWED'
          if (fully) itemStatus = ret.condition === 'LOST' ? 'LOST' : ret.condition === 'DAMAGED' ? 'DAMAGED' : 'RETURNED'
          await conn.query(
            `UPDATE equipment_borrow_items SET returned_qty = ?, status = ?, return_condition = ?, return_notes = ?, returned_at = NOW(), inspected_by_id = ?, inspected_by_name = ?, updated_at = NOW() WHERE id = ?`,
            [totalReturned, itemStatus, ret.condition, ret.notes?.trim() || null, actor.id || null, actor.name || actor.username || 'Admin', item.id]
          )
          if (item.item_type === 'MATERIAL' && item.material_id && item.mat_type === 'REUSABLE' && ret.condition === 'NORMAL') {
            await conn.query('UPDATE hospital_materials SET available_qty = available_qty + ?, updated_at = NOW() WHERE id = ?', [returnQty, item.material_id])
          }
        }
        const [uItems] = await conn.query('SELECT quantity, returned_qty, status FROM equipment_borrow_items WHERE request_id = ?', [id])
        const done = (uItems || []).every((it) => Number(it.returned_qty || 0) >= Number(it.quantity || 0) || it.status === 'CONSUMED')
        const nextSt = done ? 'RETURNED' : 'PARTIAL_RETURNED'
        await conn.query(
          `UPDATE equipment_borrow_requests SET status = ?, actual_return_date = CASE WHEN ? = 'RETURNED' THEN NOW() ELSE NULL END, updated_at = NOW() WHERE id = ?`,
          [nextSt, nextSt, id]
        )
        return done
      })
      const updated = await loadBorrowRequestFull(appPool, id)
      return { success: true, data: { updated, allDone } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/equipment-borrow/stats', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'สรุปสถิติการยืม-คืนอุปกรณ์และรายการเกินกำหนด' } }, async (_req, reply) => {
    try {
      const [[loanableRows], [matAgg], [borrowedRows], [overdueRows]] = await Promise.all([
        appPool.query("SELECT COUNT(*) AS cnt FROM hospital_assets WHERE is_loanable = 1 AND status = 'ACTIVE'"),
        appPool.query('SELECT COALESCE(SUM(total_qty), 0) AS totalMaterials, COALESCE(SUM(available_qty), 0) AS availableMaterials FROM hospital_materials WHERE is_active = 1'),
        appPool.query(`SELECT i.item_type, i.quantity, i.returned_qty FROM equipment_borrow_items i JOIN equipment_borrow_requests r ON i.request_id = r.id WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED') AND i.status = 'BORROWED'`),
        appPool.query(`SELECT i.quantity, i.returned_qty FROM equipment_borrow_items i JOIN equipment_borrow_requests r ON i.request_id = r.id WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED') AND r.expected_return_date < CURDATE() AND i.status = 'BORROWED'`),
      ])
      const loanableAssetsCount = Number(loanableRows?.[0]?.cnt || 0)
      const totalMaterials = Number(matAgg?.[0]?.totalMaterials || 0)
      const availableMaterials = Number(matAgg?.[0]?.availableMaterials || 0)
      let borrowedItems = 0
      let borrowedAssets = 0
      for (const it of borrowedRows || []) {
        const rem = Math.max(0, Number(it.quantity || 0) - Number(it.returned_qty || 0))
        borrowedItems += rem
        if (it.item_type === 'ASSET') borrowedAssets += rem
      }
      let overdueRequests = 0
      for (const it of overdueRows || []) {
        overdueRequests += Math.max(0, Number(it.quantity || 0) - Number(it.returned_qty || 0))
      }
      return {
        success: true,
        data: {
          totalItems: loanableAssetsCount + totalMaterials,
          availableItems: Math.max(0, loanableAssetsCount - borrowedAssets) + availableMaterials,
          borrowedItems,
          overdueRequests,
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/equipment-borrow/overdue-targets', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายชื่อคำขอยืมที่เกินกำหนดส่งคืนสำหรับแจ้งเตือน' } }, async (_req, reply) => {
    try {
      const [reqs] = await appPool.query(`
        SELECT r.id, r.request_no, r.requester_id, r.requester_name, r.requester_dept,
               r.purpose, r.location, r.borrow_date, r.expected_return_date, r.phone, r.status, r.created_at,
               GREATEST(1, DATEDIFF(CURDATE(), r.expected_return_date)) AS overdue_days,
               l.telegram_chat_id
        FROM equipment_borrow_requests r
        LEFT JOIN member_telegram_links l ON l.member_id = r.requester_id
        WHERE r.status IN ('APPROVED', 'PARTIAL_RETURNED') AND r.expected_return_date < CURDATE()
        ORDER BY r.expected_return_date ASC
      `)
      if (!reqs || reqs.length === 0) return { success: true, data: [] }
      const ids = reqs.map((r) => r.id)
      const ph = ids.map(() => '?').join(', ')
      const [items] = await appPool.query(
        `SELECT id, request_id, item_type, asset_id, material_id, item_name, item_code, quantity, returned_qty, status
         FROM equipment_borrow_items WHERE request_id IN (${ph})`,
        ids
      )
      const byReq = new Map()
      for (const it of items || []) {
        const arr = byReq.get(it.request_id) || []
        arr.push(it)
        byReq.set(it.request_id, arr)
      }
      return {
        success: true,
        data: reqs.map((r) => ({ ...r, items: byReq.get(r.id) || [] })),
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // =========================================================================
  // 3. HOSPITAL EVENTS & LEADERBOARD V2
  // =========================================================================

  fastify.post('/api/v1/app/v2/events/sync-statuses', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'อัปเดตสถานะกิจกรรมตามวันเวลาปัจจุบันอัตโนมัติ' } }, async (req, reply) => {
    try {
      const dbNow = String(req.body?.dbNow || '')
      const [[compRes], [onRes]] = await Promise.all([
        appPool.query(
          "UPDATE hospital_events SET status = 'COMPLETED', updated_at = NOW() WHERE status IN ('UPCOMING', 'ONGOING') AND event_end_date < ?",
          [dbNow]
        ),
        appPool.query(
          "UPDATE hospital_events SET status = 'ONGOING', updated_at = NOW() WHERE status = 'UPCOMING' AND event_start_date <= ? AND event_end_date >= ?",
          [dbNow, dbNow]
        ),
      ])
      return {
        success: true,
        data: {
          updatedToCompleted: compRes?.affectedRows || 0,
          updatedToOngoing: onRes?.affectedRows || 0,
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายการกิจกรรมโรงพยาบาลทั้งหมด (V2)' } }, async (req, reply) => {
    try {
      const { status, search, fiscalYear, memberId, onlyUpcoming, onlyCompleted, onlyMyEvents, onlyMyRegistrations, dbNow } = req.query || {}
      const page = Math.max(1, Number(req.query?.page || 1))
      const limit = Math.min(200, Math.max(1, Number(req.query?.limit || 20)))
      const skip = (page - 1) * limit
      const mId = memberId ? Number(memberId) : null

      const where = []
      const params = []
      if (onlyUpcoming === 'true' && dbNow) { where.push('e.event_end_date >= ?'); params.push(dbNow) }
      else if (onlyCompleted === 'true' && dbNow) { where.push('e.event_end_date < ?'); params.push(dbNow) }
      if (status && status !== 'ALL') { where.push('e.status = ?'); params.push(status) }
      if (fiscalYear && fiscalYear !== 'ALL') { where.push('e.fiscal_year = ?'); params.push(fiscalYear) }
      if (search && String(search).trim()) {
        const q = `%${String(search).trim()}%`
        where.push('(e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)')
        params.push(q, q, q)
      }
      if (onlyMyEvents === 'true' && mId) {
        where.push('(e.head_organizer_id = ? OR EXISTS (SELECT 1 FROM event_organizers WHERE event_id = e.id AND member_id = ?))')
        params.push(mId, mId)
      }
      if (onlyMyRegistrations === 'true' && mId) {
        where.push('EXISTS (SELECT 1 FROM event_registrations WHERE event_id = e.id AND member_id = ?)')
        params.push(mId)
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const sortSql = onlyCompleted === 'true' ? 'e.event_end_date DESC' : onlyUpcoming === 'true' ? 'e.event_start_date ASC' : 'e.event_start_date DESC'

      const [[cnt], [eventRows]] = await Promise.all([
        appPool.query(`SELECT COUNT(*) AS total FROM hospital_events e ${whereSql}`, params),
        appPool.query(
          `SELECT e.id, e.title, e.description, e.location, e.banner_url AS bannerUrl,
                  e.event_start_date AS eventStartDate, e.event_end_date AS eventEndDate,
                  e.checkin_open_time AS checkinOpenTime, e.checkin_close_time AS checkinCloseTime,
                  e.head_organizer_id AS headOrganizerId, e.borrow_request_id AS borrowRequestId,
                  e.qr_token AS qrToken, e.fiscal_year AS fiscalYear, e.status,
                  e.created_at AS createdAt, e.updated_at AS updatedAt,
                  m.id AS head_id, m.name AS head_name, m.department AS head_dept, m.profile_path AS head_profile,
                  (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) AS registrationCount,
                  (SELECT COUNT(*) FROM event_attendances WHERE event_id = e.id) AS attendanceCount
                  ${mId ? ', (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id AND member_id = ?) AS userRegCount, (SELECT COUNT(*) FROM event_attendances WHERE event_id = e.id AND member_id = ?) AS userAttCount' : ''}
           FROM hospital_events e LEFT JOIN members m ON e.head_organizer_id = m.id
           ${whereSql} ORDER BY ${sortSql} LIMIT ? OFFSET ?`,
          mId ? [mId, mId, ...params, limit, skip] : [...params, limit, skip]
        ),
      ])

      let coByEvent = new Map()
      if (eventRows && eventRows.length > 0) {
        const ids = eventRows.map((e) => e.id)
        const ph = ids.map(() => '?').join(', ')
        const [coRows] = await appPool.query(
          `SELECT o.event_id, o.member_id, o.role_title, m.id, m.name, m.department, m.profile_path AS profilePath
           FROM event_organizers o JOIN members m ON o.member_id = m.id WHERE o.event_id IN (${ph})`,
          ids
        )
        for (const c of coRows || []) {
          const arr = coByEvent.get(c.event_id) || []
          arr.push(c)
          coByEvent.set(c.event_id, arr)
        }
      }
      return {
        success: true,
        data: {
          total: Number(cnt?.[0]?.total || 0),
          events: (eventRows || []).map((e) => ({ ...e, coRows: coByEvent.get(e.id) || [] })),
        },
      }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/events', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'สร้างกิจกรรมโรงพยาบาลใหม่' } }, async (req, reply) => {
    try {
      const { payload, actor, borrowItems = [], coOrganizerMemberIds = [] } = req.body || {}
      const result = await withUtf8Tx(appPool, async (conn) => {
        let borrowRequestId = null
        if (borrowItems.length > 0) {
          const yyyymm = new Date().toISOString().slice(0, 7).replace('-', '')
          const rand4 = Math.floor(1000 + Math.random() * 9000)
          const requestNo = `BR-${yyyymm}-${rand4}`
          const [bRes] = await conn.query(
            `INSERT INTO equipment_borrow_requests (request_no, requester_id, requester_name, requester_dept, purpose, location, borrow_date, expected_return_date, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
            [requestNo, actor.id, actor.name || 'บุคลากรโรงพยาบาลเถิน', actor.department || null, `สำหรับกิจกรรม: ${payload.title}`, payload.location, payload.eventStartDate, payload.eventEndDate]
          )
          borrowRequestId = bRes.insertId
          for (const item of borrowItems) {
            await conn.query(
              `INSERT INTO equipment_borrow_items (request_id, item_type, asset_id, material_id, item_name, item_code, quantity, status, returned_qty, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, NOW(), NOW())`,
              [borrowRequestId, item.itemType, item.assetId || null, item.materialId || null, item.itemName, item.itemCode || null, item.quantity || 1]
            )
          }
        }
        const [eRes] = await conn.query(
          `INSERT INTO hospital_events (title, description, location, banner_url, event_start_date, event_end_date, checkin_open_time, checkin_close_time, head_organizer_id, borrow_request_id, qr_token, fiscal_year, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPCOMING', NOW(), NOW())`,
          [payload.title, payload.description, payload.location, payload.bannerUrl, payload.eventStartDate, payload.eventEndDate, payload.checkinOpenTime, payload.checkinCloseTime, actor.id, borrowRequestId, payload.qrToken, payload.fiscalYear]
        )
        const eventId = eRes.insertId
        const uniqueCo = Array.from(new Set(coOrganizerMemberIds.filter((id) => id !== actor.id)))
        for (const mId of uniqueCo) {
          await conn.query("INSERT INTO event_organizers (event_id, member_id, role_title) VALUES (?, ?, 'ผู้รับผิดชอบร่วม')", [eventId, mId])
        }
        return { eventId, borrowRequestId }
      })
      return { success: true, data: result }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/preload', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'โหลดข้อมูลตั้งต้นสำหรับสร้าง/จัดการกิจกรรม' } }, async (req, reply) => {
    try {
      const [[materials], [assets], [members]] = await Promise.all([
        appPool.query('SELECT id, name, category, available_qty AS availableQty, unit FROM hospital_materials WHERE is_active = 1 ORDER BY name ASC'),
        appPool.query('SELECT id, article_num AS articleNum, name, category FROM hospital_assets WHERE is_loanable = 1 AND status = "ACTIVE" ORDER BY name ASC'),
        appPool.query('SELECT id, name, department, position FROM members ORDER BY name ASC'),
      ])
      return { success: true, data: { materials, assets, members } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/members-picker', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายชื่อบุคลากรสำหรับเลือกผู้เข้าร่วมกิจกรรม' } }, async (_req, reply) => {
    try {
      const [rows] = await appPool.query('SELECT id, name, department, position FROM members ORDER BY name ASC')
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/by-qr/:token', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ค้นหากิจกรรมจาก QR Token สำหรับเช็กอิน' } }, async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        `SELECT id, title, location, qr_token AS qrToken, checkin_open_time AS checkinOpenTime, checkin_close_time AS checkinCloseTime
         FROM hospital_events WHERE qr_token = ? LIMIT 1`,
        [String(req.params.token)]
      )
      return { success: true, data: rows?.[0] ?? null }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/member-stats/:memberId', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงสถิติการเข้าร่วมกิจกรรมและคะแนนสะสมรายบุคคล' } }, async (req, reply) => {
    try {
      const mId = Number(req.params.memberId)
      const [[pRows], [rRows]] = await Promise.all([
        appPool.query('SELECT COUNT(*) AS count FROM event_attendances WHERE member_id = ?', [mId]),
        appPool.query('SELECT COUNT(*) AS count FROM event_registrations WHERE member_id = ?', [mId]),
      ])
      return { success: true, data: { totalPoints: Number(pRows?.[0]?.count ?? 0), registeredCount: Number(rRows?.[0]?.count ?? 0) } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/leaderboard/individual', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'จัดอันดับคะแนนกิจกรรมรายบุคคล (Leaderboard)' } }, async (req, reply) => {
    try {
      const { fiscalYear, timeframe } = req.query || {}
      const where = []
      const params = []
      if (timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
        where.push('e.fiscal_year = ?')
        params.push(fiscalYear)
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const [rows] = await appPool.query(
        `SELECT a.id, a.event_id, a.member_id, a.points_awarded AS pointsAwarded, a.checked_in_at AS checkedInAt,
                m.id AS m_id, m.name AS m_name, m.department AS m_department, m.position AS m_position, m.profile_path AS m_profile_path
         FROM event_attendances a
         LEFT JOIN members m ON a.member_id = m.id
         LEFT JOIN hospital_events e ON a.event_id = e.id
         ${whereSql} ORDER BY a.checked_in_at DESC`,
        params
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/leaderboard/department', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'จัดอันดับคะแนนกิจกรรมรายหน่วยงาน (Department Leaderboard)' } }, async (req, reply) => {
    try {
      const { fiscalYear, timeframe } = req.query || {}
      const where = []
      const params = []
      if (timeframe !== 'all' && fiscalYear && fiscalYear !== 'ALL') {
        where.push('e.fiscal_year = ?')
        params.push(fiscalYear)
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const [[members], [attRows]] = await Promise.all([
        appPool.query('SELECT id, department FROM members'),
        appPool.query(
          `SELECT a.id, a.points_awarded AS pointsAwarded, m.id AS m_id, m.department AS m_department
           FROM event_attendances a
           LEFT JOIN members m ON a.member_id = m.id
           LEFT JOIN hospital_events e ON a.event_id = e.id
           ${whereSql}`,
          params
        ),
      ])
      return { success: true, data: { members: members || [], attRows: attRows || [] } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/fiscal-years', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายการปีงบประมาณที่มีกิจกรรม' } }, async (_req, reply) => {
    try {
      const [rows] = await appPool.query('SELECT DISTINCT fiscal_year AS fiscalYear FROM hospital_events WHERE fiscal_year IS NOT NULL ORDER BY fiscal_year DESC')
      return { success: true, data: (rows || []).map((r) => r.fiscalYear).filter(Boolean) }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายละเอียดกิจกรรม รายชื่อผู้ลงทะเบียน และผู้เช็กอิน' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const [rows] = await appPool.query(
        `SELECT e.id, e.title, e.description, e.location, e.banner_url AS bannerUrl,
                e.event_start_date AS eventStartDate, e.event_end_date AS eventEndDate,
                e.checkin_open_time AS checkinOpenTime, e.checkin_close_time AS checkinCloseTime,
                e.head_organizer_id AS headOrganizerId, e.borrow_request_id AS borrowRequestId,
                e.qr_token AS qrToken, e.fiscal_year AS fiscalYear, e.status,
                e.created_at AS createdAt, e.updated_at AS updatedAt,
                m.id AS head_id, m.name AS head_name, m.department AS head_dept, m.profile_path AS head_profile, m.position AS head_pos
         FROM hospital_events e LEFT JOIN members m ON e.head_organizer_id = m.id WHERE e.id = ? LIMIT 1`,
        [id]
      )
      if (!rows || rows.length === 0) return { success: true, data: null }
      const event = rows[0]
      const [[coRows], [regRows], [attRows], borrowRows, [attachRows]] = await Promise.all([
        appPool.query('SELECT o.member_id, o.role_title, m.id, m.name, m.department, m.profile_path AS profilePath, m.position FROM event_organizers o JOIN members m ON o.member_id = m.id WHERE o.event_id = ?', [id]),
        appPool.query('SELECT r.id, r.event_id, r.member_id, r.registered_at AS registeredAt, m.id AS m_id, m.name AS m_name, m.department AS m_department, m.profile_path AS m_profile_path FROM event_registrations r JOIN members m ON r.member_id = m.id WHERE r.event_id = ? ORDER BY r.registered_at DESC', [id]),
        appPool.query('SELECT a.id, a.event_id, a.member_id, a.citizen_id, a.checked_in_at AS checkedInAt, a.points_awarded AS pointsAwarded, m.id AS m_id, m.name AS m_name, m.department AS m_department, m.profile_path AS m_profile_path FROM event_attendances a JOIN members m ON a.member_id = m.id WHERE a.event_id = ? ORDER BY a.checked_in_at DESC', [id]),
        event.borrowRequestId ? appPool.query('SELECT * FROM equipment_borrow_requests WHERE id = ? LIMIT 1', [event.borrowRequestId]).then(([r]) => r) : Promise.resolve([]),
        appPool.query(`SELECT a.id, a.event_id AS eventId, a.attachment_type AS attachmentType, a.title, a.file_path AS filePath, a.file_type AS fileType, a.file_size AS fileSize, a.text_content AS textContent, a.uploaded_by_member_id AS uploadedByMemberId, a.display_order AS displayOrder, a.created_at AS createdAt, a.updated_at AS updatedAt, m.id AS uploader_id, m.name AS uploader_name, m.department AS uploader_dept, m.profile_path AS uploader_profile FROM event_attachments a LEFT JOIN members m ON a.uploaded_by_member_id = m.id WHERE a.event_id = ? ORDER BY a.display_order ASC, a.created_at DESC`, [id]),
      ])
      return { success: true, data: { event, coRows, regRows, attRows, borrowRequest: borrowRows?.[0] ?? null, attachRows } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/events/:id/status', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'เปลี่ยนสถานะกิจกรรม (เปิด/ปิด/เสร็จสิ้น)' } }, async (req, reply) => {
    try {
      await appPool.query('UPDATE hospital_events SET status = ?, updated_at = NOW() WHERE id = ?', [req.body?.status, Number(req.params.id)])
      return { success: true, data: { updated: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/events/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'แก้ไขรายละเอียดกิจกรรม' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const { fields = {}, coOrganizerMemberIds, actor = {} } = req.body || {}
      const [[existingRows], [coRows]] = await Promise.all([
        appPool.query('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ? LIMIT 1', [id]),
        appPool.query('SELECT member_id FROM event_organizers WHERE event_id = ?', [id]),
      ])
      if (!existingRows || existingRows.length === 0) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลกิจกรรม' })
      const existing = existingRows[0]
      const isAuth = actor.role === 'admin' || existing.head_organizer_id === actor.id || coRows.some((c) => c.member_id === actor.id)
      if (!isAuth) return reply.code(403).send({ success: false, error: 'คุณไม่มีสิทธิ์แก้ไขกิจกรรมนี้' })

      const map = [
        ['title', 'title'], ['description', 'description'], ['location', 'location'], ['bannerUrl', 'banner_url'],
        ['status', 'status'], ['fiscalYear', 'fiscal_year'], ['eventStartDate', 'event_start_date'],
        ['eventEndDate', 'event_end_date'], ['checkinOpenTime', 'checkin_open_time'], ['checkinCloseTime', 'checkin_close_time'],
      ]
      const sets = []
      const params = []
      for (const [k, col] of map) {
        if (fields[k] !== undefined) { sets.push(`${col} = ?`); params.push(fields[k]) }
      }
      await withUtf8Tx(appPool, async (conn) => {
        if (sets.length > 0) {
          sets.push('updated_at = NOW()')
          params.push(id)
          await conn.query(`UPDATE hospital_events SET ${sets.join(', ')} WHERE id = ?`, params)
        }
        if (Array.isArray(coOrganizerMemberIds)) {
          await conn.query('DELETE FROM event_organizers WHERE event_id = ?', [id])
          const uniqueCo = Array.from(new Set(coOrganizerMemberIds.filter((mId) => mId !== existing.head_organizer_id)))
          for (const mId of uniqueCo) {
            await conn.query("INSERT INTO event_organizers (event_id, member_id, role_title) VALUES (?, ?, 'ผู้รับผิดชอบร่วม')", [id, mId])
          }
        }
      })
      return { success: true, data: { title: fields.title || existing.title } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/events/:id', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ลบกิจกรรมและข้อมูลที่เกี่ยวข้อง' } }, async (req, reply) => {
    try {
      const id = Number(req.params.id)
      const actor = req.body?.actor || {}
      const [[existingRows], [coRows]] = await Promise.all([
        appPool.query('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ? LIMIT 1', [id]),
        appPool.query('SELECT member_id FROM event_organizers WHERE event_id = ?', [id]),
      ])
      if (!existingRows || existingRows.length === 0) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลกิจกรรม' })
      const existing = existingRows[0]
      const isAuth = actor.role === 'admin' || existing.head_organizer_id === actor.id || coRows.some((c) => c.member_id === actor.id)
      if (!isAuth) return reply.code(403).send({ success: false, error: 'คุณไม่มีสิทธิ์ลบกิจกรรมนี้' })
      await withUtf8Tx(appPool, async (conn) => {
        await conn.query('DELETE FROM event_attendances WHERE event_id = ?', [id])
        await conn.query('DELETE FROM event_registrations WHERE event_id = ?', [id])
        await conn.query('DELETE FROM event_organizers WHERE event_id = ?', [id])
        await conn.query('DELETE FROM hospital_events WHERE id = ?', [id])
      })
      return { success: true, data: { title: existing.title } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/events/:id/register', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ลงทะเบียนเข้าร่วมกิจกรรม' } }, async (req, reply) => {
    try {
      const eventId = Number(req.params.id)
      const memberId = Number(req.body?.memberId)
      const [eventRows] = await appPool.query('SELECT id, status FROM hospital_events WHERE id = ? LIMIT 1', [eventId])
      if (!eventRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลกิจกรรม' })
      if (eventRows[0].status === 'COMPLETED' || eventRows[0].status === 'CANCELLED') {
        return reply.code(400).send({ success: false, error: 'ไม่สามารถลงทะเบียนกิจกรรมที่สิ้นสุดหรือถูกยกเลิกแล้ว' })
      }
      const [regRows] = await appPool.query('SELECT id FROM event_registrations WHERE event_id = ? AND member_id = ? LIMIT 1', [eventId, memberId])
      if (regRows.length > 0) return { success: true, data: { alreadyRegistered: true, registration: regRows[0] } }
      const [res] = await appPool.query('INSERT INTO event_registrations (event_id, member_id, registered_at) VALUES (?, ?, NOW())', [eventId, memberId])
      return { success: true, data: { alreadyRegistered: false, registration: { id: res.insertId, eventId, memberId } } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/events/:id/register/:memberId', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ยกเลิกการลงทะเบียนเข้าร่วมกิจกรรม' } }, async (req, reply) => {
    try {
      await appPool.query('DELETE FROM event_registrations WHERE event_id = ? AND member_id = ?', [Number(req.params.id), Number(req.params.memberId)])
      return { success: true, data: { cancelled: true } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/events/checkin-thaid', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'บันทึกการเช็กอินเข้าร่วมกิจกรรมด้วย ThaID' } }, async (req, reply) => {
    try {
      const { eventId, citizenId, checkedInAt } = req.body || {}
      const [memberRows] = await appPool.query('SELECT id, name, department, position, username FROM members WHERE username = ? LIMIT 1', [citizenId])
      if (!memberRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลบุคลากรในระบบ กรุณาติดต่อกลุ่มงานทรัพยากรบุคคลหรือลงทะเบียนสมาชิกโรงพยาบาลเถินก่อนเช็คอิน' })
      const member = memberRows[0]
      const [attRows] = await appPool.query('SELECT id, checked_in_at FROM event_attendances WHERE event_id = ? AND member_id = ? LIMIT 1', [eventId, member.id])
      if (attRows.length > 0) {
        return { success: true, data: { duplicate: true, existingCheckedInAt: attRows[0].checked_in_at, member } }
      }
      await withUtf8Conn(appPool, async (conn) => {
        await conn.query(
          'INSERT INTO event_attendances (event_id, member_id, citizen_id, points_awarded, checked_in_at) VALUES (?, ?, ?, 1, ?)',
          [eventId, member.id, citizenId, checkedInAt]
        )
      })
      return { success: true, data: { duplicate: false, member } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/events/:id/attendances', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'บันทึกการเข้าร่วมกิจกรรม (Attendance Check-in)' } }, async (req, reply) => {
    try {
      const eventId = Number(req.params.id)
      const { memberId, pointsAwarded = 1, checkedInAt, actor = {} } = req.body || {}
      const [[eventRows], [coRows]] = await Promise.all([
        appPool.query('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ? LIMIT 1', [eventId]),
        appPool.query('SELECT member_id FROM event_organizers WHERE event_id = ?', [eventId]),
      ])
      if (!eventRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลกิจกรรม' })
      const event = eventRows[0]
      const isAuth = actor.role === 'admin' || event.head_organizer_id === actor.id || coRows.some((c) => c.member_id === actor.id)
      if (!isAuth) return reply.code(403).send({ success: false, error: 'คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้' })
      const [mRows] = await appPool.query('SELECT id, name, department, position, username, profile_path AS profilePath FROM members WHERE id = ? LIMIT 1', [memberId])
      if (!mRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลบุคลากรที่ระบุ' })
      const member = mRows[0]
      const [attRows] = await appPool.query('SELECT id FROM event_attendances WHERE event_id = ? AND member_id = ? LIMIT 1', [eventId, member.id])
      if (attRows.length > 0) return reply.code(409).send({ success: false, error: `${member.name || 'บุคลากรท่านนี้'} มีรายชื่อเข้าร่วมกิจกรรมนี้แล้ว` })
      const insertId = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          'INSERT INTO event_attendances (event_id, member_id, citizen_id, points_awarded, checked_in_at) VALUES (?, ?, ?, ?, ?)',
          [eventId, member.id, member.username, pointsAwarded, checkedInAt]
        )
        return res.insertId
      })
      return { success: true, data: { id: insertId, eventTitle: event.title, member } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.patch('/api/v1/app/v2/events/:id/attendances/:attendanceId', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'แก้ไขบันทึกการเข้าร่วมกิจกรรม' } }, async (req, reply) => {
    try {
      const eventId = Number(req.params.id)
      const attendanceId = Number(req.params.attendanceId)
      const { pointsAwarded, checkedInAt, actor = {} } = req.body || {}
      const [[eventRows], [coRows]] = await Promise.all([
        appPool.query('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ? LIMIT 1', [eventId]),
        appPool.query('SELECT member_id FROM event_organizers WHERE event_id = ?', [eventId]),
      ])
      if (!eventRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลกิจกรรม' })
      const event = eventRows[0]
      const isAuth = actor.role === 'admin' || event.head_organizer_id === actor.id || coRows.some((c) => c.member_id === actor.id)
      if (!isAuth) return reply.code(403).send({ success: false, error: 'คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้' })
      const [attRows] = await appPool.query('SELECT a.*, m.name FROM event_attendances a JOIN members m ON a.member_id = m.id WHERE a.id = ? LIMIT 1', [attendanceId])
      if (!attRows.length || attRows[0].event_id !== eventId) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลการเข้าร่วมกิจกรรมที่ต้องการแก้ไข' })
      const sets = []
      const params = []
      if (pointsAwarded !== undefined) { sets.push('points_awarded = ?'); params.push(pointsAwarded) }
      if (checkedInAt) { sets.push('checked_in_at = ?'); params.push(checkedInAt) }
      if (sets.length > 0) {
        params.push(attendanceId)
        await appPool.query(`UPDATE event_attendances SET ${sets.join(', ')} WHERE id = ?`, params)
      }
      const [uRows] = await appPool.query(
        `SELECT a.id, a.event_id AS eventId, a.member_id AS memberId, a.citizen_id AS citizenId,
                a.points_awarded AS pointsAwarded, a.checked_in_at AS checkedInAt, a.created_at AS createdAt, a.updated_at AS updatedAt,
                m.id AS m_id, m.name, m.department, m.position, m.profile_path AS profilePath
         FROM event_attendances a JOIN members m ON a.member_id = m.id WHERE a.id = ? LIMIT 1`,
        [attendanceId]
      )
      return { success: true, data: { row: uRows?.[0], eventTitle: event.title, memberName: attRows[0].name } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/events/:id/attendances/:attendanceId', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ลบบันทึกการเข้าร่วมกิจกรรม' } }, async (req, reply) => {
    try {
      const eventId = Number(req.params.id)
      const attendanceId = Number(req.params.attendanceId)
      const actor = req.body?.actor || {}
      const [[eventRows], [coRows]] = await Promise.all([
        appPool.query('SELECT id, title, head_organizer_id FROM hospital_events WHERE id = ? LIMIT 1', [eventId]),
        appPool.query('SELECT member_id FROM event_organizers WHERE event_id = ?', [eventId]),
      ])
      if (!eventRows.length) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลกิจกรรม' })
      const event = eventRows[0]
      const isAuth = actor.role === 'admin' || event.head_organizer_id === actor.id || coRows.some((c) => c.member_id === actor.id)
      if (!isAuth) return reply.code(403).send({ success: false, error: 'คุณไม่มีสิทธิ์จัดการรายชื่อผู้เข้าร่วมกิจกรรมนี้' })
      const [attRows] = await appPool.query('SELECT a.*, m.name FROM event_attendances a JOIN members m ON a.member_id = m.id WHERE a.id = ? LIMIT 1', [attendanceId])
      if (!attRows.length || attRows[0].event_id !== eventId) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลการเข้าร่วมกิจกรรมที่ต้องการลบ' })
      await appPool.query('DELETE FROM event_attendances WHERE id = ?', [attendanceId])
      return { success: true, data: { eventTitle: event.title, memberName: attRows[0].name, memberId: attRows[0].member_id } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.get('/api/v1/app/v2/events/:id/attachments', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ดึงรายการไฟล์แนบ/รูปภาพของกิจกรรม (V2)' } }, async (req, reply) => {
    try {
      const [rows] = await appPool.query(
        `SELECT a.id, a.event_id AS eventId, a.attachment_type AS attachmentType, a.title, a.file_path AS filePath,
                a.file_type AS fileType, a.file_size AS fileSize, a.text_content AS textContent,
                a.uploaded_by_member_id AS uploadedByMemberId, a.display_order AS displayOrder,
                a.created_at AS createdAt, a.updated_at AS updatedAt,
                m.id AS uploader_id, m.name AS uploader_name, m.department AS uploader_dept, m.profile_path AS uploader_profile
         FROM event_attachments a LEFT JOIN members m ON a.uploaded_by_member_id = m.id
         WHERE a.event_id = ? ORDER BY a.display_order ASC, a.created_at DESC`,
        [Number(req.params.id)]
      )
      return { success: true, data: rows || [] }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.post('/api/v1/app/v2/events/:id/attachments', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'เพิ่มไฟล์แนบหรือรูปภาพของกิจกรรม (V2)' } }, async (req, reply) => {
    try {
      const eventId = Number(req.params.id)
      const d = req.body || {}
      const insertId = await withUtf8Conn(appPool, async (conn) => {
        const [res] = await conn.query(
          `INSERT INTO event_attachments (event_id, attachment_type, title, file_path, file_type, file_size, text_content, uploaded_by_member_id, display_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [eventId, d.attachmentType, d.title, d.filePath || null, d.fileType || null, d.fileSize || null, d.textContent || null, d.uploadedByMemberId, d.displayOrder ?? 0]
        )
        return res.insertId
      })
      return { success: true, data: { insertId } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  fastify.delete('/api/v1/app/v2/events/:id/attachments/:attachmentId', { schema: { tags: ['09. Operations — Assets, Borrow & Events'], summary: 'ลบไฟล์แนบของกิจกรรม (V2)' } }, async (req, reply) => {
    try {
      const eventId = Number(req.params.id)
      const attachmentId = Number(req.params.attachmentId)
      const { actor = {}, isOrganizer = false } = req.body || {}
      const [rows] = await appPool.query('SELECT id, event_id, file_path, uploaded_by_member_id FROM event_attachments WHERE id = ? LIMIT 1', [attachmentId])
      const existing = rows?.[0]
      if (!existing || existing.event_id !== eventId) return reply.code(404).send({ success: false, error: 'ไม่พบข้อมูลเอกสารหรือไฟล์แนบที่ต้องการลบ' })
      const isUploader = Boolean(actor.id && existing.uploaded_by_member_id === actor.id)
      if (!isOrganizer && !isUploader) return reply.code(403).send({ success: false, error: 'คุณไม่มีสิทธิ์ลบเอกสารหรือรูปภาพในกิจกรรมนี้' })
      await appPool.query('DELETE FROM event_attachments WHERE id = ?', [attachmentId])
      return { success: true, data: { filePath: existing.file_path || null } }
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }
  })
}
