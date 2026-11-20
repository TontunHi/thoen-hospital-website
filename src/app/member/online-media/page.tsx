import type { Metadata } from 'next'
import { getAuthenticatedMember } from '@/lib/memberAuth'
import { OnlineMediaService } from '@/lib/media/onlineMediaService'
import OnlineMediaManageClient from './OnlineMediaManageClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'จัดการคลังสื่อออนไลน์ | Thoen Hospital Member Portal',
  description: 'อัปโหลดสื่อวิดีโอ อินโฟกราฟิก PDF ขึ้น MinIO และจัดการสิทธิ์สื่อสาธารณะ/ภายในบุคลากร',
}

export default async function MemberOnlineMediaPage() {
  await getAuthenticatedMember({
    requiredPermission: 'manage_online_media',
    redirectTo: '/member',
  })

  const [categories, items] = await Promise.all([
    OnlineMediaService.listCategories({ includeInactive: true, isAuthenticated: true }),
    OnlineMediaService.listMediaItems({
      visibility: 'ALL',
      includeUnpublished: true,
      isAuthenticated: true,
    }),
  ])

  return <OnlineMediaManageClient initialCategories={categories} initialItems={items} />
}
