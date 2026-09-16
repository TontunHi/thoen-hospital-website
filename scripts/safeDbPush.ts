/**
 * Pre-Migration Safety Guard for Prisma
 *
 * Automatically triggers a full database backup before running `prisma db push`.
 * Prevents accidental data loss by ensuring an immediate recovery point exists.
 *
 * Usage:
 *   npx tsx scripts/safeDbPush.ts
 */

import { spawnSync } from 'child_process'
import { runDatabaseBackup } from './dbBackup'

async function main() {
  console.log('🛡️ ========================================================')
  console.log('🛡️       PRISMA SAFE-PUSH: PRE-MIGRATION GUARD             ')
  console.log('🛡️ ========================================================')

  // Step 1: Execute auto-backup
  try {
    console.log('🔒 Step 1/2: Creating automatic backup before applying schema changes...')
    const backupPath = await runDatabaseBackup()
    console.log(`✅ Automatic backup ready at: ${backupPath}`)
  } catch (err: any) {
    console.error('❌ ABORTING: Auto-backup failed! Schema changes were NOT applied to protect data.')
    console.error(`Error details: ${err.message}`)
    process.exit(1)
  }

  // Step 2: Run Prisma DB Push
  console.log('\n🚀 Step 2/2: Running `prisma db push`...')
  console.log('⚠️ Reminder: If Prisma asks to accept data loss, double-check your schema changes!')

  const result = spawnSync('cmd.exe', ['/c', 'npx prisma db push'], {
    stdio: 'inherit',
    shell: true
  })

  if (result.status !== 0) {
    console.error('\n❌ `prisma db push` exited with an error.')
    console.log('💡 Note: Your previous database state is safely saved in the `backups/` folder.')
    console.log('💡 You can run `npm run db:restore` if you need to rollback.')
    process.exit(result.status || 1)
  }

  console.log('\n✨ Database schema synchronized safely!')
}

main().catch(err => {
  console.error('Fatal error in safeDbPush:', err)
  process.exit(1)
})
