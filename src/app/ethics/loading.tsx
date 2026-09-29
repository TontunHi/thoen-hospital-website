import { SkeletonCard } from '@/components/common/Skeleton'

export default function EthicsLoading() {
  return (
    <div className="ethics-page" style={{ padding: '2rem 0' }}>
      <div className="container">
        <SkeletonCard height="400px" />
      </div>
    </div>
  )
}
