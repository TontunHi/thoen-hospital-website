/**
 * Database Restore Script for Thoen Hospital Website
 *
 * Restores `thoen_hospital_website` from a .sql or .sql.gz backup file.
 * Includes safety confirmation check to prevent accidental database overwrites.
 *
 * Usage:
 *   npx tsx scripts/dbRestore.ts [--file=backup_file_name.sql.gz]
 */

import 'dotenv/config'
import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import readline from 'readline'

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise(resolve => rl.question(query, ans => {
    rl.close()
    resolve(ans)
  }))
}

async function runDatabaseRestore() {
  const host = process.env.MEMBER_DB_HOST || 'localhost'
  const user = process.env.MEMBER_DB_USER || 'root'
  const password = process.env.MEMBER_DB_PASSWORD || ''
  const database = process.env.MEMBER_DB_NAME || 'thoen_hospital_website'
  const port = parseInt(process.env.MEMBER_DB_PORT || '3306', 10)

  const backupsDir = path.resolve(process.cwd(), 'backups')
  if (!fs.existsSync(backupsDir)) {
    console.error('❌ Error: No backups directory found at:', backupsDir)
    process.exit(1)
  }

  const files = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup_') && (f.endsWith('.sql.gz') || f.endsWith('.sql')))
    .sort((a, b) => {
      return fs.statSync(path.join(backupsDir, b)).mtimeMs - fs.statSync(path.join(backupsDir, a)).mtimeMs
    })

  if (files.length === 0) {
    console.error('❌ Error: No backup files found in:', backupsDir)
    process.exit(1)
  }

  // Parse CLI --file argument if provided
  let selectedFile = ''
  const fileArg = process.argv.find(a => a.startsWith('--file='))
  if (fileArg) {
    selectedFile = fileArg.split('=')[1].trim()
  } else {
    // Default to the newest backup file
    selectedFile = files[0]
  }

  const backupFilePath = path.isAbsolute(selectedFile)
    ? selectedFile
    : path.join(backupsDir, selectedFile)

  if (!fs.existsSync(backupFilePath)) {
    console.error(`❌ Error: Backup file not found: ${backupFilePath}`)
    process.exit(1)
  }

  const stats = fs.statSync(backupFilePath)
  const sizeInKb = (stats.size / 1024).toFixed(2)

  console.log('\n======================================================')
  console.log('       ⚠️  DATABASE RESTORE SAFETY WARNING  ⚠️         ')
  console.log('======================================================')
  console.log(`Target Database : [${database}] on ${host}:${port}`)
  console.log(`Backup File     : ${path.basename(backupFilePath)} (${sizeInKb} KB)`)
  console.log(`Created At      : ${stats.mtime.toLocaleString('th-TH')}`)
  console.log('------------------------------------------------------')
  console.log('🚨 RESTORING WILL OVERWRITE ALL EXISTING TABLES & DATA!')
  console.log('======================================================\n')

  const answer = await askQuestion('Type "CONFIRM" to proceed with restore, or anything else to abort: ')
  if (answer.trim() !== 'CONFIRM') {
    console.log('🛑 Restore aborted by user. Database was NOT modified.')
    process.exit(0)
  }

  console.log('\n🔄 Reading backup file...')
  let sqlContent = ''
  if (backupFilePath.endsWith('.gz')) {
    const compressed = fs.readFileSync(backupFilePath)
    sqlContent = zlib.gunzipSync(compressed).toString('utf-8')
  } else {
    sqlContent = fs.readFileSync(backupFilePath, 'utf-8')
  }

  console.log('🔌 Connecting to database...')
  const connection = await mysql.createConnection({
    host,
    user,
    password,
    database,
    port,
    charset: 'utf8mb4',
    multipleStatements: true
  })

  try {
    console.log('⏳ Executing restore queries...')
    await connection.query('SET NAMES utf8mb4')
    await connection.query('SET FOREIGN_KEY_CHECKS = 0')

    await connection.query(sqlContent)

    await connection.query('SET FOREIGN_KEY_CHECKS = 1')
    console.log('✅ Database restore completed successfully!')
  } catch (err: any) {
    console.error('❌ Restore execution error:', err.message)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

runDatabaseRestore()
