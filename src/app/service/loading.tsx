import React from 'react'
import { SkeletonLine, SkeletonTable } from '@/components/common/Skeleton'

export default function ServiceLoading() {
  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <SkeletonLine width="25%" height="1.8rem" />
        <SkeletonLine width="45%" height="1rem" />
      </div>

      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid #e2e8f0',
      }}>
        <SkeletonTable rows={6} cols={5} />
      </div>
    </div>
  )
}
