import React from 'react'
import { SkeletonCard, SkeletonLine } from '@/components/common/Skeleton'

export default function RootLoading() {
  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '2rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem',
    }}>
      {/* Header skeleton */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <SkeletonLine width="30%" height="2rem" />
        <SkeletonLine width="50%" height="1.2rem" />
      </div>

      {/* Hero cards skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.5rem',
      }}>
        <SkeletonCard height="160px" />
        <SkeletonCard height="160px" />
        <SkeletonCard height="160px" />
      </div>

      {/* Content skeleton */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '1.5rem',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}>
        <SkeletonLine width="20%" height="1.5rem" />
        <SkeletonLine width="100%" height="1rem" />
        <SkeletonLine width="90%" height="1rem" />
        <SkeletonLine width="95%" height="1rem" />
        <SkeletonLine width="60%" height="1rem" />
      </div>
    </div>
  )
}
