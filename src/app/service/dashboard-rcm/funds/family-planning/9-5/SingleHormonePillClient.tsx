'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function SingleHormonePillClient({
  initialData,
  initialRange,
}: {
  initialData?: any
  initialRange?: any
}) {
  return (
    <FamilyPlanningReportClient
      reportType="9.5"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill"
      title="9.5 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดี่ยว (Progestin-Only Pills)"
      subtitle="รายงานการให้บริการยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดี่ยว รหัส ADP: FP003_2 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z304), การจ่ายยา/คิดค่าบริการ, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP003_2"
      expectedDx="Z304"
      initialData={initialData}
      initialRange={initialRange}
    />
  )
}
