import { SkeletonCard } from '@/components/common/Skeleton'

export default function SystemsLoading() {
  return (
    <div className="systemsPage" style={{ padding: '2rem 0' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          <SkeletonCard height="160px" />
          <SkeletonCard height="160px" />
          <SkeletonCard height="160px" />
          <SkeletonCard height="160px" />
          <SkeletonCard height="160px" />
          <SkeletonCard height="160px" />
        </div>
      </div>
    </div>
  )
}
