'use client'

import React from 'react'
import FamilyPlanningReportClient from '../FamilyPlanningReportClient'

export default function SingleHormonePillClient() {
  return (
    <FamilyPlanningReportClient
      reportType="9.5"
      apiEndpoint="/api/service/dashboard-rcm/funds/family-planning/single-hormone-pill"
      title="9.5 ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว (Single Hormone Oral Contraceptive)"
      subtitle="รายงานการให้บริการยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว รหัส ADP: FP003_2 ตรวจสอบการลงรหัสการวินิจฉัยโรค (Dx Z304), การคิดค่าบริการ/สั่งจ่ายยา, และการชดเชยค่าบริการ E-Claim / สปสช. ทั้งผู้ป่วยนอก (OPD) และผู้ป่วยใน (IPD)"
      adpCode="FP003_2"
      expectedDx="Z304"
    />
  )
}
