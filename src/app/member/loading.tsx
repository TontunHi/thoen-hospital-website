import React from 'react'
import { SkeletonCard, SkeletonLine, SkeletonTable } from '@/components/common/Skeleton'

export default function MemberLoading() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Member greeting skeleton */}
      <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <SkeletonLine width="35%" height="2rem" />
        <SkeletonLine width="20%" height="1.1rem" />
      </div>

      {/* Summary metric cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.25rem',
        marginBottom: '2rem',
      }}>
        <SkeletonCard height="130px" />
        <SkeletonCard height="130px" />
        <SkeletonCard height="130px" />
        <SkeletonCard height="130px" />
      </div>

      {/* Main table skeleton */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid #e2e8f0',
      }}>
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  )
}
