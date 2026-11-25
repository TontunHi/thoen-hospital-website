import { NextRequest } from 'next/server'
import { verifyMemberSession, requireMemberApi } from '@/lib/memberAuth'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import {
  OnlineMediaService,
  resolveBucketForVisibility,
  resolveDownloadFileName,
} from '@/lib/media/onlineMediaService'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const mediaId = parseInt(id, 10)
    if (isNaN(mediaId) || mediaId <= 0) {
      return new Response('Invalid media ID', { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const kind = searchParams.get('kind')
    const attachmentIdRaw = searchParams.get('attachmentId')
    const downloadRequested = searchParams.get('download') === '1'
    const customFileNameParam = searchParams.get('filename')
    const attachmentId = attachmentIdRaw ? parseInt(attachmentIdRaw, 10) : null

    if (attachmentIdRaw && (attachmentId === null || isNaN(attachmentId) || attachmentId <= 0)) {
      return new Response('Invalid attachment ID', { status: 400 })
    }

    const target = await OnlineMediaService.getRawMediaStreamTarget(mediaId, { attachmentId })
    if (!target) {
      return new Response('Not Found', { status: 404 })
    }

    const { item, attachment } = target

    if (!item.isPublished) {
      const { error } = await requireMemberApi({ requiredPermission: 'manage_online_media' })
      if (error) return new Response('Unauthorized', { status: 401 })
    } else if (item.visibility === 'INTERNAL') {
      const session = await verifyMemberSession().catch(() => null)
      if (!session) {
        return new Response('Unauthorized', { status: 401 })
      }
    }

    if (kind === 'avatar') {
      if (!item.createdByProfilePath) {
        return new Response('Not Found', { status: 404 })
      }
      const ext = item.createdByProfilePath.split('.').pop()?.toLowerCase() || 'png'
      let contentType = 'image/png'
      if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
      else if (ext === 'webp') contentType = 'image/webp'
      else if (ext === 'gif') contentType = 'image/gif'

      try {
        const fileBuffer = await DocumentStorage.readBuffer(item.createdByProfilePath)
        return new Response(new Uint8Array(fileBuffer), {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
          },
        })
      } catch {
        return new Response('Not Found', { status: 404 })
      }
    }

    let bucket = item.s3Bucket || resolveBucketForVisibility(item.visibility)
    let s3Key = item.s3Key
    let fileName = resolveDownloadFileName({
      customFileName: customFileNameParam,
      storedFileName: item.fileName,
      fallbackTitle: item.title || `media-${item.id}`,
      s3Key: item.s3Key,
      mimeType: item.mimeType,
      mediaType: item.mediaType,
    })

    if (attachment) {
      bucket = attachment.s3Bucket
      s3Key = attachment.s3Key
      fileName = resolveDownloadFileName({
        customFileName: customFileNameParam,
        storedFileName: attachment.fileName,
        fallbackTitle: attachment.title,
        s3Key: attachment.s3Key,
        mimeType: attachment.mimeType,
        mediaType: 'DOCUMENT',
      })
    } else if (kind === 'thumbnail') {
      s3Key = item.thumbnailS3Key
      fileName = `thumbnail-${item.id}.jpg`
    }

    if (!s3Key) {
      return new Response('Not Found', { status: 404 })
    }

    const allowDownload = Boolean(downloadRequested && item.allowDownload && kind !== 'thumbnail')

    return await DocumentStorage.serveS3Object({
      bucket,
      s3Key,
      req: request,
      fileName,
      download: allowDownload,
      isPrivate: item.visibility === 'INTERNAL' || !item.isPublished,
    })
  } catch (error) {
    logger.error({ error }, 'Stream online media error')
    return new Response('Internal server error', { status: 500 })
  }
}
