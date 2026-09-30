import { redirect } from 'next/navigation'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { hospitalAssetService } from '@/lib/assets/assetService'
import AssetsDashboardClient from './AssetsDashboardClient'

export const metadata = {
  title: 'ระบบจัดการข้อมูลครุภัณฑ์ | โรงพยาบาลเถิน',
  description: 'แดชบอร์ดจัดการข้อมูลครุภัณฑ์ ตรวจสอบสถานะการรับประกัน และสถิติสำหรับเจ้าหน้าที่โรงพยาบาลเถิน',
}

export default async function AssetsDashboardPage() {
  const member = await getAuthenticatedMember()

  if (!member) {
    redirect('/member/login')
  }

  // Defensive Server-Side RBAC check: Admin or position with 'manage_assets'
  const isAuthorized = member.isAdmin || member.can('manage_assets')

  if (!isAuthorized) {
    redirect('/member')
  }

  // Fetch initial statistics on Server-side for instant render
  const initialStats = await hospitalAssetService.getAssetStats()

  return (
    <AssetsDashboardClient
      initialStats={initialStats}
      currentUser={{
        username: member.username,
        name: member.name || member.username,
        role: member.role,
      }}
    />
  )
}
