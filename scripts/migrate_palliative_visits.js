require('dotenv').config()
const mysql = require('mysql2/promise')

async function run() {
  const host = process.env.APP_DB_HOST || '192.168.1.7'
  const port = parseInt(process.env.APP_DB_PORT || '3306', 10)
  const user = process.env.APP_DB_USER || 'prnew'
  const password = process.env.APP_DB_PASSWORD
  const database = process.env.APP_DB_NAME || 'thoen_hospital_website'

  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4'
  })
  await conn.query('SET NAMES utf8mb4')
  console.log('Connected to APP DB successfully!')

  // 1. Create table palliative_care_registry_visits
  console.log('Creating table palliative_care_registry_visits if not exists...')
  await conn.query(`
    CREATE TABLE IF NOT EXISTS palliative_care_registry_visits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      registry_id INT NOT NULL,
      visit_no INT NOT NULL,
      visit_date VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pcrv_registry_id (registry_id),
      INDEX idx_pcrv_visit_date (visit_date),
      UNIQUE KEY uq_pcrv_reg_visit (registry_id, visit_no),
      CONSTRAINT fk_pcrv_registry FOREIGN KEY (registry_id) REFERENCES palliative_care_registries(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)
  console.log('Table palliative_care_registry_visits verified!')

  // 2. Migrate existing records from palliative_care_registries (visits 1 to 6)
  const [registries] = await conn.query(`
    SELECT id, visit_1_date, visit_2_date, visit_3_date, visit_4_date, visit_5_date, visit_6_date
    FROM palliative_care_registries
  `)
  console.log(`Found ${registries.length} registries to check/migrate.`)

  let migratedCount = 0
  for (const reg of registries) {
    for (let v = 1; v <= 6; v++) {
      const vDate = reg[`visit_${v}_date`]
      if (vDate && String(vDate).trim()) {
        // Upsert into palliative_care_registry_visits
        await conn.query(`
          INSERT INTO palliative_care_registry_visits (registry_id, visit_no, visit_date)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE visit_date = VALUES(visit_date), updated_at = NOW()
        `, [reg.id, v, String(vDate).trim()])
        migratedCount++
      }
    }
  }
  console.log(`Successfully migrated/checked ${migratedCount} visit entries!`)

  // 3. Verify
  const [visits] = await conn.query(`
    SELECT v.id, v.registry_id, r.patient_name, v.visit_no, v.visit_date
    FROM palliative_care_registry_visits v
    JOIN palliative_care_registries r ON v.registry_id = r.id
    ORDER BY v.registry_id DESC, v.visit_no ASC
  `)
  console.log('Current visits in palliative_care_registry_visits:', visits)

  await conn.end()
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
