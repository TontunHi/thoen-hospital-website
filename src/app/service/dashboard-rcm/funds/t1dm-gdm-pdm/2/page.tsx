import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { RcmT1dmGdmPdmService } from '@/lib/clinical/rcmT1dmGdmPdmService'
import T1dmGdmPdm2Client from './T1dmGdmPdm2Client'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'รายชื่อผู้รับบริการ - กองทุน T1DM/GDM/PDM | ระบบ RCM โรงพยาบาลเถิน',
  description:
    'รายงานรายชื่อผู้รับบริการกองทุน T1DM/GDM/PDM ตรวจสอบการลงทะเบียน การวินิจฉัยโรคเบาหวานขณะตั้งครรภ์ และสถานะชดเชยค่าบริการทางการแพทย์',
}

export default async function T1dmGdmPdmRecipientsPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login?returnUrl=/service/dashboard-rcm/funds/t1dm-gdm-pdm/2')
  }

  if (session.role !== 'admin' && session.role !== 'staff' && session.role !== 'member') {
    redirect('/service')
  }

  // Preload initial data for zero-skeleton first paint
  let initialData = null
  try {
    initialData = await RcmT1dmGdmPdmService.getRecipientsReport({
      page: 1,
      pageSize: 50,
      cardFilter: 'ALL',
      sortBy: 'vstdate',
      sortOrder: 'desc',
    })
  } catch (error: unknown) {
    const err = error as Error
    logger.error({ error: err.message }, 'Failed to preload T1DM recipients initial data')
  }

  return <T1dmGdmPdm2Client initialData={initialData} />
}
