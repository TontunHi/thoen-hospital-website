import { SkeletonCard } from '@/components/common/Skeleton'

export default function ItaLoading() {
  return (
    <div className="ita-page" style={{ padding: '2rem 0' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <SkeletonCard height="220px" />
          <SkeletonCard height="220px" />
          <SkeletonCard height="220px" />
        </div>
      </div>
    </div>
  )
}
