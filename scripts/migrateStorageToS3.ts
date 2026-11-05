/**
 * Migration Script: Migrate local files in public/uploads and storage to MinIO S3
 * Usage: npx tsx scripts/migrateStorageToS3.ts
 */
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { uploadToS3, S3_CONFIG, headObjectS3 } from '../src/lib/storage/s3Client'

interface FileEntry {
  localPath: string
  bucket: string
  s3Key: string
  size: number
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.pdf':
      return 'application/pdf'
    case '.mp4':
      return 'video/mp4'
    case '.webm':
      return 'video/webm'
    case '.doc':
      return 'application/msword'
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case '.xls':
      return 'application/vnd.ms-excel'
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    default:
      return 'application/octet-stream'
  }
}

async function collectFiles(dir: string, baseDir: string, bucket: string, keyPrefix: string): Promise<FileEntry[]> {
  const results: FileEntry[] = []
  if (!fsSync.existsSync(dir)) return results

  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const subResults = await collectFiles(fullPath, baseDir, bucket, keyPrefix)
      results.push(...subResults)
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/')
      const s3Key = keyPrefix ? `${keyPrefix}/${relPath}` : relPath
      const stat = await fs.stat(fullPath)
      results.push({
        localPath: fullPath,
        bucket,
        s3Key,
        size: stat.size,
      })
    }
  }
  return results
}

async function runMigration() {
  console.log('🚀 Starting MinIO S3 Object Storage Migration...')
  console.log(`Target S3 Endpoint: ${S3_CONFIG.endpoint}`)
  console.log(`Public Bucket: ${S3_CONFIG.publicBucket}`)
  console.log(`Private Bucket: ${S3_CONFIG.privateBucket}\n`)

  const projectRoot = process.cwd()
  const uploadsDir = path.join(projectRoot, 'public', 'uploads')
  const storageDir = path.join(projectRoot, 'storage')

  const publicFiles = await collectFiles(uploadsDir, uploadsDir, S3_CONFIG.publicBucket, 'uploads')
  const privateFiles = await collectFiles(storageDir, storageDir, S3_CONFIG.privateBucket, 'storage')

  const allFiles = [...publicFiles, ...privateFiles]
  console.log(`Found ${allFiles.length} total files to process (${publicFiles.length} public, ${privateFiles.length} private).\n`)

  let uploadedCount = 0
  let skippedCount = 0
  let failedCount = 0

  for (let i = 0; i < allFiles.length; i++) {
    const file = allFiles[i]
    const progress = `[${i + 1}/${allFiles.length}]`

    // Check if any path segment exceeds POSIX/MinIO 255-byte limit
    const segments = file.s3Key.split('/')
    const oversizedSegment = segments.find(seg => Buffer.byteLength(seg, 'utf8') > 255)
    if (oversizedSegment) {
      console.warn(`${progress} ⚠️ Skipped (segment exceeds 255-byte limit, kept on local disk): ${file.s3Key.slice(0, 80)}...`)
      skippedCount++
      continue
    }

    try {
      // Check if file already exists in MinIO
      const existing = await headObjectS3({ bucket: file.bucket, key: file.s3Key })
      if (existing && existing.ContentLength === file.size) {
        console.log(`${progress} ⏭️ Already exists in S3: ${file.bucket}/${file.s3Key}`)
        skippedCount++
        continue
      }

      const fileBuffer = await fs.readFile(file.localPath)
      const mimeType = getMimeType(file.localPath)

      await uploadToS3({
        bucket: file.bucket,
        key: file.s3Key,
        body: fileBuffer,
        contentType: mimeType,
      })

      console.log(`${progress} ✅ Uploaded: ${file.bucket}/${file.s3Key} (${(file.size / 1024).toFixed(1)} KB)`)
      uploadedCount++
    } catch (err: any) {
      console.error(`${progress} ❌ Error uploading ${file.s3Key}:`, err?.message || err)
      failedCount++
    }
  }

  console.log('\n========================================')
  console.log('📊 Migration Summary:')
  console.log(`   Total files:   ${allFiles.length}`)
  console.log(`   Uploaded:      ${uploadedCount}`)
  console.log(`   Skipped:       ${skippedCount}`)
  console.log(`   Failed:        ${failedCount}`)
  console.log('========================================')

  if (failedCount === 0) {
    console.log('🎉 S3 Storage Migration Completed Successfully!')
  } else {
    console.warn('⚠️ S3 Storage Migration Finished with some errors.')
  }
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err)
  process.exit(1)
})
