import { getAuthenticatedMember } from '@/lib/memberAuth'
import { internalPhoneService } from '@/lib/internalPhones/internalPhoneService'
import type { InternalPhoneListResult } from '@/lib/internalPhones/internalPhoneTypes'
import '../../../../opendesigner/build/css/tokens.css'
import InternalPhonesClient from './InternalPhonesClient'
import './internal-phones.css'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'สมุดเบอร์โทรศัพท์ภายในโรงพยาบาล | Thoen Hospital Member Portal',
  description: 'ค้นหาและจัดการข้อมูลเบอร์โทรศัพท์ภายในโรงพยาบาลเถิน แยกตามอาคาร ชั้น และห้อง/หน่วยงาน',
}

export default async function InternalPhonesPage() {
  const member = await getAuthenticatedMember({
    requiredFeature: 'feature_internal_phones',
    redirectTo: '/member',
  })

  const canManage = member.can('manage_internal_phones')

  let initialData: InternalPhoneListResult = {
    items: [],
    buildings: [],
    floorsByBuilding: {},
    stats: { totalCount: 0, buildingCount: 0, extensionCount: 0 },
  }
  let initialError: string | null = null

  try {
    initialData = await internalPhoneService.listPhones()
  } catch (err) {
    console.error('Failed to load internal phone directory:', err)
    initialError = 'ไม่สามารถเชื่อมต่อระบบฐานข้อมูลกลางเพื่อโหลดสมุดเบอร์โทรภายในได้ในขณะนี้'
  }

  return (
    <div className="ipPage">
      <div className="ipContainer">
        <InternalPhonesClient
          initialData={initialData}
          initialError={initialError}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
