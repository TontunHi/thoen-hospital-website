'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function InjectableContraceptivesClient() {
  return (
    <FamilyPlanningReportClient
      reportType="9.7"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/injectable-contraceptives"
      title="9.7 ยาฉีดคุมกำเนิด (Injectable Contraceptives)"
      subtitle="รายงานการให้บริการยาฉีดคุมกำเนิด รหัส ADP: FP003_4 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z304), การจ่ายยา/คิดค่าบริการ, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP003_4"
      expectedDx="Z304"
    />
  )
}
