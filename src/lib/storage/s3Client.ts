import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
  const cleanKey = params.key.replace(/^\/+/, '')

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: cleanKey,
    Body: params.body,
    ContentType: params.contentType || 'application/octet-stream',
    CacheControl: params.cacheControl || (bucket === S3_CONFIG.publicBucket ? 'public, max-age=31536000, immutable' : undefined),
  })

  const res = await client.send(command)
  return { bucket, key: cleanKey, eTag: res.ETag }
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
  const cleanKey = params.key.replace(/^\/+/, '')

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: cleanKey,
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
  const cleanKey = params.key.replace(/^\/+/, '')

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
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
  const cleanKey = params.key.replace(/^\/+/, '')

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: cleanKey,
    })
    await client.send(command)
    return true
  } catch (err) {
    console.warn(`[S3] Failed to delete ${bucket}/${cleanKey}:`, err)
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
  const cleanKey = params.key.replace(/^\/+/, '')

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: cleanKey,
  })

  return await getSignedUrl(client, command, {
    expiresIn: params.expiresInSeconds || 3600, // Default 1 hour
  })
}
