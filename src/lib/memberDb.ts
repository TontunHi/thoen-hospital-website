import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null
let initPromise: Promise<void> | null = null

function parseDatabaseUrl(urlStr?: string) {
  if (!urlStr) return null
  try {
    const parsed = new URL(urlStr)
    return {
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    }
  } catch {
    return null
  }
}

function getPool() {
  if (!pool) {
    const dbUrlConfig = parseDatabaseUrl(process.env.DATABASE_URL)
    const host = process.env.MEMBER_DB_HOST || dbUrlConfig?.host || 'localhost'
    const port = parseInt(process.env.MEMBER_DB_PORT || String(dbUrlConfig?.port || 3306), 10)
    const user = process.env.MEMBER_DB_USER || dbUrlConfig?.user
    const password = process.env.MEMBER_DB_PASSWORD || dbUrlConfig?.password
    const database = process.env.MEMBER_DB_NAME || dbUrlConfig?.database || 'thoen_hospital_website'

    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      connectionLimit: 15,
      waitForConnections: true,
      queueLimit: 0,
      connectTimeout: 5000,
      charset: 'utf8mb4',
    })
  }
  return pool
}

async function initializeDb(poolInstance: mysql.Pool) {
  const connection = await poolInstance.getConnection()
  try {
    await connection.query("SET NAMES utf8mb4")
    await connection.query("SET CHARACTER SET utf8mb4")

    // Automatically initialize/check table members
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NULL,
        department VARCHAR(100) NULL,
        salary_user VARCHAR(100) NULL,
        salary_pass VARCHAR(100) NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        otp_code VARCHAR(10) NULL,
        otp_expiry DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        profile_path VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Safely add columns if the table already exists
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'member'
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN name VARCHAR(255) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN department VARCHAR(100) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN position VARCHAR(100) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN signature_path VARCHAR(255) NULL
      `)
    } catch (alterError) {}
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN profile_path VARCHAR(255) NULL
      `)
    } catch (alterError) {}

    // Automatically initialize/check table member_system_settings
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS member_system_settings (
        config_key VARCHAR(100) PRIMARY KEY,
        config_value VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Seed default settings values if they don't already exist
    const defaultSettings = [
      { key: 'feature_signature', val: '1' },
      { key: 'feature_salary', val: '1' },
      { key: 'feature_ita', val: '1' }
    ]
    for (const setting of defaultSettings) {
      await connection.execute(
        'INSERT IGNORE INTO member_system_settings (config_key, config_value) VALUES (?, ?)',
        [setting.key, setting.val]
      )
    }



    // Initialize Track Work System (Single Table Consolidation)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_no VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        assignees TEXT NULL,
        attachments TEXT NULL,
        status_history TEXT NULL,
        progress_notes TEXT NULL,
        completion TEXT NULL,
        review TEXT NULL,
        FOREIGN KEY (created_by) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Audit Logs Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        username VARCHAR(100) NULL,
        email VARCHAR(100) NULL,
        action_type VARCHAR(50) NOT NULL,
        target_table VARCHAR(100) NULL,
        action_details TEXT NULL,
        ip_address VARCHAR(45) NULL,
        user_agent VARCHAR(255) NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Position Permissions Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS position_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        permission_key VARCHAR(100) NOT NULL,
        position_name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_permission_position (permission_key, position_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize ITA Blogs Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ita_blogs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        slug VARCHAR(500) NULL,
        content LONGTEXT NOT NULL,
        author_id INT NOT NULL,
        author_name VARCHAR(255) NULL,
        author_position VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    try {
      await connection.execute(`
        ALTER TABLE ita_blogs ADD COLUMN slug VARCHAR(500) NULL
      `)
    } catch (alterError) {}

    // Initialize Contact Messages Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NULL,
        message TEXT NOT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)


    // Seed default permissions if table is empty
    const [existingPerms] = await connection.query('SELECT COUNT(*) as cnt FROM position_permissions')
    if ((existingPerms as any)[0]?.cnt === 0) {
      const defaultPermissions = [
        // create_work permissions
        { key: 'create_work', pos: 'เจ้าพนักงานเครื่องคอมพิวเตอร์' },
        { key: 'create_work', pos: 'นักวิชาการคอมพิวเตอร์' },
        { key: 'create_work', pos: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' },
        { key: 'create_work', pos: 'ผู้อำนวยการ' },
        // view_all_work permissions
        { key: 'view_all_work', pos: 'ผู้อำนวยการ' },
        { key: 'view_all_work', pos: 'หัวหน้ากลุ่มงานดิจิทัลทางการแพทย์' },
        { key: 'view_all_work', pos: 'นักวิชาการคอมพิวเตอร์' },
        { key: 'view_all_work', pos: 'เจ้าพนักงานเครื่องคอมพิวเตอร์' },
        // manage_news permissions
        { key: 'manage_news', pos: 'นักประชาสัมพันธ์' },
        { key: 'manage_news', pos: 'นักวิชาการคอมพิวเตอร์' },
        // view_all_salary permissions
        { key: 'view_all_salary', pos: 'เจ้าพนักงานธุรการ' }
      ]

      for (const perm of defaultPermissions) {
        await connection.execute(
          'INSERT IGNORE INTO position_permissions (permission_key, position_name) VALUES (?, ?)',
          [perm.key, perm.pos]
        )
      }
    }

    // Initialize RDU Folders Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rdu_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_name VARCHAR(255) NOT NULL UNIQUE,
        display_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize RDU Files Table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rdu_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        folder_id INT NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES rdu_folders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Telegram Linking Tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS member_telegram_links (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL UNIQUE,
        telegram_chat_id BIGINT NOT NULL UNIQUE,
        telegram_user_id BIGINT NOT NULL UNIQUE,
        telegram_username VARCHAR(100) NULL,
        first_name VARCHAR(150) NULL,
        linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
        INDEX idx_member_id (member_id),
        INDEX idx_chat_id (telegram_chat_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS telegram_link_challenges (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        member_id INT NOT NULL,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token_lookup (token_hash, expires_at),
        FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Unified Inbox System Tables
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`inbox_tasks\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`task_no\` VARCHAR(50) NOT NULL UNIQUE,
        \`task_type\` VARCHAR(50) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`urgency\` VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
        \`requester_id\` INT NOT NULL,
        \`requester_name\` VARCHAR(255) NOT NULL,
        \`requester_dept\` VARCHAR(100) NULL,
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        \`current_step_no\` INT NOT NULL DEFAULT 1,
        \`current_assignee\` INT NULL,
        \`current_role\` VARCHAR(100) NULL,
        \`reference_id\` VARCHAR(100) NULL,
        \`custom_payload\` LONGTEXT NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_task_assignee_status\` (\`current_assignee\`, \`status\`),
        INDEX \`idx_task_type_status\` (\`task_type\`, \`status\`),
        INDEX \`idx_task_requester\` (\`requester_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`inbox_task_steps\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`task_id\` VARCHAR(36) NOT NULL,
        \`step_no\` INT NOT NULL,
        \`step_name\` VARCHAR(255) NOT NULL,
        \`assignee_type\` VARCHAR(30) NOT NULL DEFAULT 'INDIVIDUAL',
        \`assigned_to_id\` INT NULL,
        \`assigned_role\` VARCHAR(100) NULL,
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'WAITING',
        \`action_taken\` VARCHAR(50) NULL,
        \`action_by\` INT NULL,
        \`action_by_name\` VARCHAR(255) NULL,
        \`action_at\` DATETIME NULL,
        \`comment\` TEXT NULL,
        \`signature_path\` VARCHAR(255) NULL,
        \`signature_hash\` VARCHAR(64) NULL,
        UNIQUE KEY \`uq_task_step_no\` (\`task_id\`, \`step_no\`),
        INDEX \`idx_step_assignee_status\` (\`assigned_to_id\`, \`status\`),
        FOREIGN KEY (\`task_id\`) REFERENCES \`inbox_tasks\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`inbox_task_audit_logs\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`task_id\` VARCHAR(36) NOT NULL,
        \`action\` VARCHAR(50) NOT NULL,
        \`performed_by\` INT NOT NULL,
        \`performer_name\` VARCHAR(255) NULL,
        \`details\` LONGTEXT NULL,
        \`ip_address\` VARCHAR(45) NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX \`idx_audit_task_id\` (\`task_id\`),
        FOREIGN KEY (\`task_id\`) REFERENCES \`inbox_tasks\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Hospital Locations Table (Sync from Gotowin)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`hospital_locations\` (
        \`id\` INT PRIMARY KEY,
        \`room_name\` VARCHAR(200) NOT NULL,
        \`floor_id\` INT NOT NULL,
        \`floor_name\` VARCHAR(50) NOT NULL,
        \`building_id\` INT NOT NULL,
        \`building_name\` VARCHAR(200) NOT NULL,
        \`full_name\` VARCHAR(500) NOT NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_loc_building_floor\` (\`building_id\`, \`floor_id\`),
        INDEX \`idx_loc_room_name\` (\`room_name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Initialize Repair Details Table (linked 1:1 with inbox_tasks)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`repair_details\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`task_id\` VARCHAR(36) NOT NULL UNIQUE,
        \`repair_type\` VARCHAR(50) NOT NULL,
        \`item_category\` VARCHAR(30) NOT NULL DEFAULT 'EQUIPMENT',
        \`equipment_number\` VARCHAR(100) NULL,
        \`equipment_name\` VARCHAR(255) NULL,
        \`non_equipment_item\` VARCHAR(255) NULL,
        \`location_id\` INT NULL,
        \`location_full_name\` VARCHAR(500) NOT NULL,
        \`symptom_detail\` TEXT NOT NULL,
        \`assigned_technician_id\` INT NULL,
        \`assigned_technician_name\` VARCHAR(255) NULL,
        \`co_workers\` JSON NULL,
        \`repair_nature\` VARCHAR(50) NOT NULL DEFAULT 'NORMAL',
        \`repair_status\` VARCHAR(50) NOT NULL DEFAULT 'WAITING',
        \`is_external_repair\` TINYINT(1) NOT NULL DEFAULT 0,
        \`external_vendor_name\` VARCHAR(255) NULL,
        \`external_reason\` TEXT NULL,
        \`cost_type\` VARCHAR(30) NOT NULL DEFAULT 'NO_COST',
        \`cost_amount\` DECIMAL(10,2) NULL,
        \`found_problem\` TEXT NULL,
        \`solution_step\` TEXT NULL,
        \`photos\` JSON NULL,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_repair_type\` (\`repair_type\`),
        INDEX \`idx_repair_status\` (\`repair_status\`),
        FOREIGN KEY (\`task_id\`) REFERENCES \`inbox_tasks\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Ensure default permission for view_all_salary and manage_rdu exists
    try {
      await connection.execute(
        'INSERT IGNORE INTO position_permissions (permission_key, position_name) VALUES (?, ?)',
        ['view_all_salary', 'เจ้าพนักงานธุรการ']
      )
      await connection.execute(
        'INSERT IGNORE INTO position_permissions (permission_key, position_name) VALUES (?, ?)',
        ['upload_salary', 'เจ้าพนักงานการเงินและบัญชี']
      )
      await connection.execute(
        'INSERT IGNORE INTO position_permissions (permission_key, position_name) VALUES (?, ?)',
        ['manage_rdu', 'เภสัชกรชำนาญการ']
      )
      await connection.execute(
        'INSERT IGNORE INTO position_permissions (permission_key, position_name) VALUES (?, ?)',
        ['manage_rdu', 'เภสัชกร']
      )
    } catch (e) {}
  } finally {
    connection.release()
  }
}

export async function queryMemberDb(sql: string, params: any[] = []) {
  const currentPool = getPool()
  
  if (!initPromise) {
    initPromise = initializeDb(currentPool)
  }
  await initPromise

  const connection = await currentPool.getConnection()
  try {
    await connection.query("SET NAMES utf8mb4")
    const [results] = await connection.execute(sql, params)

    // Capture DB modification queries for audit logs
    const trimmedSql = sql.trim().toUpperCase()
    const isModify = /^(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)/.test(trimmedSql)
    const isAuditLogWrite = /INSERT\s+INTO\s+AUDIT_LOGS/i.test(sql)

    if (isModify && !isAuditLogWrite) {
      // Extract target table name from sql
      let targetTable = 'unknown'
      const tableMatch = sql.match(/(?:from|into|update|table)\s+[\`"']?([a-zA-Z0-9_\-]+)[\`"']?/i)
      if (tableMatch) {
        targetTable = tableMatch[1]
      }

      let actionType = 'UPDATE'
      if (trimmedSql.startsWith('INSERT')) actionType = 'CREATE'
      else if (trimmedSql.startsWith('DELETE')) actionType = 'DELETE'
      else if (trimmedSql.startsWith('CREATE') || trimmedSql.startsWith('DROP') || trimmedSql.startsWith('ALTER')) actionType = 'SYSTEM'

      const { logAudit } = await import('./audit')
      
      // Sanitize params to avoid logging passwords, OTPs, or tokens in audit logs
      const sanitizedParams = params.map((param: any) => {
        if (typeof param === 'string' && param.length >= 6) {
          // If query mentions password, otp, or secret, mask the corresponding values
          if (/password|salary_pass|otp_code|token|secret/i.test(sql)) {
            return '***REDACTED***'
          }
        }
        return param
      })

      const { logger } = await import('./logger')
      logAudit(
        actionType as any,
        targetTable,
        `SQL: ${sql} | Params: ${JSON.stringify(sanitizedParams)}`
      ).catch(err => logger.error({ err }, 'Failed to write CRUD audit log'))
    }

    return results as any[]
  } finally {
    connection.release()
  }
}
