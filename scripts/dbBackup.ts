/**
 * Database Backup Script for Thoen Hospital Website
 *
 * Backups all tables in `thoen_hospital_website` (DDL + Data)
 * Compresses output using Gzip (.sql.gz)
 * Enforces 30-day retention policy (auto-purges old backups)
 * Optionally syncs to hospital network share/NAS if BACKUP_NETWORK_PATH is set in .env
 *
 * Usage:
 *   npx tsx scripts/dbBackup.ts
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'

const RETENTION_DAYS = 30

export async function runDatabaseBackup(): Promise<string> {
  const host = process.env.MEMBER_DB_HOST || 'localhost'
  const user = process.env.MEMBER_DB_USER || 'root'
  const password = process.env.MEMBER_DB_PASSWORD || ''
  const database = process.env.MEMBER_DB_NAME || 'thoen_hospital_website'
  const port = parseInt(process.env.MEMBER_DB_PORT || '3306', 10)

  console.log(`\n📦 Starting Database Backup for [${database}] on ${host}:${port}...`)

  const connection = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    charset: 'utf8mb4'
  })

  // Ensure utf8mb4 for session
  await connection.query('SET NAMES utf8mb4')
  await connection.query('SET CHARACTER SET utf8mb4')

  try {
    // 1. Prepare backups directory
    const backupsDir = path.resolve(process.cwd(), 'backups')
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const backupFileName = `backup_${database}_${timestamp}.sql`
    const backupGzFileName = `${backupFileName}.gz`
    const backupGzFilePath = path.join(backupsDir, backupGzFileName)

    // 2. Fetch all table names
    const [tablesResult]: any = await connection.query('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')
    const tableKey = `Tables_in_${database}`
    const tableNames: string[] = tablesResult.map((row: any) => row[tableKey] || Object.values(row)[0])

    console.log(`📋 Found ${tableNames.length} table(s) to backup: ${tableNames.join(', ')}`)

    let dumpContent = ''
    dumpContent += `-- ========================================================\n`
    dumpContent += `-- Thoen Hospital Website Database Backup\n`
    dumpContent += `-- Database: ${database}\n`
    dumpContent += `-- Date/Time: ${new Date().toISOString()}\n`
    dumpContent += `-- ========================================================\n\n`
    dumpContent += `SET NAMES utf8mb4;\n`
    dumpContent += `SET FOREIGN_KEY_CHECKS = 0;\n\n`

    for (const tableName of tableNames) {
      console.log(`   - Dumping table structure & data: ${tableName}`)

      // A. Structure (SHOW CREATE TABLE)
      const [createTableResult]: any = await connection.query(`SHOW CREATE TABLE \`${tableName}\``)
      const createTableSql = createTableResult[0]['Create Table']

      dumpContent += `-- --------------------------------------------------------\n`
      dumpContent += `-- Table structure for \`${tableName}\`\n`
      dumpContent += `-- --------------------------------------------------------\n`
      dumpContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`
      dumpContent += `${createTableSql};\n\n`

      // B. Data (SELECT *)
      const [rows]: any = await connection.query(`SELECT * FROM \`${tableName}\``)
      if (rows.length > 0) {
        dumpContent += `-- Dumping data for table \`${tableName}\` (${rows.length} rows)\n`

        const columns = Object.keys(rows[0])
        const columnList = columns.map(c => `\`${c}\``).join(', ')

        // Insert in batches of 100 rows
        const batchSize = 100
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize)
          const valueStrings = batch.map((row: any) => {
            const values = columns.map(col => {
              const val = row[col]
              if (val === null || val === undefined) return 'NULL'
              if (typeof val === 'boolean') return val ? '1' : '0'
              if (typeof val === 'number') return String(val)
              if (val instanceof Date) {
                return mysql.escape(val.toISOString().slice(0, 19).replace('T', ' '))
              }
              if (Buffer.isBuffer(val)) {
                return `X'${val.toString('hex')}'`
              }
              return mysql.escape(String(val))
            })
            return `(${values.join(', ')})`
          })

          dumpContent += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n${valueStrings.join(',\n')};\n`
        }
        dumpContent += `\n`
      }
    }

    dumpContent += `SET FOREIGN_KEY_CHECKS = 1;\n`
    dumpContent += `-- Backup completed successfully.\n`

    // 3. Compress using Gzip
    const uncompressedBuffer = Buffer.from(dumpContent, 'utf-8')
    const compressedBuffer = zlib.gzipSync(uncompressedBuffer)
    fs.writeFileSync(backupGzFilePath, compressedBuffer)

    const sizeInKb = (compressedBuffer.length / 1024).toFixed(2)
    console.log(`✅ Backup successfully created and compressed:`)
    console.log(`   📁 File: ${backupGzFilePath} (${sizeInKb} KB)`)

    // 4. Copy to Network Share / NAS if configured
    const networkPath = process.env.BACKUP_NETWORK_PATH?.trim()
    if (networkPath && fs.existsSync(networkPath)) {
      try {
        const destPath = path.join(networkPath, backupGzFileName)
        fs.copyFileSync(backupGzFilePath, destPath)
        console.log(`🌐 Synced to Network Share: ${destPath}`)
      } catch (copyErr: any) {
        console.warn(`⚠️ Warning: Failed to sync backup to network share: ${copyErr.message}`)
      }
    }

    // 5. Purge backups older than RETENTION_DAYS
    purgeOldBackups(backupsDir, RETENTION_DAYS)

    return backupGzFilePath
  } catch (error: any) {
    console.error(`❌ Backup failed: ${error.message}`)
    throw error
  } finally {
    await connection.end()
  }
}

function purgeOldBackups(directory: string, days: number) {
  try {
    const files = fs.readdirSync(directory)
    const now = Date.now()
    const maxAgeMs = days * 24 * 60 * 60 * 1000
    let purgedCount = 0

    for (const file of files) {
      if (!file.startsWith('backup_') || (!file.endsWith('.sql.gz') && !file.endsWith('.sql'))) {
        continue
      }
      const filePath = path.join(directory, file)
      const stats = fs.statSync(filePath)
      if (now - stats.mtimeMs > maxAgeMs) {
        fs.unlinkSync(filePath)
        purgedCount++
        console.log(`   🗑️ Purged expired backup (${days}+ days): ${file}`)
      }
    }
    if (purgedCount > 0) {
      console.log(`🧹 Retention check: Purged ${purgedCount} expired backup file(s).`)
    }
  } catch (err: any) {
    console.warn(`⚠️ Failed during old backup purging: ${err.message}`)
  }
}

// Allow direct execution from CLI
if (require.main === module || (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename))) {
  runDatabaseBackup()
    .then(() => {
      console.log('✨ Backup task finished.')
      process.exit(0)
    })
    .catch(() => {
      process.exit(1)
    })
}
