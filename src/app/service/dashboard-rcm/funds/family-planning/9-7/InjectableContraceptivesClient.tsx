'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function InjectableContraceptivesClient({
  initialData,
  initialRange,
}: {
  initialData?: any
  initialRange?: any
}) {
  return (
    <FamilyPlanningReportClient
      reportType="9.7"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/injectable-contraceptives"
      title="9.7 ยาฉีดคุมกำเนิด (Injectable Contraceptives)"
      subtitle="รายงานการให้บริการยาฉีดคุมกำเนิด รหัส ADP: FP004 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z300, Z304), การจ่ายยา/คิดค่าบริการ, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP004"
      expectedDx="Z300"
      initialData={initialData}
      initialRange={initialRange}
    />
  )
}
