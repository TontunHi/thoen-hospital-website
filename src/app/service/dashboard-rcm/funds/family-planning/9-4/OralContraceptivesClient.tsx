'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function OralContraceptivesClient({
  initialData,
  initialRange,
}: {
  initialData?: any
  initialRange?: any
}) {
  return (
    <FamilyPlanningReportClient
      reportType="9.4"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/oral-contraceptives"
      title="9.4 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม (Combined Oral Contraceptive Pills)"
      subtitle="รายงานการให้บริการยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม รหัส ADP: FP003_1 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z304), การจ่ายยา/คิดค่าบริการ, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP003_1"
      expectedDx="Z304"
      initialData={initialData}
      initialRange={initialRange}
    />
  )
}
