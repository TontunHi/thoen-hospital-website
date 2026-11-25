import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  ListBucketsCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import path from 'path'
import { logger } from '@/lib/logger'

// Fail-closed S3/MinIO configuration read from environment variables
export const S3_CONFIG = {
  get endpoint(): string {
    return process.env.S3_ENDPOINT || ''
  },
  get region(): string {
    return process.env.S3_REGION || 'us-east-1'
  },
  get accessKeyId(): string {
    return process.env.S3_ACCESS_KEY || ''
  },
  get secretAccessKey(): string {
    return process.env.S3_SECRET_KEY || ''
  },
  get publicBucket(): string {
    return process.env.S3_BUCKET_PUBLIC || 'public-assets'
  },
  get privateBucket(): string {
    return process.env.S3_BUCKET_PRIVATE || 'private-documents'
  },
  forcePathStyle: true, // Crucial for MinIO/Silo S3 compatibility
}

let s3ClientInstance: S3Client | null = null

/**
 * Safely normalizes S3 keys so that individual path segments between '/' never exceed
 * the Linux filesystem POSIX limit (NAME_MAX = 255 bytes).
 * For segments > 220 bytes, it deterministically shortens the name while preserving the extension
 * and appending a SHA-256 hash slice so the mapping is 100% reproducible for both upload and retrieval.
 */
export function normalizeS3Key(key: string): string {
  const cleanKey = key.replace(/^\/+/, '')
  return cleanKey.split('/').map(segment => {
    const byteLen = Buffer.byteLength(segment, 'utf8')
    if (byteLen <= 220) return segment

    let ext = path.extname(segment)
    if (ext.length > 10 || ext.includes(' ') || ext.includes('\t')) {
      ext = ''
    }
    const base = ext ? segment.slice(0, -ext.length) : segment
    const hash = crypto.createHash('sha256').update(segment).digest('hex').slice(0, 12)

    let safeBase = ''
    for (const char of base) {
      if (Buffer.byteLength(safeBase + char, 'utf8') > 170) break
      safeBase += char
    }

    return `${safeBase}_${hash}${ext}`
  }).join('/')
}

/**
 * Get or initialize singleton S3 client.
 */
export function getS3Client(): S3Client {
  const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } = S3_CONFIG
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY environment variables are required')
  }
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle,
    })
  }
  return s3ClientInstance
}

/**
 * Check if S3 / MinIO storage is enabled.
 */
export function isS3Configured(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return Boolean(process.env.ENABLE_TEST_S3)
  }
  return Boolean(S3_CONFIG.endpoint && S3_CONFIG.accessKeyId && S3_CONFIG.secretAccessKey)
}

/**
 * Put / Upload object to S3 / MinIO.
 */
export async function uploadToS3(params: {
  bucket?: string
  key: string
  body: Buffer | Uint8Array
  contentType?: string
  cacheControl?: string
}): Promise<{ bucket: string; key: string; eTag?: string }> {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: normalizedKey,
    Body: params.body,
    ContentType: params.contentType || 'application/octet-stream',
    CacheControl: params.cacheControl || (bucket === S3_CONFIG.publicBucket ? 'public, max-age=31536000, immutable' : undefined),
  })

  const res = await client.send(command)
  return { bucket, key: normalizedKey, eTag: res.ETag }
}

/**
 * Initialize a multipart upload in S3 / MinIO for large files (up to 10GB).
 */
export async function createMultipartUploadS3(params: {
  bucket?: string
  key: string
  contentType?: string
}): Promise<{ bucket: string; key: string; uploadId: string }> {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)

  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: normalizedKey,
    ContentType: params.contentType || 'application/octet-stream',
    CacheControl: bucket === S3_CONFIG.publicBucket ? 'public, max-age=31536000, immutable' : undefined,
  })

  const res = await client.send(command)
  if (!res || !res.UploadId) {
    throw new Error('Failed to initialize multipart upload on S3/MinIO')
  }

  return { bucket, key: normalizedKey, uploadId: res.UploadId }
}

/**
 * Upload a single part in an S3 / MinIO multipart upload session.
 */
export async function uploadPartS3(params: {
  bucket?: string
  key: string
  uploadId: string
  partNumber: number
  body: Buffer | Uint8Array
}): Promise<{ eTag: string; partNumber: number }> {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)

  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: normalizedKey,
    UploadId: params.uploadId,
    PartNumber: params.partNumber,
    Body: params.body,
  })

  const res = await client.send(command)
  if (!res.ETag) {
    throw new Error(`Missing ETag for part ${params.partNumber}`)
  }

  return { eTag: res.ETag, partNumber: params.partNumber }
}

/**
 * Complete an S3 / MinIO multipart upload by assembling all uploaded parts.
 */
export async function completeMultipartUploadS3(params: {
  bucket?: string
  key: string
  uploadId: string
  parts: Array<{ ETag: string; PartNumber: number }>
}): Promise<{ bucket: string; key: string; eTag?: string }> {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)
  const sortedParts = [...params.parts].sort((a, b) => a.PartNumber - b.PartNumber)

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: normalizedKey,
    UploadId: params.uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  })

  const res = await client.send(command)
  return { bucket, key: normalizedKey, eTag: res.ETag }
}

/**
 * Abort an in-progress S3 / MinIO multipart upload and clean up orphan parts.
 */
export async function abortMultipartUploadS3(params: {
  bucket?: string
  key: string
  uploadId: string
}): Promise<void> {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)

  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: normalizedKey,
    UploadId: params.uploadId,
  })

  await client.send(command)
}

/**
 * Get object stream and metadata from S3 / MinIO.
 */
export async function getObjectFromS3(params: {
  bucket?: string
  key: string
  range?: string
}) {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: normalizedKey,
    Range: params.range,
  })

  return await client.send(command)
}

/**
 * Check if object exists in S3 / MinIO.
 */
export async function headObjectS3(params: {
  bucket?: string
  key: string
}) {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
    })
    return await client.send(command)
  } catch {
    return null
  }
}

/**
 * Delete object from S3 / MinIO.
 */
export async function deleteFromS3(params: {
  bucket?: string
  key: string
}): Promise<boolean> {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.publicBucket
  const normalizedKey = normalizeS3Key(params.key)

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: normalizedKey,
    })
    await client.send(command)
    return true
  } catch (err: unknown) {
    logger.warn({ bucket, normalizedKey, err }, '[S3] Failed to delete object')
    return false
  }
}

/**
 * Generate Presigned Download URL for private files (valid for specified duration).
 */
export async function getPresignedDownloadUrl(params: {
  bucket?: string
  key: string
  expiresInSeconds?: number
}): Promise<string> {
  const client = getS3Client()
  const bucket = params.bucket || S3_CONFIG.privateBucket
  const normalizedKey = normalizeS3Key(params.key)

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: normalizedKey,
  })

  return await getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds || 3600, // Default 1 hour
  })
}

/**
 * Checks connectivity and health of MinIO server.
 * Enables zero-SSH health checking directly via S3 API.
 */
export async function checkMinioHealth(): Promise<{ healthy: boolean; error?: string; endpoint: string }> {
  try {
    const client = getS3Client()
    await client.send(new ListBucketsCommand({}))
    return { healthy: true, endpoint: S3_CONFIG.endpoint }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { healthy: false, error: message, endpoint: S3_CONFIG.endpoint }
  }
}

/**
 * Ensures required storage buckets exist on MinIO (192.168.1.24).
 * If missing, automatically creates them and configures public read policy for public-assets.
 * Replaces the need to SSH into 192.168.1.24 to run `mc mb`.
 */
export async function ensureStorageBucketsExist(): Promise<{
  publicBucket: string
  privateBucket: string
  created: string[]
}> {
  const client = getS3Client()
  const created: string[] = []

  const buckets = [
    { name: S3_CONFIG.publicBucket, isPublic: true },
    { name: S3_CONFIG.privateBucket, isPublic: false },
  ]

  for (const b of buckets) {
    let exists = false
    try {
      await client.send(new HeadBucketCommand({ Bucket: b.name }))
      exists = true
    } catch {
      exists = false
    }

    if (!exists) {
      try {
        await client.send(new CreateBucketCommand({ Bucket: b.name }))
        created.push(b.name)
      } catch (createErr: unknown) {
        const errName = createErr instanceof Error ? createErr.name : ''
        if (errName !== 'BucketAlreadyOwnedByYou' && errName !== 'BucketAlreadyExists') {
          throw createErr
        }
      }
    }

    if (b.isPublic) {
      const publicPolicy = JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${b.name}/*`],
          },
        ],
      })
      try {
        await client.send(new PutBucketPolicyCommand({ Bucket: b.name, Policy: publicPolicy }))
      } catch (policyErr: unknown) {
        logger.warn({ bucket: b.name, policyErr }, '[S3] Failed to set public bucket policy')
      }
    }
  }

  return {
    publicBucket: S3_CONFIG.publicBucket,
    privateBucket: S3_CONFIG.privateBucket,
    created,
  }
}
