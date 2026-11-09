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
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import path from 'path'

// Configuration with sensible defaults for Thoen Hospital Storage CT (192.168.1.24)
export const S3_CONFIG = {
  endpoint: process.env.S3_ENDPOINT || 'http://192.168.1.24:9000',
  region: process.env.S3_REGION || 'us-east-1',
  accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.S3_SECRET_KEY || 'thlp@thoen',
  publicBucket: process.env.S3_BUCKET_PUBLIC || 'public-assets',
  privateBucket: process.env.S3_BUCKET_PRIVATE || 'private-documents',
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
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      credentials: {
        accessKeyId: S3_CONFIG.accessKeyId,
        secretAccessKey: S3_CONFIG.secretAccessKey,
      },
      forcePathStyle: S3_CONFIG.forcePathStyle,
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
  } catch (err) {
    console.warn(`[S3] Failed to delete ${bucket}/${normalizedKey}:`, err)
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
  } catch (err: any) {
    return { healthy: false, error: err?.message || String(err), endpoint: S3_CONFIG.endpoint }
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
      } catch (createErr: any) {
        if (createErr?.name !== 'BucketAlreadyOwnedByYou' && createErr?.name !== 'BucketAlreadyExists') {
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
      } catch (policyErr) {
        console.warn(`[S3] Warning: Failed to set public policy on ${b.name}:`, policyErr)
      }
    }
  }

  return {
    publicBucket: S3_CONFIG.publicBucket,
    privateBucket: S3_CONFIG.privateBucket,
    created,
  }
}
