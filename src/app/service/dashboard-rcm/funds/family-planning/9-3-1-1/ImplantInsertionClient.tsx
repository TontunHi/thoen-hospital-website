'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function ImplantInsertionClient() {
  return (
    <FamilyPlanningReportClient
      reportType="9.3.1.1"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/implant-insertion"
      title="9.3.1.1 รายการฝังยาคุม (Contraceptive Implant Insertion)"
      subtitle="รายงานการให้บริการฝังยาคุมกำเนิด รหัส ADP: FP002_1 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z308), การคิดค่าบริการ/สั่งยา, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP002_1"
    />
  )
}
