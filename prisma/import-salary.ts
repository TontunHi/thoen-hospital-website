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

async function main() {
  parseDotEnv();

  // Config for Salary DB (external)
  const salaryDbConfig = {
    host: process.env.SALARY_DB_HOST || '192.168.1.4',
    port: parseInt(process.env.SALARY_DB_PORT || '3306'),
    user: process.env.SALARY_DB_USER || 'guest',
    password: process.env.SALARY_DB_PASSWORD || 'guest',
    database: process.env.SALARY_DB_NAME || 'salary',
    charset: 'tis620', // From .env
  };

  // Config for Member DB (local/target)
  const memberDbConfig = {
    host: process.env.MEMBER_DB_HOST || '192.168.1.7',
    port: parseInt(process.env.MEMBER_DB_PORT || '3306'),
    user: process.env.MEMBER_DB_USER,
    password: process.env.MEMBER_DB_PASSWORD,
    database: process.env.MEMBER_DB_NAME || 'thoen_hospital_website',
    charset: 'utf8mb4',
  };

  console.log(`Connecting to Salary DB at ${salaryDbConfig.host}...`);
  let salaryConnection;
  try {
    salaryConnection = await mysql.createConnection(salaryDbConfig);
  } catch (err: any) {
    console.error('Failed to connect to external Salary DB:', err.message);
    process.exit(1);
  }

  console.log(`Connecting to Member DB at ${memberDbConfig.host}...`);
  let memberConnection;
  try {
    memberConnection = await mysql.createConnection(memberDbConfig);
    await memberConnection.query("SET NAMES utf8mb4");
    await memberConnection.query("SET CHARACTER SET utf8mb4");
  } catch (err: any) {
    console.error('Failed to connect to Member DB:', err.message);
    await salaryConnection.end();
    process.exit(1);
  }

  try {
    console.log('Fetching user credentials from Salary DB...');
    // The query is on the 'username' table
    const [salaryRows]: any = await salaryConnection.execute(
      'SELECT user_name, user_pass FROM username'
    );

    console.log(`Retrieved ${salaryRows.length} users from Salary DB.`);

    let matchedCount = 0;
    let notMatchedCount = 0;
    let errorCount = 0;

    for (const row of salaryRows) {
      const user_name = row.user_name?.trim();
      const user_pass = row.user_pass?.trim();

      if (!user_name) continue;

      try {
        // Find matching member by username
        const [members]: any = await memberConnection.execute(
          'SELECT id, username FROM members WHERE username = ?',
          [user_name]
        );

        if (members && members.length > 0) {
          // Update the matched member with salary credentials
          await memberConnection.execute(
            'UPDATE members SET salary_user = ?, salary_pass = ? WHERE id = ?',
            [user_name, user_pass, members[0].id]
          );
          console.log(`[Matched] Updated salary credentials for member username: ${user_name}`);
          matchedCount++;
        } else {
          // No match in members table
          notMatchedCount++;
        }
      } catch (err: any) {
        console.error(`Error processing salary user ${user_name}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n--- Salary Import Summary ---');
    console.log(`Successfully matched and updated: ${matchedCount} members`);
    console.log(`Salary users with no match in member table: ${notMatchedCount}`);
    console.log(`Errors: ${errorCount}`);

  } finally {
    await salaryConnection.end();
    await memberConnection.end();
    console.log('Database connections closed.');
  }
}

main().catch(err => {
  console.error('Fatal error during salary import:', err);
  process.exit(1);
});
