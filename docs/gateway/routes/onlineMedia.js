/**
 * Online Media Library Named API Routes (192.168.1.7 - Website DB)
 * Tables: online_media_categories, online_media_items, online_media_attachments, online_media_views
 */
export default async function onlineMediaRoutes(fastify, options) {
  const { pools } = options
  const { appPool } = pools

  const CREATE_CATEGORIES_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS online_media_categories (
      id INT NOT NULL AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(200) NOT NULL,
      visibility VARCHAR(20) NOT NULL DEFAULT 'ALL',
      display_order INT NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
      PRIMARY KEY (id),
      UNIQUE KEY uq_media_cat_slug (slug),
      INDEX idx_media_cat_vis_order (visibility, is_active, display_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  const CREATE_ITEMS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS online_media_items (
      id INT NOT NULL AUTO_INCREMENT,
      slug VARCHAR(255) NOT NULL,
      title VARCHAR(500) NOT NULL,
      description TEXT NULL,
      category_id INT NOT NULL,
      visibility VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
      media_type VARCHAR(30) NOT NULL DEFAULT 'VIDEO',
      source_type VARCHAR(20) NOT NULL DEFAULT 'MINIO',
      s3_bucket VARCHAR(100) NULL,
      s3_key VARCHAR(1000) NULL,
      youtube_url VARCHAR(500) NULL,
      thumbnail_s3_key VARCHAR(1000) NULL,
      file_name VARCHAR(255) NULL,
      file_size BIGINT NULL,
      mime_type VARCHAR(100) NULL,
      allow_download BOOLEAN NOT NULL DEFAULT TRUE,
      is_published BOOLEAN NOT NULL DEFAULT TRUE,
      view_count INT NOT NULL DEFAULT 0,
      created_by_id INT NULL,
      created_by_name VARCHAR(255) NULL,
      created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
      PRIMARY KEY (id),
      UNIQUE KEY uq_media_item_slug (slug),
      INDEX idx_media_item_vis_pub (visibility, is_published, created_at),
      INDEX idx_media_item_cat (category_id),
      INDEX idx_media_item_type (media_type),
      CONSTRAINT fk_media_item_cat FOREIGN KEY (category_id) REFERENCES online_media_categories(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  const CREATE_ATTACHMENTS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS online_media_attachments (
      id INT NOT NULL AUTO_INCREMENT,
      media_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      s3_bucket VARCHAR(100) NOT NULL,
      s3_key VARCHAR(1000) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_size BIGINT NULL,
      mime_type VARCHAR(100) NULL,
      display_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      PRIMARY KEY (id),
      INDEX idx_media_att_media_order (media_id, display_order),
      CONSTRAINT fk_media_att_item FOREIGN KEY (media_id) REFERENCES online_media_items(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  const CREATE_VIEWS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS online_media_views (
      id INT NOT NULL AUTO_INCREMENT,
      media_id INT NOT NULL,
      member_id INT NOT NULL,
      member_name VARCHAR(255) NOT NULL,
      member_department VARCHAR(150) NULL,
      view_count INT NOT NULL DEFAULT 1,
      first_viewed_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
      last_viewed_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
      PRIMARY KEY (id),
      UNIQUE KEY uq_media_view_media_member (media_id, member_id),
      INDEX idx_media_view_last (media_id, last_viewed_at),
      CONSTRAINT fk_media_view_item FOREIGN KEY (media_id) REFERENCES online_media_items(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `

  let schemaReadyPromise = null
  async function ensureTables() {
    if (!schemaReadyPromise) {
      schemaReadyPromise = (async () => {
        await appPool.query(CREATE_CATEGORIES_TABLE_SQL)
        await appPool.query(CREATE_ITEMS_TABLE_SQL)
        await appPool.query(CREATE_ATTACHMENTS_TABLE_SQL)
        await appPool.query(CREATE_VIEWS_TABLE_SQL)

        const [countRows] = await appPool.query('SELECT COUNT(*) AS cnt FROM online_media_categories')
        if (Number(countRows?.[0]?.cnt || 0) === 0) {
          await appPool.query(
            `INSERT INTO online_media_categories (name, slug, visibility, display_order, is_active) VALUES
             (?, ?, ?, ?, ?),
             (?, ?, ?, ?, ?),
             (?, ?, ?, ?, ?)`,
            [
              'สื่อสุขศึกษาสำหรับประชาชน',
              'public-health-education',
              'PUBLIC',
              1,
              1,
              'สื่อการอบรมและพัฒนาบุคลากร',
              'staff-training-internal',
              'INTERNAL',
              2,
              1,
              'อินโฟกราฟิกและคู่มือสุขภาพ',
              'infographics-and-guides',
              'ALL',
              3,
              1,
            ]
          )
        }
      })().catch((err) => {
        schemaReadyPromise = null
        throw err
      })
    }
    await schemaReadyPromise
  }

  async function fetchFullItemById(id) {
    const [rows] = await appPool.query(
      `SELECT
        i.*,
        c.name AS categoryName,
        (
          SELECT m.profile_path
          FROM members m
          WHERE (i.created_by_id IS NOT NULL AND m.id = i.created_by_id)
             OR (i.created_by_id IS NULL AND i.created_by_name IS NOT NULL AND m.name = i.created_by_name)
          LIMIT 1
        ) AS createdByProfilePath
      FROM online_media_items i
      LEFT JOIN online_media_categories c ON c.id = i.category_id
      WHERE i.id = ?
      LIMIT 1`,
      [id]
    )
    if (!rows?.[0]) return null

    const [attRows] = await appPool.query(
      'SELECT * FROM online_media_attachments WHERE media_id = ? ORDER BY display_order ASC, id ASC',
      [id]
    )
    return {
      ...rows[0],
      attachments: Array.isArray(attRows) ? attRows : [],
    }
  }

  // 1. List Categories
  fastify.get('/api/v1/app/online-media/categories', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ดึงรายการหมวดหมู่คลังสื่อออนไลน์',
      querystring: {
        type: 'object',
        properties: {
          includeInactive: { type: 'string' },
          isAuthenticated: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const includeInactive = req.query?.includeInactive === 'true' || req.query?.includeInactive === '1'
      const isAuthenticated = req.query?.isAuthenticated === 'true' || req.query?.isAuthenticated === '1'

      const whereClauses = []
      if (!includeInactive) {
        whereClauses.push('c.is_active = 1')
      }
      if (!isAuthenticated) {
        whereClauses.push("c.visibility IN ('ALL', 'PUBLIC')")
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const itemVisJoinCondition = isAuthenticated
        ? includeInactive
          ? ''
          : 'AND i.is_published = 1'
        : "AND i.is_published = 1 AND i.visibility = 'PUBLIC'"

      const [rows] = await appPool.query(
        `SELECT
          c.id,
          c.name,
          c.slug,
          c.visibility,
          c.display_order AS displayOrder,
          c.is_active AS isActive,
          c.created_at AS createdAt,
          c.updated_at AS updatedAt,
          COUNT(i.id) AS itemCount
        FROM online_media_categories c
        LEFT JOIN online_media_items i ON i.category_id = c.id ${itemVisJoinCondition}
        ${whereSql}
        GROUP BY c.id, c.name, c.slug, c.visibility, c.display_order, c.is_active, c.created_at, c.updated_at
        ORDER BY c.display_order ASC, c.id ASC`
      )
      return { success: true, data: rows }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 2. Create or Update Category
  fastify.post('/api/v1/app/online-media/categories', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'สร้างหรือแก้ไขหมวดหมู่คลังสื่อออนไลน์',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          slug: { type: 'string' },
          visibility: { type: 'string' },
          displayOrder: { type: 'number' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const {
        id,
        name,
        slug,
        visibility = 'ALL',
        displayOrder = 0,
        isActive = true,
      } = req.body || {}

      if (id) {
        const [existing] = await appPool.query(
          'SELECT id FROM online_media_categories WHERE id = ? LIMIT 1',
          [id]
        )
        if (!existing?.[0]) {
          reply.code(404)
          return { success: false, error: 'ไม่พบหมวดหมู่สื่อที่ต้องการแก้ไข' }
        }
        await appPool.query(
          `UPDATE online_media_categories
           SET name = ?, visibility = ?, display_order = ?, is_active = ?, updated_at = NOW()
           WHERE id = ?`,
          [name, visibility, displayOrder, isActive ? 1 : 0, id]
        )
        const [updated] = await appPool.query(
          'SELECT * FROM online_media_categories WHERE id = ? LIMIT 1',
          [id]
        )
        return { success: true, data: updated[0] }
      }

      const [res] = await appPool.query(
        `INSERT INTO online_media_categories (name, slug, visibility, display_order, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [name, slug || `cat-${Date.now()}`, visibility, displayOrder, isActive ? 1 : 0]
      )
      const [created] = await appPool.query(
        'SELECT * FROM online_media_categories WHERE id = ? LIMIT 1',
        [res.insertId]
      )
      return { success: true, data: created[0] }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 3. Delete Category
  fastify.delete('/api/v1/app/online-media/categories/:id', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ลบหมวดหมู่คลังสื่อออนไลน์',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const id = parseInt(req.params.id, 10)
      const [existing] = await appPool.query(
        'SELECT id, name FROM online_media_categories WHERE id = ? LIMIT 1',
        [id]
      )
      if (!existing?.[0]) {
        reply.code(404)
        return { success: false, error: 'ไม่พบหมวดหมู่สื่อที่ต้องการลบ' }
      }
      const [usedRows] = await appPool.query(
        'SELECT COUNT(*) AS cnt FROM online_media_items WHERE category_id = ?',
        [id]
      )
      if (Number(usedRows?.[0]?.cnt || 0) > 0) {
        reply.code(400)
        return {
          success: false,
          error: 'ไม่สามารถลบหมวดหมู่ที่มีรายการสื่ออยู่ได้ กรุณาย้ายหรือลบสื่อภายในหมวดหมู่นี้ก่อน',
        }
      }
      await appPool.query('DELETE FROM online_media_categories WHERE id = ?', [id])
      return { success: true, data: { name: existing[0].name } }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 4. List Media Items
  fastify.get('/api/v1/app/online-media/items', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ดึงรายการสื่อออนไลน์ตามสิทธิ์และตัวกรอง',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const q = req.query || {}
      const isAuthenticated = q.isAuthenticated === 'true' || q.isAuthenticated === '1'
      const includeUnpublished = q.includeUnpublished === 'true' || q.includeUnpublished === '1'
      const visibility = q.visibility ? String(q.visibility).toUpperCase() : undefined
      const categoryId = q.categoryId ? parseInt(q.categoryId, 10) : undefined
      const mediaType = q.mediaType ? String(q.mediaType).toUpperCase() : undefined
      const search = q.search ? String(q.search).trim() : ''

      const whereClauses = []
      const params = []

      if (!isAuthenticated) {
        whereClauses.push("i.visibility = 'PUBLIC'")
        whereClauses.push('i.is_published = 1')
      } else {
        if (visibility && visibility !== 'ALL') {
          whereClauses.push('i.visibility = ?')
          params.push(visibility)
        }
        if (!includeUnpublished) {
          whereClauses.push('i.is_published = 1')
        }
      }

      if (categoryId && Number.isFinite(categoryId)) {
        whereClauses.push('i.category_id = ?')
        params.push(categoryId)
      }

      if (mediaType && ['VIDEO', 'INFOGRAPHIC', 'DOCUMENT'].includes(mediaType)) {
        whereClauses.push('i.media_type = ?')
        params.push(mediaType)
      }

      if (search) {
        const like = `%${search}%`
        whereClauses.push('(i.title LIKE ? OR i.description LIKE ?)')
        params.push(like, like)
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
      const [rows] = await appPool.query(
        `SELECT
          i.*,
          c.name AS categoryName,
          (
            SELECT m.profile_path
            FROM members m
            WHERE (i.created_by_id IS NOT NULL AND m.id = i.created_by_id)
               OR (i.created_by_id IS NULL AND i.created_by_name IS NOT NULL AND m.name = i.created_by_name)
            LIMIT 1
          ) AS createdByProfilePath
        FROM online_media_items i
        LEFT JOIN online_media_categories c ON c.id = i.category_id
        ${whereSql}
        ORDER BY i.created_at DESC, i.id DESC`,
        params
      )

      if (!rows || rows.length === 0) {
        return { success: true, data: [] }
      }

      const mediaIds = rows.map((r) => r.id)
      const placeholders = mediaIds.map(() => '?').join(', ')
      const [attRows] = await appPool.query(
        `SELECT * FROM online_media_attachments WHERE media_id IN (${placeholders}) ORDER BY display_order ASC, id ASC`,
        mediaIds
      )

      const attMap = new Map()
      for (const att of attRows || []) {
        const list = attMap.get(att.media_id) || []
        list.push(att)
        attMap.set(att.media_id, list)
      }

      const result = rows.map((row) => ({
        ...row,
        attachments: attMap.get(row.id) || [],
      }))

      return { success: true, data: result }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 5. Get Media Item by Slug or ID (Viewer)
  fastify.get('/api/v1/app/online-media/items/:slugOrId', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ดึงรายละเอียดสื่อออนไลน์ตาม slug หรือ id',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const rawStr = String(req.params.slugOrId || '').trim()
      let decodedStr = rawStr
      try {
        decodedStr = decodeURIComponent(rawStr)
      } catch {
        decodedStr = rawStr
      }

      const isAuthenticated = req.query?.isAuthenticated === 'true' || req.query?.isAuthenticated === '1'
      const includeUnpublished = req.query?.includeUnpublished === 'true' || req.query?.includeUnpublished === '1'
      const numericId = /^\d+$/.test(decodedStr) ? parseInt(decodedStr, 10) : null
      const whereField = numericId !== null ? 'i.id = ?' : 'i.slug = ?'
      const whereParam = numericId !== null ? numericId : decodedStr

      const [rows] = await appPool.query(
        `SELECT
          i.*,
          c.name AS categoryName,
          (
            SELECT m.profile_path
            FROM members m
            WHERE (i.created_by_id IS NOT NULL AND m.id = i.created_by_id)
               OR (i.created_by_id IS NULL AND i.created_by_name IS NOT NULL AND m.name = i.created_by_name)
            LIMIT 1
          ) AS createdByProfilePath
        FROM online_media_items i
        LEFT JOIN online_media_categories c ON c.id = i.category_id
        WHERE ${whereField}
        LIMIT 1`,
        [whereParam]
      )

      const row = rows?.[0]
      if (!row) {
        return { success: true, data: { item: null, requiresAuth: false } }
      }

      const isPublished = Boolean(Number(row.is_published ?? 1))
      const visibility = String(row.visibility || 'PUBLIC').toUpperCase()

      if (!isPublished && !includeUnpublished) {
        return { success: true, data: { item: null, requiresAuth: false } }
      }

      if (visibility === 'INTERNAL' && !isAuthenticated) {
        return { success: true, data: { item: null, requiresAuth: true } }
      }

      const [attRows] = await appPool.query(
        'SELECT * FROM online_media_attachments WHERE media_id = ? ORDER BY display_order ASC, id ASC',
        [row.id]
      )

      return {
        success: true,
        data: {
          item: { ...row, attachments: attRows || [] },
          requiresAuth: false,
        },
      }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 6. Get Media Item for Manage
  fastify.get('/api/v1/app/online-media/items/:id/manage', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ดึงข้อมูลสื่อออนไลน์ฉบับเต็มสำหรับหน้าจัดการ',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const id = parseInt(req.params.id, 10)
      const item = await fetchFullItemById(id)
      if (!item) {
        reply.code(404)
        return { success: false, error: 'ไม่พบรายการสื่อที่ระบุ' }
      }
      return { success: true, data: item }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 7. Get Stream Target (raw bucket + s3Key + profile_path)
  fastify.get('/api/v1/app/online-media/items/:id/stream-target', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ดึงข้อมูล MinIO Bucket/Key และไฟล์โปรไฟล์ผู้อัปโหลดสำหรับสตรีมมิง',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const id = parseInt(req.params.id, 10)
      const attachmentId = req.query?.attachmentId ? parseInt(req.query.attachmentId, 10) : null

      const [rows] = await appPool.query(
        `SELECT
          i.*,
          (
            SELECT m.profile_path
            FROM members m
            WHERE (i.created_by_id IS NOT NULL AND m.id = i.created_by_id)
               OR (i.created_by_id IS NULL AND i.created_by_name IS NOT NULL AND m.name = i.created_by_name)
            LIMIT 1
          ) AS createdByProfilePath
        FROM online_media_items i
        WHERE i.id = ?
        LIMIT 1`,
        [id]
      )
      if (!rows?.[0]) {
        reply.code(404)
        return { success: false, error: 'Not Found' }
      }

      let attachment = null
      if (attachmentId) {
        const [attRows] = await appPool.query(
          'SELECT * FROM online_media_attachments WHERE id = ? AND media_id = ? LIMIT 1',
          [attachmentId, id]
        )
        if (!attRows?.[0]) {
          reply.code(404)
          return { success: false, error: 'Attachment Not Found' }
        }
        attachment = attRows[0]
      }

      return { success: true, data: { item: rows[0], attachment } }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 8. Create Media Item (Transactional)
  fastify.post('/api/v1/app/online-media/items', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'สร้างรายการสื่อออนไลน์ใหม่พร้อมไฟล์แนบ',
    },
  }, async (req, reply) => {
    await ensureTables()
    const body = req.body || {}
    const [catRows] = await appPool.query(
      'SELECT id FROM online_media_categories WHERE id = ? LIMIT 1',
      [body.categoryId]
    )
    if (!catRows?.[0]) {
      reply.code(400)
      return { success: false, error: 'ไม่พบหมวดหมู่สื่อที่เลือก' }
    }

    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('SET NAMES utf8mb4')

      const [res] = await conn.query(
        `INSERT INTO online_media_items (
          slug, title, description, category_id, visibility, media_type, source_type,
          s3_bucket, s3_key, youtube_url, thumbnail_s3_key, file_name, file_size, mime_type,
          allow_download, is_published, view_count, created_by_id, created_by_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW())`,
        [
          body.slug,
          body.title,
          body.description || null,
          body.categoryId,
          body.visibility,
          body.mediaType,
          body.sourceType,
          body.s3Bucket || null,
          body.s3Key || null,
          body.youtubeUrl || null,
          body.thumbnailS3Key || null,
          body.fileName || null,
          body.fileSize ?? null,
          body.mimeType || null,
          body.allowDownload ? 1 : 0,
          body.isPublished ? 1 : 0,
          body.createdById ?? null,
          body.createdByName || null,
        ]
      )

      const createdId = res.insertId
      const attachments = Array.isArray(body.attachments) ? body.attachments : []
      for (let i = 0; i < attachments.length; i++) {
        const att = attachments[i]
        await conn.query(
          `INSERT INTO online_media_attachments (
            media_id, title, s3_bucket, s3_key, file_name, file_size, mime_type, display_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            createdId,
            att.title,
            att.s3Bucket,
            att.s3Key,
            att.fileName,
            att.fileSize ?? null,
            att.mimeType || null,
            att.displayOrder ?? i,
          ]
        )
      }

      await conn.commit()
      const created = await fetchFullItemById(createdId)
      return { success: true, data: created }
    } catch (err) {
      await conn.rollback()
      reply.code(500)
      return { success: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // 9. Update Media Item (Transactional)
  fastify.put('/api/v1/app/online-media/items/:id', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'แก้ไขรายการสื่อออนไลน์และไฟล์แนบ',
    },
  }, async (req, reply) => {
    await ensureTables()
    const id = parseInt(req.params.id, 10)
    const body = req.body || {}

    const conn = await appPool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('SET NAMES utf8mb4')

      await conn.query(
        `UPDATE online_media_items
         SET title = ?, description = ?, category_id = ?, visibility = ?, media_type = ?, source_type = ?,
             s3_bucket = ?, s3_key = ?, youtube_url = ?, thumbnail_s3_key = ?,
             file_name = ?, file_size = ?, mime_type = ?, allow_download = ?, is_published = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          body.title,
          body.description || null,
          body.categoryId,
          body.visibility,
          body.mediaType,
          body.sourceType,
          body.s3Bucket || null,
          body.s3Key || null,
          body.youtubeUrl || null,
          body.thumbnailS3Key || null,
          body.fileName || null,
          body.fileSize ?? null,
          body.mimeType || null,
          body.allowDownload ? 1 : 0,
          body.isPublished ? 1 : 0,
          id,
        ]
      )

      if (Array.isArray(body.attachments)) {
        await conn.query('DELETE FROM online_media_attachments WHERE media_id = ?', [id])
        for (let i = 0; i < body.attachments.length; i++) {
          const att = body.attachments[i]
          await conn.query(
            `INSERT INTO online_media_attachments (
              media_id, title, s3_bucket, s3_key, file_name, file_size, mime_type, display_order, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
              id,
              att.title,
              att.s3Bucket,
              att.s3Key,
              att.fileName,
              att.fileSize ?? null,
              att.mimeType || null,
              att.displayOrder ?? i,
            ]
          )
        }
      }

      await conn.commit()
      const updated = await fetchFullItemById(id)
      return { success: true, data: updated }
    } catch (err) {
      await conn.rollback()
      reply.code(500)
      return { success: false, error: err.message }
    } finally {
      conn.release()
    }
  })

  // 10. Delete Media Item
  fastify.delete('/api/v1/app/online-media/items/:id', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ลบรายการสื่อออนไลน์',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const id = parseInt(req.params.id, 10)
      await appPool.query('DELETE FROM online_media_items WHERE id = ?', [id])
      return { success: true }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 11. Record Media View
  fastify.post('/api/v1/app/online-media/items/:id/view', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'บันทึกสถิติการเข้าชมสื่อออนไลน์และประวัติบุคลากร',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const id = parseInt(req.params.id, 10)
      const viewer = req.body?.viewer || null

      await appPool.query(
        'UPDATE online_media_items SET view_count = view_count + 1 WHERE id = ?',
        [id]
      )

      if (viewer && viewer.memberId) {
        const cleanName = String(viewer.memberName || 'บุคลากร').trim()
        const cleanDept = viewer.memberDepartment ? String(viewer.memberDepartment).trim() : null
        await appPool.query(
          `INSERT INTO online_media_views (media_id, member_id, member_name, member_department, view_count, first_viewed_at, last_viewed_at)
           VALUES (?, ?, ?, ?, 1, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
             view_count = view_count + 1,
             last_viewed_at = NOW(),
             member_name = VALUES(member_name),
             member_department = VALUES(member_department)`,
          [id, viewer.memberId, cleanName, cleanDept]
        )
      }

      return { success: true }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })

  // 12. List Media Viewers
  fastify.get('/api/v1/app/online-media/items/:id/viewers', {
    schema: {
      tags: ['11. CMS, RDU, Ethics & Directory'],
      summary: 'ดึงรายชื่อบุคลากรที่เข้าชมสื่อออนไลน์',
    },
  }, async (req, reply) => {
    try {
      await ensureTables()
      const id = parseInt(req.params.id, 10)
      const [rows] = await appPool.query(
        `SELECT
          id,
          media_id AS mediaId,
          member_id AS memberId,
          member_name AS memberName,
          member_department AS memberDepartment,
          view_count AS viewCount,
          first_viewed_at AS firstViewedAt,
          last_viewed_at AS lastViewedAt
        FROM online_media_views
        WHERE media_id = ?
        ORDER BY last_viewed_at DESC, id DESC`,
        [id]
      )
      return { success: true, data: rows }
    } catch (err) {
      reply.code(500)
      return { success: false, error: err.message }
    }
  })
}
