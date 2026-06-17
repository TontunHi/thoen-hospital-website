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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(val => {
    let cleaned = val.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    return cleaned;
  });
}

async function main() {
  parseDotEnv();

  const csvPath = 'C:\\Users\\Tontun\\Downloads\\import.csv';
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found at:', csvPath);
    process.exit(1);
  }

  console.log('Reading CSV from:', csvPath);
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/);
  
  if (lines.length <= 1) {
    console.log('No data found or empty CSV.');
    return;
  }

  // Create MySQL connection using env variables
  const dbConfig = {
    host: process.env.MEMBER_DB_HOST || '192.168.1.7',
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

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Start from index 1 to skip header line: "Column 1,Column 2..."
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = parseCsvLine(line);
      if (columns.length < 7) {
        console.warn(`[Row ${i + 1}] Skipping incomplete row: ${line}`);
        skipCount++;
        continue;
      }

      // Column 2 = department (index 1)
      // Column 3+4+5 = name (index 2, 3, 4)
      // Column 6 = username (index 5)
      // Column 7 = email (index 6)
      const department = columns[1]?.trim() || null;
      
      const title = columns[2]?.trim() || '';
      const firstName = columns[3]?.trim() || '';
      const lastName = columns[4]?.trim() || '';
      
      // Format name nicely: "Title FirstName LastName"
      const name = `${title} ${firstName} ${lastName}`.replace(/\s+/g, ' ').trim();

      const username = columns[5]?.trim();
      const email = columns[6]?.trim().toLowerCase();

      if (!username || !email) {
        console.warn(`[Row ${i + 1}] Skipping due to missing username/email: ${line}`);
        skipCount++;
        continue;
      }

      try {
        // Check if username or email already exists
        const [existing]: any = await connection.execute(
          'SELECT id, username, email FROM members WHERE username = ? OR email = ?',
          [username, email]
        );

        if (existing && existing.length > 0) {
          // Update the existing record's name and department
          const memberId = existing[0].id;
          await connection.execute(
            'UPDATE members SET name = ?, department = ? WHERE id = ?',
            [name, department, memberId]
          );
          console.log(`[Row ${i + 1}] Updated existing user: ${username} (${email}) -> ${name}, ${department}`);
          successCount++;
        } else {
          // Insert new member
          await connection.execute(
            'INSERT INTO members (username, email, name, department, role) VALUES (?, ?, ?, ?, ?)',
            [username, email, name, department, 'member']
          );
          console.log(`[Row ${i + 1}] Inserted new user: ${username} (${email}) -> ${name}, ${department}`);
          successCount++;
        }
      } catch (err: any) {
        console.error(`[Row ${i + 1}] Error processing row: ${line}`, err.message);
        errorCount++;
      }
    }

    console.log('\n--- Import Summary ---');
    console.log(`Successfully processed: ${successCount} rows`);
    console.log(`Skipped: ${skipCount} rows`);
    console.log(`Errors: ${errorCount} rows`);

  } finally {
    await connection.end();
    console.log('Database connection closed.');
  }
}

main().catch(err => {
  console.error('Fatal error during import:', err);
  process.exit(1);
});
