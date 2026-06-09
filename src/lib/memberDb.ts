import mysql from 'mysql2/promise'

export async function queryMemberDb(sql: string, params: any[] = []) {
  const connection = await mysql.createConnection({
    host: process.env.MEMBER_DB_HOST || '192.168.1.7',
    port: parseInt(process.env.MEMBER_DB_PORT || '3306'),
    user: process.env.MEMBER_DB_USER,
    password: process.env.MEMBER_DB_PASSWORD,
    database: process.env.MEMBER_DB_NAME || 'thoen_hospital_website',
    connectTimeout: 5000,
    charset: 'utf8mb4',
  })
  await connection.query("SET NAMES utf8mb4")
  await connection.query("SET CHARACTER SET utf8mb4")

  try {
    // Automatically initialize/check table members on connection
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Automatically initialize/check table pr_requests
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS pr_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        urgency VARCHAR(50) NOT NULL DEFAULT 'ไม่ด่วน',
        order_date DATE NULL,
        target_date DATE NULL,
        job_type TEXT NULL,
        job_type_other VARCHAR(255) NULL,
        details TEXT NULL,
        channels TEXT NULL,
        phone VARCHAR(50) NULL,
        has_cost TINYINT(1) NOT NULL DEFAULT 0,
        requester_id INT NOT NULL,
        department VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES members(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Automatically initialize/check table approval_tickets
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS approval_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_system VARCHAR(50) NOT NULL,
        source_id INT NOT NULL,
        step_number INT NOT NULL,
        assigned_position VARCHAR(100) NOT NULL,
        current_approver_id INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
        comment VARCHAR(255) NULL,
        signature_path VARCHAR(255) NULL,
        approved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (current_approver_id) REFERENCES members(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `)

    // Safely add columns if the table already exists
    try {
      await connection.execute(`
        ALTER TABLE members ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'member'
      `)
    } catch (alterError) {
      // Ignored if column already exists
    }
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

    const [results] = await connection.execute(sql, params)
    return results as any[]
  } finally {
    await connection.end()
  }
}
