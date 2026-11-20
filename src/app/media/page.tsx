import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verifyMemberSession, fetchAuthenticatedMember } from '@/lib/memberAuth'
import { OnlineMediaService, type MediaType } from '@/lib/media/onlineMediaService'
import { siteConfig } from '@/config/site'
import MediaLibraryClient from './MediaLibraryClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'คลังสื่อออนไลน์',
  description: `คลังวิดีโอสื่อความรู้ อินโฟกราฟิก และเอกสารเผยแพร่ ${siteConfig.name}`,
}

export default async function MediaLibraryPage(props: {
  searchParams: Promise<{ scope?: string; category?: string; type?: string; q?: string }>
}) {
  const searchParams = await props.searchParams
  const rawScope = searchParams.scope?.toUpperCase()

  const session = await verifyMemberSession().catch(() => null)
  const isAuthenticated = Boolean(session)

  if (rawScope === 'INTERNAL' && !isAuthenticated) {
    redirect('/member/login')
  }

  let canManage = false
  if (session) {
    const member = await fetchAuthenticatedMember(session.username, session.email)
    if (member) {
      canManage = member.isAdmin || member.can('manage_online_media')
    }
  }

  const initialScope: 'ALL' | 'PUBLIC' | 'INTERNAL' = isAuthenticated
    ? rawScope === 'PUBLIC' || rawScope === 'INTERNAL'
      ? rawScope
      : 'ALL'
    : 'PUBLIC'

  const categoryIdNum = searchParams.category ? parseInt(searchParams.category, 10) : undefined
  const initialCategoryId =
    categoryIdNum && !isNaN(categoryIdNum) && categoryIdNum > 0 ? categoryIdNum : undefined

  const rawType = searchParams.type?.toUpperCase()
  const initialMediaType: MediaType | 'ALL' =
    rawType === 'VIDEO' || rawType === 'INFOGRAPHIC' || rawType === 'DOCUMENT' ? rawType : 'ALL'

  const [categories, items] = await Promise.all([
    OnlineMediaService.listCategories({ isAuthenticated }),
    OnlineMediaService.listMediaItems({ isAuthenticated }),
  ])

  return (
    <MediaLibraryClient
      initialCategories={categories}
      initialItems={items}
      isAuthenticated={isAuthenticated}
      canManage={canManage}
      initialScope={initialScope}
      initialCategoryId={initialCategoryId}
      initialMediaType={initialMediaType}
      initialSearch={searchParams.q || ''}
    />
  )
}
