'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function EmergencyContraceptiveClient() {
  return (
    <FamilyPlanningReportClient
      reportType="9.6"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/emergency-contraceptive"
      title="9.6 ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน (Emergency Contraceptive Pills)"
      subtitle="รายงานการให้บริการยาเม็ดคุมกำเนิดชนิดฉุกเฉิน รหัส ADP: FP003_3 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z304), การจ่ายยา/คิดค่าบริการ, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP003_3"
      expectedDx="Z304"
    />
  )
}
