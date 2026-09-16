import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

function parseDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found at:', envPath);
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentField += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  return rows;
}

async function main() {
  parseDotEnv();

  const csvPath = process.argv[2] || process.env.CSV_IMPORT_PATH || path.resolve(process.cwd(), 'import.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    console.error('Usage: npx tsx prisma/import-csv.ts <path-to-csv>');
    process.exit(1);
  }

  console.log('Reading CSV from:', csvPath);
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const allRows = parseCsv(fileContent);

  if (allRows.length <= 1) {
    console.log('No data found or empty CSV.');
    return;
  }

  const header = allRows[0];
  console.log(`Found ${allRows.length - 1} data rows.`);

  if (!process.env.MEMBER_DB_HOST || !process.env.MEMBER_DB_USER || !process.env.MEMBER_DB_PASSWORD) {
    console.error('Missing required MEMBER_DB_* environment variables in .env');
    process.exit(1);
  }

  // Create MySQL connection using env variables
  const dbConfig = {
    host: process.env.MEMBER_DB_HOST,
    port: parseInt(process.env.MEMBER_DB_PORT || '3306'),
    user: process.env.MEMBER_DB_USER,
    password: process.env.MEMBER_DB_PASSWORD,
    database: process.env.MEMBER_DB_NAME || 'thoen_hospital_website',
    charset: 'utf8mb4',
  };

  console.log(`Connecting to database ${dbConfig.database} at ${dbConfig.host}...`);
  const connection = await mysql.createConnection(dbConfig);

  try {
    await connection.query("SET NAMES utf8mb4");
    await connection.query("SET CHARACTER SET utf8mb4");

    // 1. ล้างข้อมูลตาราง members
    console.log('Clearing existing records from table `members`...');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('TRUNCATE TABLE members');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Table `members` cleared successfully.');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    const seenUsernames = new Set<string>();
    const seenEmails = new Set<string>();

    // 2. นำเข้าข้อมูลใหม่
    for (let i = 1; i < allRows.length; i++) {
      const cols = allRows[i];
      if (!cols || cols.length === 0 || cols.every(c => !c)) {
        continue;
      }

      // Mapping ตามโครงสร้าง CSV:
      // index 1: เลขบัตรประชาชน -> username สำหรับเข้าระบบ (หรือ fallback index 14)
      // index 2: คำนำหน้า
      // index 3: ชื่อ
      // index 4: นามสกุล
      // index 10: ตำแหน่ง (position)
      // index 11: กลุ่มงาน (department)
      // index 14: ชื่อผู้ใช้งาน / Username
      // index 16: Email
      const cid = cols[1]?.trim().replace(/[^0-9]/g, '');
      const altUsername = cols[14]?.trim();
      const username = cid || altUsername;

      const title = cols[2]?.trim() || '';
      const firstName = cols[3]?.trim() || '';
      const lastName = cols[4]?.trim() || '';
      const name = `${title} ${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();

      const position = cols[10]?.trim() || null;
      const department = cols[11]?.trim() || null;
      const email = cols[16]?.trim().toLowerCase();

      if (!username || !email) {
        console.warn(`[Row ${i + 1}] Skipping: missing username or email (Name: ${name || 'N/A'}, Username: ${username || 'N/A'}, Email: ${email || 'N/A'})`);
        skipCount++;
        continue;
      }

      if (seenUsernames.has(username)) {
        console.warn(`[Row ${i + 1}] Skipping duplicate username: ${username} (${name})`);
        skipCount++;
        continue;
      }

      if (seenEmails.has(email)) {
        console.warn(`[Row ${i + 1}] Skipping duplicate email: ${email} (${name})`);
        skipCount++;
        continue;
      }

      try {
        await connection.execute(
          'INSERT INTO members (username, email, name, department, position, role) VALUES (?, ?, ?, ?, ?, ?)',
          [username, email, name, department, position, 'member']
        );
        seenUsernames.add(username);
        seenEmails.add(email);
        console.log(`[Row ${i + 1}] Inserted: ${username} | ${name} | ${department} | ${position} | ${email}`);
        successCount++;
      } catch (err: any) {
        console.error(`[Row ${i + 1}] Error inserting ${username}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n==================================');
    console.log('         IMPORT SUMMARY           ');
    console.log('==================================');
    console.log(`Successfully inserted : ${successCount} members`);
    console.log(`Skipped rows          : ${skipCount} rows`);
    console.log(`Errors encountered    : ${errorCount} rows`);

    const [finalCount]: any = await connection.query('SELECT COUNT(*) as cnt FROM members');
    console.log(`Final members table row count: ${finalCount[0].cnt}`);

  } finally {
    await connection.end();
    console.log('Database connection closed.');
  }
}

main().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});

