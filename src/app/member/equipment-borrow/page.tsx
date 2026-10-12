import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { equipmentBorrowService } from '@/lib/equipment/equipmentBorrowService'
import EquipmentBorrowClient from './EquipmentBorrowClient'

export const metadata = {
  title: 'ระบบยืม-คืนอุปกรณ์และพัสดุ | โรงพยาบาลเถิน',
  description: 'ระบบยืม-คืนอุปกรณ์ ครุภัณฑ์ และเบิกจ่ายวัสดุสำหรับเจ้าหน้าที่โรงพยาบาลเถิน',
}

export default async function EquipmentBorrowPage() {
  const member = await getAuthenticatedMember()

  if (!member) {
    redirect('/member/login')
  }

  // Fetch initial dashboard statistics on Server-side for instant render
  let initialStats = {
    totalItems: 0,
    availableItems: 0,
    borrowedItems: 0,
    overdueRequests: 0,
  }

  try {
    initialStats = await equipmentBorrowService.getBorrowDashboardStats()
  } catch {
    // Graceful fallback if database connection has temporary latency
  }

  const canManageBorrow = member.isAdmin || member.can('manage_borrow')

  return (
    <EquipmentBorrowClient
      initialStats={initialStats}
      currentUser={{
        id: member.id,
        username: member.username,
        name: member.name || member.username,
        role: member.role,
        department: member.department,
        isAdmin: member.isAdmin,
        canManageBorrow,
      }}
    />
  )
}
