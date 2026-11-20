'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Lock,
  Paperclip,
  ShieldAlert,
  X,
  ZoomIn,
  Share2,
  Check,
  Maximize2,
  Minimize2,
  PlayCircle,
  Image as ImageIcon,
  Edit3,
  RotateCcw,
} from 'lucide-react'
import Breadcrumb from '@/components/ui/Breadcrumb'
import { formatThaiDate, getInitials } from '@/lib/formatters'
import type { OnlineMediaViewerItem } from '@/lib/media/onlineMediaService'
import HospitalVideoPlayer from './HospitalVideoPlayer'
import '../media.css'

export interface MediaDetailClientProps {
  item: OnlineMediaViewerItem
  isAuthenticated: boolean
  relatedItems?: OnlineMediaViewerItem[]
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getYoutubeThumbUrl(youtubeUrl?: string | null): string | null {
  if (!youtubeUrl) return null
  const match = youtubeUrl.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  const id = match?.[1] || (/^[a-zA-Z0-9_-]{11}$/.test(youtubeUrl.trim()) ? youtubeUrl.trim() : null)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

function formatMediaTypeLabel(item: OnlineMediaViewerItem): string {
  if (item.sourceType === 'YOUTUBE') return 'วิดีโอ YouTube'
  if (item.mediaType === 'VIDEO') return 'วิดีโอสตรีมมิง'
  if (item.mediaType === 'INFOGRAPHIC') return 'อินโฟกราฟิก'
  return 'เอกสาร PDF'
}

function splitFileNameAndExt(
  fileName?: string | null,
  mimeType?: string | null,
  mediaType?: OnlineMediaViewerItem['mediaType']
): { baseName: string; ext: string } {
  const raw = (fileName || '').trim()
  const match = raw.match(/^(.*?)(\.[a-zA-Z0-9]{1,10})$/)
  if (match) {
    const cleanBase = match[1].replace(/-\d{12,14}-[a-z0-9]{4,10}$/i, '').trim()
    return {
      baseName: cleanBase || match[1] || 'media',
      ext: match[2].toLowerCase(),
    }
  }
  const mime = (mimeType || '').toLowerCase()
  let ext = ''
  if (mime.includes('pdf')) ext = '.pdf'
  else if (mime.includes('mp4')) ext = '.mp4'
  else if (mime.includes('webm')) ext = '.webm'
  else if (mime.includes('quicktime')) ext = '.mov'
  else if (mime.includes('png')) ext = '.png'
  else if (mime.includes('webp')) ext = '.webp'
  else if (mime.includes('gif')) ext = '.gif'
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg'
  else if (mediaType === 'DOCUMENT') ext = '.pdf'
  else if (mediaType === 'INFOGRAPHIC') ext = '.jpg'
  else if (mediaType === 'VIDEO') ext = '.mp4'

  return {
    baseName: raw.replace(/-\d{12,14}-[a-z0-9]{4,10}$/i, '').trim(),
    ext,
  }
}

function buildSafeDownloadFileName(baseInput: string, fallbackBase: string, ext: string): string {
  const cleaned = baseInput
    .trim()
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/[. ]+$/g, '')
  const withoutDuplicateExt =
    ext && cleaned.toLowerCase().endsWith(ext)
      ? cleaned.slice(0, -ext.length).trim()
      : cleaned
  const finalBase = (withoutDuplicateExt || fallbackBase || 'media').slice(0, 100)
  return `${finalBase}${ext}`
}

export default function MediaDetailClient({
  item,
  relatedItems = [],
}: MediaDetailClientProps) {
  const router = useRouter()
  const [viewCount, setViewCount] = useState(item.viewCount)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [avatarLoadError, setAvatarLoadError] = useState(false)
  const viewRecordedRef = useRef(false)
  const renameInputRef = useRef<HTMLInputElement | null>(null)

  const publisherAvatarSrc = !avatarLoadError ? item.createdByAvatarUrl : null

  const initialFileParts = splitFileNameAndExt(item.fileName, item.mimeType, item.mediaType)
  const defaultBaseName = initialFileParts.baseName || item.title
  const fileExt = initialFileParts.ext

  const [downloadBaseName, setDownloadBaseName] = useState(defaultBaseName)
  const [isRenameOpen, setIsRenameOpen] = useState(false)
  const [editingAttachmentId, setEditingAttachmentId] = useState<number | null>(null)
  const [attachmentBaseNames, setAttachmentBaseNames] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {}
    for (const att of item.attachments) {
      const parts = splitFileNameAndExt(att.fileName, att.mimeType, 'DOCUMENT')
      init[att.id] = parts.baseName || att.title
    }
    return init
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.toggle('media-theater-active', isTheaterMode)
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTheaterMode) {
        setIsTheaterMode(false)
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.body.classList.remove('media-theater-active')
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isTheaterMode])

  useEffect(() => {
    if (isRenameOpen) {
      setTimeout(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      }, 30)
    }
  }, [isRenameOpen])

  useEffect(() => {
    if (viewRecordedRef.current) return
    viewRecordedRef.current = true

    fetch(`/api/media/${encodeURIComponent(item.slug)}`, { method: 'POST' })
      .then((res) => {
        if (res.ok) {
          setViewCount((prev) => prev + 1)
        }
      })
      .catch(() => {
        // Ignore view tracking error so playback is uninterrupted
      })
  }, [item.slug])

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href)
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2200)
      }
    } catch {
      // Clipboard fallback ignored
    }
  }

  const effectiveDownloadFileName = buildSafeDownloadFileName(
    downloadBaseName,
    defaultBaseName,
    fileExt
  )
  const effectiveDownloadUrl =
    item.allowDownload && item.downloadUrl
      ? `${item.downloadUrl}&filename=${encodeURIComponent(effectiveDownloadFileName)}`
      : null

  const hasSidebar = item.attachments.length > 0 || relatedItems.length > 0
  const publisherName = item.createdByName || 'โรงพยาบาลเถิน'
  const publisherInitials = getInitials(publisherName, true)

  const firstNextVideo = relatedItems[0]
    ? {
        title: relatedItems[0].title,
        slug: relatedItems[0].slug,
        categoryName: relatedItems[0].categoryName,
        thumbnailUrl:
          relatedItems[0].thumbnailUrl ||
          (relatedItems[0].mediaType === 'INFOGRAPHIC' ? relatedItems[0].streamUrl : null) ||
          (relatedItems[0].sourceType === 'YOUTUBE'
            ? getYoutubeThumbUrl(relatedItems[0].youtubeUrl)
            : null),
      }
    : null

  const renderPlayerStage = () => (
    <div
      className={`mediaPlayerStage ${isTheaterMode ? 'theaterStage' : ''}`}
      onClick={(e) => {
        if (isTheaterMode) e.stopPropagation()
      }}
    >
      {item.mediaType === 'VIDEO' &&
      item.sourceType === 'YOUTUBE' &&
      item.youtubeEmbedUrl ? (
        <div className="mediaVideoWrapper">
          <iframe
            src={item.youtubeEmbedUrl}
            title={item.title}
            className="mediaYoutubeIframe"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : item.mediaType === 'VIDEO' && item.streamUrl ? (
        <HospitalVideoPlayer
          mediaId={item.id}
          title={item.title}
          streamUrl={item.streamUrl}
          posterUrl={item.thumbnailUrl}
          allowDownload={item.allowDownload}
          isTheaterMode={isTheaterMode}
          onToggleTheaterMode={() => setIsTheaterMode((prev) => !prev)}
          nextItem={firstNextVideo}
          onNavigateNext={(slug) => router.push(`/media/${encodeURIComponent(slug)}`)}
        />
      ) : item.mediaType === 'INFOGRAPHIC' && item.streamUrl ? (
        <div className="mediaImageViewer">
          <img
            src={item.streamUrl}
            alt={item.title}
            onClick={() => setLightboxOpen(true)}
            onContextMenu={!item.allowDownload ? (e) => e.preventDefault() : undefined}
          />
        </div>
      ) : item.mediaType === 'DOCUMENT' && item.streamUrl ? (
        <iframe
          src={`${item.streamUrl}${item.allowDownload ? '' : '#toolbar=0&navpanes=0'}`}
          title={item.title}
          className={`mediaPdfViewerFrame ${isTheaterMode ? 'expanded' : ''}`}
        />
      ) : null}
    </div>
  )

  return (
    <div className={`mediaDetailPage ${isTheaterMode ? 'isTheaterMode' : ''}`}>
      <div className="container mediaDetailContainer">
        {/* Quiet Top Navigation Bar */}
        <div className="mediaDetailTopBar">
          <Breadcrumb
            variant={isTheaterMode ? 'light' : 'default'}
            items={[
              { label: 'ข่าวสาร', href: '/news' },
              { label: 'คลังสื่อออนไลน์', href: '/media' },
              { label: item.title },
            ]}
          />
          <Link href="/media" className="mediaQuietBackLink">
            <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>คลังสื่อทั้งหมด</span>
          </Link>
        </div>

        <div
          className={`mediaDetailLayout ${
            hasSidebar ? 'hasSidebar' : 'fullWidth'
          } ${isTheaterMode ? 'theaterLayout' : ''}`}
        >
          {/* Persistent Player Stage (never unmounts when toggling Theater Mode) */}
          <div
            className={`mediaStageFrame ${isTheaterMode ? 'mediaTheaterBanner' : ''}`}
            onClick={() => {
              if (isTheaterMode) setIsTheaterMode(false)
            }}
          >
            {isTheaterMode && (
              <div
                className="mediaCinemaTopBar"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="mediaCinemaTitle">{item.title}</span>
                <button
                  type="button"
                  className="mediaCinemaExitBtn"
                  onClick={() => setIsTheaterMode(false)}
                  aria-label="ออกจากโหมดโรงภาพยนตร์"
                >
                  <Minimize2 size={15} strokeWidth={1.5} aria-hidden="true" />
                  <span>ออกจากโหมดโรงภาพยนตร์ (Esc)</span>
                </button>
              </div>
            )}
            {renderPlayerStage()}
          </div>

          {/* Main Watch Column */}
          <div className="mediaDetailMainCol">
            <article className="mediaWatchSurface">
              {/* Primary Watch Information Block */}
              <div className="mediaWatchHeader">
                <h1 className="mediaDetailTitle">{item.title}</h1>

                {/* Unified Publisher & Action Row (YouTube Watch Bar) */}
                <div className="mediaWatchActionBar">
                  <div className="mediaPublisherBlock">
                    <div className="mediaPublisherAvatar" aria-hidden="true">
                      {publisherAvatarSrc ? (
                        <img
                          src={publisherAvatarSrc}
                          alt=""
                          className="mediaPublisherAvatarImg"
                          onError={() => setAvatarLoadError(true)}
                        />
                      ) : (
                        publisherInitials
                      )}
                    </div>
                    <div className="mediaPublisherText">
                      <div className="mediaPublisherNameRow">
                        <span className="mediaPublisherName">{publisherName}</span>
                        {item.categoryName && (
                          <span className="mediaMetaTag">{item.categoryName}</span>
                        )}
                      </div>
                      <div className="mediaPublisherSubRow">
                        <span
                          className={`mediaAccessTag ${
                            item.visibility === 'INTERNAL' ? 'isInternal' : 'isPublic'
                          }`}
                        >
                          {item.visibility === 'INTERNAL' ? (
                            <>
                              <Lock size={12} strokeWidth={1.5} aria-hidden="true" />
                              <span>สื่อภายในบุคลากร</span>
                            </>
                          ) : (
                            <>
                              <Globe size={12} strokeWidth={1.5} aria-hidden="true" />
                              <span>สื่อสาธารณะ</span>
                            </>
                          )}
                        </span>
                        <span className="mediaDotSep" aria-hidden="true">·</span>
                        <span>เผยแพร่ {formatThaiDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Toolbar: Quiet controls + at most ONE primary filled CTA */}
                  <div className="mediaWatchToolbar">
                    <span className="mediaViewStat" title="จำนวนการเข้าชมสะสม">
                      <Eye size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span>{viewCount.toLocaleString()} ครั้ง</span>
                    </span>

                    <button type="button" onClick={handleCopyLink} className="mediaActionBtn">
                      {copiedLink ? (
                        <>
                          <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                          <span>คัดลอกลิงก์แล้ว</span>
                        </>
                      ) : (
                        <>
                          <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />
                          <span>แชร์ลิงก์</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsTheaterMode((prev) => !prev)}
                      className={`mediaActionBtn mediaTheaterBtn ${isTheaterMode ? 'isActive' : ''}`}
                      aria-pressed={isTheaterMode}
                    >
                      {isTheaterMode ? (
                        <>
                          <Minimize2 size={16} strokeWidth={1.5} aria-hidden="true" />
                          <span>มุมมองปกติ</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 size={16} strokeWidth={1.5} aria-hidden="true" />
                          <span>โหมดโรงภาพยนตร์</span>
                        </>
                      )}
                    </button>

                    {item.mediaType === 'INFOGRAPHIC' && item.streamUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="mediaActionBtn"
                      >
                        <ZoomIn size={16} strokeWidth={1.5} aria-hidden="true" />
                        <span>ขยายเต็มจอ</span>
                      </button>
                    )}

                    {item.mediaType === 'DOCUMENT' && item.streamUrl && (
                      <a
                        href={item.streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mediaActionBtn"
                      >
                        <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
                        <span>เปิดแท็บใหม่</span>
                      </a>
                    )}

                    {item.allowDownload && effectiveDownloadUrl ? (
                      <div className="mediaDownloadActionGroup">
                        <button
                          type="button"
                          onClick={() => setIsRenameOpen((prev) => !prev)}
                          className={`mediaActionBtn ${isRenameOpen ? 'isActive' : ''}`}
                          title="เปลี่ยนชื่อไฟล์ก่อนดาวน์โหลด"
                          aria-expanded={isRenameOpen}
                        >
                          <Edit3 size={15} strokeWidth={1.5} aria-hidden="true" />
                          <span>เปลี่ยนชื่อไฟล์</span>
                        </button>
                        <a
                          href={effectiveDownloadUrl}
                          download={effectiveDownloadFileName}
                          className="mediaActionBtn mediaActionBtnPrimary"
                          title={`ดาวน์โหลดเป็นชื่อ ${effectiveDownloadFileName}`}
                        >
                          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
                          <span>ดาวน์โหลดไฟล์</span>
                        </a>
                      </div>
                    ) : (
                      item.sourceType === 'MINIO' && (
                        <span className="mediaNoDownloadBadge">
                          <ShieldAlert size={14} strokeWidth={1.5} aria-hidden="true" />
                          <span>รับชมออนไลน์เท่านั้น</span>
                        </span>
                      )
                    )}
                  </div>
                </div>

                {/* Custom Download Filename Bar */}
                {item.allowDownload && effectiveDownloadUrl && isRenameOpen && (
                  <div className="mediaRenameDownloadBar" role="region" aria-label="ตั้งชื่อไฟล์สำหรับดาวน์โหลด">
                    <div className="mediaRenameTopRow">
                      <label htmlFor="media-custom-filename" className="mediaRenameLabel">
                        <Edit3 size={14} strokeWidth={1.5} aria-hidden="true" />
                        <span>กำหนดชื่อไฟล์ดาวน์โหลด:</span>
                      </label>
                      <div className="mediaRenamePresetBtns">
                        <button
                          type="button"
                          className="mediaRenamePresetBtn"
                          onClick={() => setDownloadBaseName(item.title)}
                        >
                          ใช้ชื่อหัวข้อสื่อ
                        </button>
                        {defaultBaseName !== item.title && (
                          <button
                            type="button"
                            className="mediaRenamePresetBtn"
                            onClick={() => setDownloadBaseName(defaultBaseName)}
                          >
                            <RotateCcw size={12} aria-hidden="true" />
                            <span>ชื่อไฟล์ต้นฉบับ</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mediaRenameControlRow">
                      <div className="mediaRenameInputGroup">
                        <input
                          ref={renameInputRef}
                          id="media-custom-filename"
                          type="text"
                          value={downloadBaseName}
                          onChange={(e) => setDownloadBaseName(e.target.value)}
                          placeholder={defaultBaseName}
                          className="mediaRenameInput"
                          maxLength={100}
                        />
                        {fileExt && <span className="mediaRenameExtBadge">{fileExt}</span>}
                      </div>

                      <a
                        href={effectiveDownloadUrl}
                        download={effectiveDownloadFileName}
                        className="mediaActionBtn mediaActionBtnPrimary"
                      >
                        <Download size={15} strokeWidth={1.5} aria-hidden="true" />
                        <span>ดาวน์โหลดด้วยชื่อนี้</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Sunken Description & Technical Specification Well */}
                <div className="mediaDescriptionWell">
                  <div className="mediaSpecStrip">
                    <span>ประเภท: {formatMediaTypeLabel(item)}</span>
                    {item.fileSize ? (
                      <>
                        <span className="mediaDotSep" aria-hidden="true">·</span>
                        <span>ขนาดไฟล์: {formatFileSize(item.fileSize)}</span>
                      </>
                    ) : null}
                    {item.sourceType === 'MINIO' && effectiveDownloadFileName ? (
                      <>
                        <span className="mediaDotSep" aria-hidden="true">·</span>
                        <span className="mediaSpecFileName">
                          ชื่อไฟล์: {effectiveDownloadFileName}
                        </span>
                        {item.allowDownload && effectiveDownloadUrl && (
                          <button
                            type="button"
                            className="mediaSpecRenameInlineBtn"
                            onClick={() => setIsRenameOpen((prev) => !prev)}
                          >
                            <Edit3 size={12} aria-hidden="true" />
                            <span>{isRenameOpen ? 'ซ่อนช่องเปลี่ยนชื่อ' : 'แก้ไขชื่อไฟล์โหลด'}</span>
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>

                  {item.description ? (
                    <div className="mediaDetailDesc">{item.description}</div>
                  ) : (
                    <p className="mediaDetailEmptyDesc">ไม่มีรายละเอียดคำอธิบายเพิ่มเติม</p>
                  )}
                </div>
              </div>
            </article>
          </div>

          {/* Right Watch Queue & Supplementary Attachments Sidebar */}
          {hasSidebar && (
            <aside className="mediaDetailSidebar">
              {item.attachments.length > 0 && (
                <section className="mediaSidebarCard" aria-label="เอกสารและสื่อประกอบเพิ่มเติม">
                  <div className="mediaSidebarHeaderRow">
                    <h2 className="mediaSidebarHeading">
                      <Paperclip size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span>เอกสารประกอบ</span>
                    </h2>
                    <span className="mediaSidebarCount">{item.attachments.length} ไฟล์</span>
                  </div>
                  <div className="mediaAttachmentList">
                    {item.attachments.map((att) => {
                      const attParts = splitFileNameAndExt(att.fileName, att.mimeType, 'DOCUMENT')
                      const attFallbackBase = attParts.baseName || att.title
                      const attCurrentBase =
                        attachmentBaseNames[att.id] !== undefined
                          ? attachmentBaseNames[att.id]
                          : attFallbackBase
                      const attFinalFileName = buildSafeDownloadFileName(
                        attCurrentBase,
                        attFallbackBase,
                        attParts.ext
                      )
                      const attDownloadUrl =
                        item.allowDownload && att.downloadUrl
                          ? `${att.downloadUrl}&filename=${encodeURIComponent(attFinalFileName)}`
                          : null
                      const isEditingThisAtt = editingAttachmentId === att.id

                      return (
                        <div key={att.id} className="mediaAttachmentRow">
                          <div className="mediaAttachmentInfo">
                            <FileText
                              size={18}
                              strokeWidth={1.5}
                              className="mediaAttachmentIcon"
                              aria-hidden="true"
                            />
                            <div className="mediaAttachmentTextCol">
                              <div className="mediaAttachmentName">{att.title}</div>
                              <div className="mediaAttachmentSub">
                                {attFinalFileName}
                                {att.fileSize ? ` · ${formatFileSize(att.fileSize)}` : ''}
                              </div>
                            </div>
                          </div>

                          {item.allowDownload && attDownloadUrl && isEditingThisAtt && (
                            <div className="mediaAttachmentRenameRow">
                              <div className="mediaRenameInputGroup">
                                <input
                                  type="text"
                                  value={attCurrentBase}
                                  onChange={(e) =>
                                    setAttachmentBaseNames((prev) => ({
                                      ...prev,
                                      [att.id]: e.target.value,
                                    }))
                                  }
                                  className="mediaRenameInput mediaRenameInputCompact"
                                  placeholder={attFallbackBase}
                                  aria-label={`ตั้งชื่อไฟล์ดาวน์โหลดสำหรับ ${att.title}`}
                                  maxLength={100}
                                />
                                {attParts.ext && (
                                  <span className="mediaRenameExtBadge">{attParts.ext}</span>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="mediaAttachmentActions">
                            <a
                              href={att.streamUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mediaActionBtn mediaBtnCompact"
                            >
                              <ExternalLink size={14} strokeWidth={1.5} aria-hidden="true" />
                              <span>เปิดดู</span>
                            </a>
                            {item.allowDownload && attDownloadUrl && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingAttachmentId((prev) =>
                                      prev === att.id ? null : att.id
                                    )
                                  }
                                  className={`mediaActionBtn mediaBtnCompact ${
                                    isEditingThisAtt ? 'isActive' : ''
                                  }`}
                                  title="เปลี่ยนชื่อไฟล์ก่อนดาวน์โหลด"
                                >
                                  <Edit3 size={13} strokeWidth={1.5} aria-hidden="true" />
                                  <span>เปลี่ยนชื่อ</span>
                                </button>
                                <a
                                  href={attDownloadUrl}
                                  download={attFinalFileName}
                                  className="mediaActionBtn mediaBtnCompact mediaActionBtnPrimary"
                                >
                                  <Download size={14} strokeWidth={1.5} aria-hidden="true" />
                                  <span>ดาวน์โหลด</span>
                                </a>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {relatedItems.length > 0 && (
                <section className="mediaSidebarCard" aria-label="รายการสื่อถัดไป">
                  <div className="mediaSidebarHeaderRow">
                    <h2 className="mediaSidebarHeading">
                      <PlayCircle size={16} strokeWidth={1.5} aria-hidden="true" />
                      <span>สื่อถัดไปในคลัง</span>
                    </h2>
                    <span className="mediaSidebarCount">{relatedItems.length} รายการ</span>
                  </div>
                  <div className="mediaRelatedList">
                    {relatedItems.map((rel) => {
                      const relThumb =
                        rel.thumbnailUrl ||
                        (rel.mediaType === 'INFOGRAPHIC' ? rel.streamUrl : null) ||
                        (rel.sourceType === 'YOUTUBE' ? getYoutubeThumbUrl(rel.youtubeUrl) : null)

                      return (
                        <Link
                          key={rel.id}
                          href={`/media/${encodeURIComponent(rel.slug)}`}
                          className="mediaRelatedItem"
                        >
                          <div className="mediaRelatedThumb">
                            {relThumb ? (
                              <img src={relThumb} alt="" loading="lazy" />
                            ) : rel.mediaType === 'VIDEO' ? (
                              <PlayCircle size={20} strokeWidth={1.5} />
                            ) : rel.mediaType === 'INFOGRAPHIC' ? (
                              <ImageIcon size={20} strokeWidth={1.5} />
                            ) : (
                              <FileText size={20} strokeWidth={1.5} />
                            )}
                            <span className="mediaRelatedTypeChip">
                              {rel.mediaType === 'VIDEO'
                                ? 'วิดีโอ'
                                : rel.mediaType === 'INFOGRAPHIC'
                                ? 'ภาพ'
                                : 'PDF'}
                            </span>
                          </div>
                          <div className="mediaRelatedBody">
                            <div className="mediaRelatedTitle">{rel.title}</div>
                            <div className="mediaRelatedCategory">
                              {rel.categoryName || 'สื่อออนไลน์'}
                            </div>
                            <div className="mediaRelatedMeta">
                              <span>เข้าชม {rel.viewCount.toLocaleString()} ครั้ง</span>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )}
            </aside>
          )}
        </div>
      </div>

      {lightboxOpen && item.streamUrl && (
        <div
          className="mediaLightboxOverlay"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="ดูภาพขนาดเต็ม"
        >
          <button
            type="button"
            className="mediaLightboxClose"
            onClick={() => setLightboxOpen(false)}
            aria-label="ปิดภาพขนาดเต็ม"
          >
            <X size={20} />
          </button>
          <img
            src={item.streamUrl}
            alt={item.title}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={!item.allowDownload ? (e) => e.preventDefault() : undefined}
          />
        </div>
      )}
    </div>
  )
}
