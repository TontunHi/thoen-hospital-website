import React from 'react'
import Link from 'next/link'
import { Layers, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'แหล่งงบประมาณอื่น (Planfin / งบลงทุน) | โรงพยาบาลเถิน',
  description: 'ระบบติดตามแผนเงินบำรุง Planfin หรืองบลงทุน โรงพยาบาลเถิน',
}

export default function PlanfinBudgetTrackerPage() {
  return (
    <div className="bt-panel">
      <div className="bt-empty-state">
        <Layers size={48} style={{ color: '#94a3b8', margin: '0 auto 1.25rem auto' }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.75rem 0' }}>
          แหล่งงบประมาณอื่น (Planfin / งบลงทุน)
        </h3>
        <p style={{ maxWidth: '560px', margin: '0 auto 1.5rem auto', color: '#64748b', lineHeight: 1.6 }}>
          ระบบจัดเตรียมโครงสร้างสถาปัตยกรรมแบบแยกหน้า (Modular Sub-routes) เพื่อรองรับการเชื่อมโยงข้อมูลจากแหล่งงบประมาณอื่นๆ เช่น แผนเงินบำรุง Planfin, งบจัดสรร สสจ., หรืองบลงทุนในอนาคตได้อย่างสะดวกและเป็นระเบียบ
        </p>
        <Link
          href="/service/budget-tracker/rh1"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={16} />
          <span>กลับไปยัง ผลงานชดเชย เขต 1 (MIS HOS เขต 1)</span>
        </Link>
      </div>
    </div>
  )
}
