'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function ImplantRemovalClient() {
  return (
    <FamilyPlanningReportClient
      reportType="9.3.1.2"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/implant-removal"
      title="9.3.1.2 รายการถอดยาคุม (Contraceptive Implant Removal)"
      subtitle="รายงานการให้บริการถอดยาคุมกำเนิด รหัส ADP: FP002_2 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z308), การคิดค่าบริการ/สั่งยา, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP002_2"
    />
  )
}
