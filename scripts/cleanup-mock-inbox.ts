import 'dotenv/config'
import { queryMemberDb } from '../src/lib/memberDb'

async function cleanupMockData() {
  try {
    console.log('--- Cleaning up mock tasks for production ---')

    const mockTaskNos = [
      'IT-6910-0001',
      'GN-6910-0002',
      'MED-6910-0003',
      'PR-6910-0004',
      'RM-6910-0005',
      'DOC-6910-0006',
    ]

    for (const taskNo of mockTaskNos) {
      const taskRows = await queryMemberDb('SELECT id FROM inbox_tasks WHERE task_no = ?', [taskNo])
      for (const t of taskRows) {
        await queryMemberDb('DELETE FROM repair_details WHERE task_id = ?', [t.id])
        await queryMemberDb('DELETE FROM inbox_task_steps WHERE task_id = ?', [t.id])
        await queryMemberDb('DELETE FROM inbox_task_audit_logs WHERE task_id = ?', [t.id])
        await queryMemberDb('DELETE FROM inbox_tasks WHERE id = ?', [t.id])
        console.log(`✓ Deleted task ${taskNo} (${t.id})`)
      }
    }

    const remaining = await queryMemberDb('SELECT COUNT(*) as count FROM inbox_tasks')
    console.log('Remaining inbox tasks in database:', remaining[0]?.count)
    console.log('--- Cleanup complete! ---')
  } catch (err) {
    console.error('Cleanup error:', err)
  }
}

cleanupMockData()
