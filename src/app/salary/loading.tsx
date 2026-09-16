import React from 'react'
import { SkeletonCard, SkeletonLine, SkeletonTable } from '@/components/common/Skeleton'

export default function SalaryLoading() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <SkeletonLine width="30%" height="1.8rem" />
        <SkeletonLine width="50%" height="1rem" />
      </div>

      {/* Salary period tabs & summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <SkeletonCard height="120px" />
        <SkeletonCard height="120px" />
      </div>

      {/* Payslip items table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
        <SkeletonTable rows={8} cols={4} />
      </div>
    </div>
  )
}
