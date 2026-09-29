import { SkeletonCard } from '@/components/common/Skeleton'

export default function PackageLoading() {
  return (
    <div className="packagePage" style={{ padding: '2rem 0' }}>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          <SkeletonCard height="380px" />
          <SkeletonCard height="380px" />
          <SkeletonCard height="380px" />
        </div>
      </div>
    </div>
  )
}
