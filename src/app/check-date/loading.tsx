import { SkeletonCard } from '@/components/common/Skeleton'

export default function CheckDateLoading() {
  return (
    <div className="appointPage" style={{ padding: '2rem 0' }}>
      <div className="container">
        <SkeletonCard height="450px" />
      </div>
    </div>
  )
}
