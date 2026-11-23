import type {
  MediaSourceType,
  MediaType,
  MediaVisibility,
} from '@/lib/media/onlineMediaService'

export interface AttachmentFormItem {
  id?: number
  title: string
  s3Bucket: string
  s3Key: string
  fileName: string
  fileSize?: number | null
  mimeType?: string | null
  displayOrder: number
}

export interface MediaFormState {
  id?: number
  title: string
  description: string
  categoryId: number
  visibility: MediaVisibility
  mediaType: MediaType
  sourceType: MediaSourceType
  s3Bucket: string
  s3Key: string
  youtubeUrl: string
  thumbnailS3Key: string
  fileName: string
  fileSize: number | null
  mimeType: string
  allowDownload: boolean
  isPublished: boolean
  attachments: AttachmentFormItem[]
}

export type UploadPhase =
  | 'initializing'
  | 'uploading'
  | 'completing'
  | 'completed'
  | 'error'
  | 'cancelled'

export interface UploadTelemetryState {
  active: boolean
  target: 'primary' | 'thumbnail' | 'attachment'
  fileName: string
  totalBytes: number
  uploadedBytes: number
  percent: number
  currentPart: number
  totalParts: number
  speedBytesPerSec: number
  etaSeconds: number | null
  elapsedSeconds: number
  phase: UploadPhase
  message: string
}

export const MULTIPART_THRESHOLD_BYTES = 20 * 1024 * 1024 // 20 MB
export const CHUNK_SIZE_UNDER_1GB = 8 * 1024 * 1024 // 8 MB
export const CHUNK_SIZE_OVER_1GB = 16 * 1024 * 1024 // 16 MB for 1GB-10GB files
export const MAX_MEDIA_FILE_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function formatDurationThai(totalSeconds: number | null): string {
  if (totalSeconds === null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return '-'
  const secs = Math.round(totalSeconds)
  if (secs < 60) return `${secs} วินาที`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  if (mins < 60) return `${mins} นาที ${remSecs} วินาที`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hrs} ชม. ${remMins} นาที`
}

export function extractYoutubeEmbedPreview(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  if (!trimmed) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return `https://www.youtube.com/embed/${trimmed}?rel=0&modestbranding=1`
  }
  const match = trimmed.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match?.[1] ? `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1` : null
}

export function sendXhrWithProgress(
  url: string,
  body: Document | XMLHttpRequestBodyInit,
  headers: Record<string, string>,
  onProgress: (loadedBytes: number) => void,
  onRegisterXhr: (xhr: XMLHttpRequest) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    onRegisterXhr(xhr)
    xhr.open('POST', url, true)
    for (const [k, v] of Object.entries(headers)) {
      xhr.setRequestHeader(k, v)
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        onProgress(evt.loaded)
      }
    }

    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || '{}')
        if (xhr.status >= 200 && xhr.status < 300 && parsed.success) {
          resolve(parsed)
        } else {
          reject(new Error(parsed.error || `Upload failed with status ${xhr.status}`))
        }
      } catch {
        reject(new Error(`Invalid server response (${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่ายระหว่างอัปโหลด'))
    xhr.onabort = () => reject(new DOMException('Upload aborted by user', 'AbortError'))
    xhr.send(body)
  })
}

export function uploadFormDataWithProgress(
  url: string,
  formData: FormData,
  onProgress: (loadedBytes: number) => void,
  onRegisterXhr: (xhr: XMLHttpRequest) => void
): Promise<any> {
  return sendXhrWithProgress(url, formData, {}, onProgress, onRegisterXhr)
}

export function uploadBinaryChunkWithProgress(
  url: string,
  chunk: Blob,
  onProgress: (loadedBytes: number) => void,
  onRegisterXhr: (xhr: XMLHttpRequest) => void
): Promise<any> {
  return sendXhrWithProgress(
    url,
    chunk,
    { 'Content-Type': 'application/octet-stream' },
    onProgress,
    onRegisterXhr
  )
}
