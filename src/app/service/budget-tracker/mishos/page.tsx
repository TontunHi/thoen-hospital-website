import React from 'react'
import { redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { MisHosService, THOEN_HOSPITAL_CODE } from '@/lib/budget/misHosService'
import MisHosBudgetTrackerClient from './MisHosBudgetTrackerClient'

export const metadata = {
  title: 'MIS HOS สปสช. (ส่วนกลาง) | โรงพยาบาลเถิน',
  description: 'ระบบติดตามการโอนเงินชดเชยค่าบริการ และรายงาน Statement UC จากระบบ MIS HOS สปสช.',
}

export default async function MisHosBudgetTrackerPage() {
  const session = await verifyMemberSession()
  if (!session) {
    redirect('/member/login')
  }

  // Pre-fetch initial template 0.1 (stId: 1843) and initial sub-report 1825
  const [initialTemplate, initialTableData, initialHospital] = await Promise.all([
    MisHosService.getTemplateConfig('1843', {
      year: '2568',
      hcode: THOEN_HOSPITAL_CODE,
    }),
    MisHosService.getTableData('1825', {
      hcode: THOEN_HOSPITAL_CODE,
      year: '2568',
      province: '52',
    }),
    MisHosService.getHospitalInfo(THOEN_HOSPITAL_CODE),
  ])

  return (
    <MisHosBudgetTrackerClient
      initialTemplate={initialTemplate}
      initialTableData={initialTableData}
      initialHospital={initialHospital}
      defaultHcode={THOEN_HOSPITAL_CODE}
      defaultYear="2568"
    />
  )
}
