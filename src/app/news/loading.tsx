import { SkeletonCard } from '@/components/common/Skeleton'

export default function NewsLoading() {
  return (
    <div className="container newsListPage" style={{ padding: '2rem 0' }}>
      <SkeletonCard height="80px" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <SkeletonCard height="70px" />
        <SkeletonCard height="70px" />
        <SkeletonCard height="70px" />
        <SkeletonCard height="70px" />
      </div>
    </div>
  )
}
