import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/storage/documentStorage', () => ({
  DocumentStorage: {
    deleteFromS3Only: vi.fn().mockResolvedValue(true),
  },
}))

import {
  extractYoutubeVideoId,
  buildYoutubeEmbedUrl,
  resolveBucketForVisibility,
  sanitizeMediaItemForViewer,
  extractFileExtension,
  cleanDisplayFileName,
  resolveDownloadFileName,
  OnlineMediaService,
  type OnlineMediaItemRecord,
} from '../onlineMediaService'
import { logAudit } from '@/lib/audit'
import { apiGateway } from '@/lib/apiGateway'
import { DocumentStorage } from '@/lib/storage/documentStorage'
import { S3_CONFIG } from '@/lib/storage/s3Client'

describe('onlineMediaService pure helpers', () => {
  it('extracts YouTube video IDs from watch, short, embed, shorts, live, and raw IDs', () => {
    expect(extractYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractYoutubeVideoId('https://example.com/not-youtube')).toBeNull()
    expect(extractYoutubeVideoId('invalid-youtube-link')).toBeNull()
    expect(extractYoutubeVideoId('')).toBeNull()
  })

  it('builds privacy-friendly YouTube embed URLs', () => {
    expect(buildYoutubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
    )
    expect(buildYoutubeEmbedUrl('invalid-youtube-link')).toBeNull()
  })

  it('resolves MinIO buckets strictly by visibility', () => {
    expect(resolveBucketForVisibility('PUBLIC')).toBe(S3_CONFIG.publicBucket)
    expect(resolveBucketForVisibility('INTERNAL')).toBe(S3_CONFIG.privateBucket)
  })

  it('extracts file extensions, strips S3 timestamp suffixes, and resolves custom download filenames safely', () => {
    expect(extractFileExtension('lecture-1732089123456-ab12cd.MP4')).toBe('.mp4')
    expect(extractFileExtension('no-ext', 'application/pdf', 'DOCUMENT')).toBe('.pdf')

    expect(
      cleanDisplayFileName(
        'คู่มือเบาหวาน-1732089123456-ab12cd.pdf',
        'แนวทางเบาหวาน',
        'online-media/public/2026/11/คู่มือเบาหวาน-1732089123456-ab12cd.pdf',
        'application/pdf',
        'DOCUMENT'
      )
    ).toBe('คู่มือเบาหวาน.pdf')

    // User provides custom filename without extension -> original extension preserved
    expect(
      resolveDownloadFileName({
        customFileName: 'คลิปอบรมความเสี่ยง รพ.เถิน',
        storedFileName: 'raw-video-1732089123456-ab12cd.mp4',
        fallbackTitle: 'อบรมความเสี่ยง',
        s3Key: 'online-media/internal/2026/11/raw-video-1732089123456-ab12cd.mp4',
        mimeType: 'video/mp4',
        mediaType: 'VIDEO',
      })
    ).toBe('คลิปอบรมความเสี่ยง รพ.เถิน.mp4')

    // User provides custom filename with extension and unsafe path characters -> sanitized without duplicate extension
    expect(
      resolveDownloadFileName({
        customFileName: '../คู่มือประชาชน:2569.pdf',
        storedFileName: 'guide.pdf',
        fallbackTitle: 'คู่มือ',
        s3Key: 'online-media/public/guide.pdf',
        mimeType: 'application/pdf',
        mediaType: 'DOCUMENT',
      })
    ).toBe('_/คู่มือประชาชน_2569.pdf'.replace('/', '_'))
  })

  it('sanitizes internal media items away from unauthenticated viewers and hides raw S3 keys', () => {
    const internalItem: OnlineMediaItemRecord = {
      id: 42,
      slug: 'internal-training-1',
      title: 'อบรมบุคลากรภายใน',
      description: 'รายละเอียด',
      categoryId: 2,
      categoryName: 'สื่ออบรม',
      visibility: 'INTERNAL',
      mediaType: 'VIDEO',
      sourceType: 'MINIO',
      s3Bucket: 'private-documents',
      s3Key: 'online-media/internal/2026/11/secret-video.mp4',
      youtubeUrl: null,
      thumbnailS3Key: 'online-media/internal/2026/11/thumb.jpg',
      fileName: 'secret-video.mp4',
      fileSize: 1024000,
      mimeType: 'video/mp4',
      allowDownload: false,
      isPublished: true,
      viewCount: 5,
      createdById: 1,
      createdByName: 'Admin',
      createdAt: '2026-11-19T10:00:00+07:00',
      updatedAt: '2026-11-19T10:00:00+07:00',
      attachments: [
        {
          id: 9,
          mediaId: 42,
          title: 'สไลด์ประกอบ',
          s3Bucket: 'private-documents',
          s3Key: 'online-media/internal/2026/11/slides.pdf',
          fileName: 'slides.pdf',
          fileSize: 50000,
          mimeType: 'application/pdf',
          displayOrder: 0,
          createdAt: '2026-11-19T10:00:00+07:00',
        },
      ],
    }

    expect(sanitizeMediaItemForViewer(internalItem, false)).toBeNull()

    const viewerDto = sanitizeMediaItemForViewer(internalItem, true)
    expect(viewerDto).not.toBeNull()
    expect(viewerDto?.streamUrl).toBe('/api/media/stream/42')
    expect(viewerDto?.downloadUrl).toBeNull()
    expect(viewerDto?.thumbnailUrl).toBe('/api/media/stream/42?kind=thumbnail')
    expect(viewerDto?.attachments[0]?.streamUrl).toBe('/api/media/stream/42?attachmentId=9')
    expect(viewerDto?.attachments[0]?.downloadUrl).toBeNull()
    expect((viewerDto as unknown as Record<string, unknown>).s3Key).toBeUndefined()
    expect((viewerDto as unknown as Record<string, unknown>).s3Bucket).toBeUndefined()
  })
})

describe('OnlineMediaService Gateway Named API operations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('forces PUBLIC-only filter when unauthenticated even if caller requests INTERNAL or ALL', async () => {
    const itemsSpy = vi.spyOn(apiGateway.app, 'getOnlineMediaItems').mockResolvedValue([
      {
        id: 1,
        slug: 'public-video',
        title: 'วิดีโอสุขศึกษา',
        description: 'คำอธิบาย',
        category_id: 1,
        categoryName: 'สุขศึกษา',
        visibility: 'PUBLIC',
        media_type: 'VIDEO',
        source_type: 'YOUTUBE',
        youtube_url: 'https://youtu.be/dQw4w9WgXcQ',
        allow_download: 1,
        is_published: 1,
        view_count: 12,
        created_at: '2026-11-19 10:00:00',
        updated_at: '2026-11-19 10:00:00',
        attachments: [],
      },
    ])

    const items = await OnlineMediaService.listMediaItems({
      visibility: 'INTERNAL',
      isAuthenticated: false,
    })

    expect(items).toHaveLength(1)
    expect(items[0].visibility).toBe('PUBLIC')
    expect(items[0].youtubeEmbedUrl).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1'
    )
    expect(itemsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        visibility: 'PUBLIC',
        includeUnpublished: false,
        isAuthenticated: false,
      })
    )
  })

  it('blocks INTERNAL items when unauthenticated and returns them when authenticated', async () => {
    vi.spyOn(apiGateway.app, 'getOnlineMediaItemBySlugOrId')
      .mockResolvedValueOnce({ item: null, requiresAuth: true })
      .mockResolvedValueOnce({
        item: {
          id: 7,
          slug: 'internal-unlisted-yt',
          title: 'อบรมภายใน YouTube Unlisted',
          description: null,
          category_id: 2,
          categoryName: 'อบรม',
          visibility: 'INTERNAL',
          media_type: 'VIDEO',
          source_type: 'YOUTUBE',
          youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          allow_download: 0,
          is_published: 1,
          view_count: 3,
          created_at: '2026-11-19 10:00:00',
          updated_at: '2026-11-19 10:00:00',
          attachments: [],
        },
        requiresAuth: false,
      })

    const guestResult = await OnlineMediaService.getMediaItemBySlugOrId('internal-unlisted-yt', {
      isAuthenticated: false,
    })
    expect(guestResult).toEqual({ item: null, requiresAuth: true })

    const staffResult = await OnlineMediaService.getMediaItemBySlugOrId('internal-unlisted-yt', {
      isAuthenticated: true,
    })
    expect(staffResult.requiresAuth).toBe(false)
    expect(staffResult.item?.id).toBe(7)
    expect(staffResult.item?.youtubeEmbedUrl).toContain('dQw4w9WgXcQ')
  })

  it('delegates recordMediaView to Gateway Named API', async () => {
    const viewSpy = vi.spyOn(apiGateway.app, 'recordOnlineMediaView').mockResolvedValue({ success: true })

    await OnlineMediaService.recordMediaView(15, {
      memberId: 88,
      memberName: 'นพ.ทดสอบ ระบบ',
      memberDepartment: 'อายุรกรรม',
    })
    expect(viewSpy).toHaveBeenCalledWith(15, {
      memberId: 88,
      memberName: 'นพ.ทดสอบ ระบบ',
      memberDepartment: 'อายุรกรรม',
    })

    await OnlineMediaService.recordMediaView(15, null)
    expect(viewSpy).toHaveBeenCalledWith(15, null)
  })

  it('cleans up primary file, thumbnail, and attachments from MinIO on deleteMediaItem', async () => {
    vi.spyOn(apiGateway.app, 'getOnlineMediaItemForManage').mockResolvedValue({
      id: 55,
      slug: 'to-delete',
      title: 'วิดีโอที่จะลบ',
      category_id: 1,
      visibility: 'INTERNAL',
      media_type: 'VIDEO',
      source_type: 'MINIO',
      s3_bucket: 'private-documents',
      s3_key: 'online-media/internal/2026/11/video.mp4',
      thumbnail_s3_key: 'online-media/internal/2026/11/thumb.jpg',
      allow_download: 1,
      is_published: 1,
      view_count: 0,
      created_at: '2026-11-19 10:00:00',
      updated_at: '2026-11-19 10:00:00',
      attachments: [
        {
          id: 101,
          media_id: 55,
          title: 'เอกสารแนบ',
          s3_bucket: 'private-documents',
          s3_key: 'online-media/internal/2026/11/handout.pdf',
          file_name: 'handout.pdf',
          display_order: 0,
          created_at: '2026-11-19 10:00:00',
        },
      ],
    })
    const delSpy = vi.spyOn(apiGateway.app, 'deleteOnlineMediaItem').mockResolvedValue({ success: true })

    await OnlineMediaService.deleteMediaItem(55, {
      id: 1,
      username: 'admin1',
      email: 'admin@thoen.go.th',
    })

    expect(DocumentStorage.deleteFromS3Only).toHaveBeenCalledTimes(3)
    expect(DocumentStorage.deleteFromS3Only).toHaveBeenCalledWith({
      bucket: 'private-documents',
      s3Key: 'online-media/internal/2026/11/video.mp4',
    })
    expect(DocumentStorage.deleteFromS3Only).toHaveBeenCalledWith({
      bucket: 'private-documents',
      s3Key: 'online-media/internal/2026/11/thumb.jpg',
    })
    expect(DocumentStorage.deleteFromS3Only).toHaveBeenCalledWith({
      bucket: 'private-documents',
      s3Key: 'online-media/internal/2026/11/handout.pdf',
    })
    expect(delSpy).toHaveBeenCalledWith(55)
    expect(logAudit).toHaveBeenCalledWith(
      'DELETE',
      'online_media_items',
      expect.stringContaining('ลบสื่อออนไลน์'),
      expect.objectContaining({ username: 'admin1' })
    )
  })
})

describe('OnlineMediaService Gateway Named API routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('delegates listCategories, listMediaItems, and getMediaItemBySlugOrId to Gateway Named APIs when using default executor', async () => {
    const catSpy = vi.spyOn(apiGateway.app, 'getOnlineMediaCategories').mockResolvedValue([
      {
        id: 1,
        name: 'สื่อสาธารณะ',
        slug: 'public',
        visibility: 'PUBLIC',
        displayOrder: 1,
        isActive: 1,
        itemCount: 1,
        createdAt: '2026-11-20 09:00:00',
        updatedAt: '2026-11-20 09:00:00',
      },
    ])
    const itemsSpy = vi.spyOn(apiGateway.app, 'getOnlineMediaItems').mockResolvedValue([
      {
        id: 2,
        slug: 'sample-video',
        title: 'ตัวอย่างวิดีโอ',
        description: null,
        category_id: 1,
        categoryName: 'สื่อสาธารณะ',
        visibility: 'PUBLIC',
        media_type: 'VIDEO',
        source_type: 'MINIO',
        s3_bucket: 'public-assets',
        s3_key: 'online-media/public/2026/11/sample.mp4',
        file_name: 'sample.mp4',
        file_size: 1024,
        mime_type: 'video/mp4',
        allow_download: 1,
        is_published: 1,
        view_count: 5,
        created_by_id: 303,
        created_by_name: 'นพ.ทดสอบ',
        createdByProfilePath: 'storage/303/profile.png',
        created_at: '2026-11-20 09:00:00',
        updated_at: '2026-11-20 09:00:00',
        attachments: [],
      },
    ])
    const detailSpy = vi.spyOn(apiGateway.app, 'getOnlineMediaItemBySlugOrId').mockResolvedValue({
      item: {
        id: 2,
        slug: 'sample-video',
        title: 'ตัวอย่างวิดีโอ',
        category_id: 1,
        visibility: 'PUBLIC',
        media_type: 'VIDEO',
        source_type: 'MINIO',
        s3_bucket: 'public-assets',
        s3_key: 'online-media/public/2026/11/sample.mp4',
        file_name: 'sample.mp4',
        allow_download: 1,
        is_published: 1,
        view_count: 5,
        created_by_id: 303,
        created_by_name: 'นพ.ทดสอบ',
        createdByProfilePath: 'storage/303/profile.png',
        created_at: '2026-11-20 09:00:00',
        updated_at: '2026-11-20 09:00:00',
        attachments: [],
      },
      requiresAuth: false,
    })

    const cats = await OnlineMediaService.listCategories({ isAuthenticated: false })
    expect(catSpy).toHaveBeenCalledWith({ isAuthenticated: false })
    expect(cats).toHaveLength(1)

    const items = await OnlineMediaService.listMediaItems({ isAuthenticated: true })
    expect(itemsSpy).toHaveBeenCalledWith({ isAuthenticated: true })
    expect(items[0].createdByAvatarUrl).toBe('/api/media/stream/2?kind=avatar')

    const detail = await OnlineMediaService.getMediaItemBySlugOrId('sample-video', {
      isAuthenticated: false,
    })
    expect(detailSpy).toHaveBeenCalledWith('sample-video', { isAuthenticated: false })
    expect(detail.item?.createdByAvatarUrl).toBe('/api/media/stream/2?kind=avatar')
    expect(detail.item?.downloadUrl).toBe('/api/media/stream/2?download=1')
  })
})
