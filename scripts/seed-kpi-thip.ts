import 'dotenv/config'
import fs from 'fs'
import mysql from 'mysql2/promise'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentField.trim())
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentField = ''
    } else {
      currentField += char
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow)
    }
  }
  return rows
}

function parseTarget(raw?: string | null): { operator: string | null; value: number | null; unit: string | null } {
  if (!raw || !raw.trim()) return { operator: null, value: null, unit: null }
  const text = raw.trim()
  if (text.includes('น้อยที่สุด')) return { operator: 'MIN', value: null, unit: null }
  if (text === '0') return { operator: '<=', value: 0, unit: '' }

  let op: string | null = null
  if (text.startsWith('>=') || text.startsWith('≥')) op = '>='
  else if (text.startsWith('<=') || text.startsWith('≤')) op = '<='
  else if (text.startsWith('>')) op = '>'
  else if (text.startsWith('<')) op = '<'
  else if (text.startsWith('=')) op = '='

  const matchNum = text.match(/(\d+(?:\.\d+)?)/)
  const val = matchNum ? parseFloat(matchNum[1]) : null
  const unit = text.includes('%') || text.includes('ร้อยละ') ? '%' : null

  return { operator: op || (val !== null ? '>=' : null), value: val, unit }
}

async function main() {
  const filePath = 'c:\\Users\\Tontun\\Downloads\\ติดตามตัวชี้วัด 2570  ผอ. - THIP70final(127ข้อ).csv'
  console.log(`📖 Reading CSV file: ${filePath}`)
  const content = fs.readFileSync(filePath, 'utf8')
  const rows = parseCSV(content)
  console.log(`Parsed ${rows.length} rows (including header)`)

  const connection = await mysql.createConnection({
    host: '192.168.1.7',
    port: 3306,
    user: 'prnew',
    password: process.env.APP_DB_PASSWORD || 'PRnew11152@',
    database: 'thoen_hospital_website',
    charset: 'utf8mb4'
  })

  await connection.query('SET NAMES utf8mb4')
  await connection.query('SET CHARACTER SET utf8mb4')

  const fiscalYear = '2570'
  const code = 'THIP70final'
  const title = 'ตัวชี้วัด THIP ประจำปีงบประมาณ 2570'
  const description = 'การกำกับและติดตามตัวชี้วัดคุณภาพโรงพยาบาลเถิน THIP70final ประจำปีงบประมาณ 2570 (127 ข้อ)'

  const [existingTopic]: any = await connection.query(
    'SELECT id FROM kpi_topics WHERE fiscal_year = ? AND code = ?',
    [fiscalYear, code]
  )

  let topicId: number
  if (existingTopic.length > 0) {
    topicId = existingTopic[0].id
    console.log(`Found existing topic ID: ${topicId}`)
  } else {
    const [insertRes]: any = await connection.query(
      'INSERT INTO kpi_topics (fiscal_year, code, title, description, is_active) VALUES (?, ?, ?, ?, 1)',
      [fiscalYear, code, title, description]
    )
    topicId = insertRes.insertId
    console.log(`Created new topic with ID: ${topicId}`)
  }

  // Clear previous indicators
  await connection.query('DELETE FROM kpi_indicators WHERE topic_id = ?', [topicId])
  console.log(`Cleared previous indicators for topic ${topicId}`)

  let inserted = 0
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const sequence = r[0] || null
    const category = r[1] || 'ทั่วไป'
    const subcategory = r[2] || null
    const indCode = r[3] || null
    const oldCode = r[4] || null
    const frequency = r[5] || 'รายปี'
    const indTitle = r[6]
    if (!indTitle) continue

    const numeratorName = r[7] || null
    const denominatorName = r[8] || null
    const targetRaw = r[9] || null
    const { operator, value, unit } = parseTarget(targetRaw)
    const responsibleName = r[10] || null
    const indicatorType = r[13] || null

    await connection.query(`
      INSERT INTO kpi_indicators (
        topic_id, sequence, category, subcategory, code, old_code,
        frequency, title, numerator_name, denominator_name,
        target_raw, target_operator, target_value, target_unit,
        responsible_name, indicator_type, display_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      topicId, sequence, category, subcategory, indCode, oldCode,
      frequency, indTitle, numeratorName, denominatorName,
      targetRaw, operator, value, unit,
      responsibleName, indicatorType, i
    ])
    inserted++
  }

  console.log(`🎉 Successfully inserted ${inserted} indicators for topic ${code} (${fiscalYear}) with proper UTF-8!`)

  // Check sample
  const [samples]: any = await connection.query('SELECT id, sequence, title, frequency, target_raw, target_operator, target_value, responsible_name FROM kpi_indicators LIMIT 3')
  console.log('Sample rows in DB:')
  console.log(samples)

  await connection.end()
}

main().catch(err => {
  console.error('Seed error:', err)
  process.exit(1)
})
