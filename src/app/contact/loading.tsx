import { SkeletonCard } from '@/components/common/Skeleton'

export default function ContactLoading() {
  return (
    <div className="contact-page" style={{ padding: '2rem 0' }}>
      <div className="container">
        <SkeletonCard height="500px" />
      </div>
    </div>
  )
}
