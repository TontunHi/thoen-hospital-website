import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { verifyMemberSession } from '@/lib/memberAuth'
import { OnlineMediaService } from '@/lib/media/onlineMediaService'
import { siteConfig } from '@/config/site'
import MediaDetailClient from './MediaDetailClient'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await props.params
  const session = await verifyMemberSession().catch(() => null)
  const result = await OnlineMediaService.getMediaItemBySlugOrId(slug, {
    isAuthenticated: Boolean(session),
  })

  if (!result.item) {
    return {
      title: `คลังสื่อออนไลน์ | ${siteConfig.name}`,
    }
  }

  return {
    title: result.item.title,
    description: result.item.description || `สื่อออนไลน์ ${siteConfig.name}`,
  }
}

export default async function MediaDetailPage(props: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await props.params
  const session = await verifyMemberSession().catch(() => null)
  const isAuthenticated = Boolean(session)

  const result = await OnlineMediaService.getMediaItemBySlugOrId(slug, {
    isAuthenticated,
  })

  if (result.requiresAuth) {
    redirect('/member/login')
  }

  if (!result.item) {
    notFound()
  }

  const currentItem = result.item
  const allVisible = await OnlineMediaService.listMediaItems({ isAuthenticated })
  const relatedItems = allVisible
    .filter((i) => i.id !== currentItem.id)
    .sort((a, b) => {
      const aCatMatch = a.categoryId === currentItem.categoryId ? 1 : 0
      const bCatMatch = b.categoryId === currentItem.categoryId ? 1 : 0
      if (aCatMatch !== bCatMatch) return bCatMatch - aCatMatch
      const aVisMatch = a.visibility === currentItem.visibility ? 1 : 0
      const bVisMatch = b.visibility === currentItem.visibility ? 1 : 0
      return bVisMatch - aVisMatch
    })
    .slice(0, 6)

  return (
    <MediaDetailClient
      item={currentItem}
      isAuthenticated={isAuthenticated}
      relatedItems={relatedItems}
    />
  )
}
