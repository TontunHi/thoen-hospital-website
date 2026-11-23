function handleDraftDates(endDate: Date): { startDate: Date; endDate: Date } {
  const future = new Date()
  future.setFullYear(future.getFullYear() + 10)
  const startDate = future
  let finalEndDate = endDate
  if (finalEndDate < new Date()) {
    const farFuture = new Date()
    farFuture.setFullYear(farFuture.getFullYear() + 50)
    finalEndDate = farFuture
  }
  return { startDate, endDate: finalEndDate }
}

function handleArchivedDates(startDate: Date): { startDate: Date; endDate: Date } {
  const past = new Date()
  past.setDate(past.getDate() - 1)
  const endDate = past
  let finalStartDate = startDate
  if (finalStartDate > new Date()) {
    finalStartDate = new Date()
  }
  return { startDate: finalStartDate, endDate }
}

function handlePublishedDates(
  startDate: Date,
  endDate: Date,
  publishedAt: string | null | undefined,
  expiredAt: string | null | undefined
): { startDate: Date; endDate: Date } {
  let finalStartDate = startDate
  const fiveYears = new Date()
  fiveYears.setFullYear(fiveYears.getFullYear() + 5)
  if (finalStartDate > fiveYears) {
    finalStartDate = new Date()
  } else if (finalStartDate > new Date()) {
    finalStartDate = publishedAt ? new Date(publishedAt) : new Date()
  }

  let finalEndDate = endDate
  if (finalEndDate < new Date()) {
    finalEndDate = expiredAt ? new Date(expiredAt) : new Date()
    if (!expiredAt) {
      const farFuture = new Date()
      farFuture.setFullYear(farFuture.getFullYear() + 50)
      finalEndDate = farFuture
    }
  }
  return { startDate: finalStartDate, endDate: finalEndDate }
}

export function calculateNewsDates(
  status: string | undefined,
  publishedAt: string | null | undefined,
  expiredAt: string | null | undefined,
  existing: any
) {
  const startDate = publishedAt
    ? new Date(publishedAt)
    : new Date(existing.startDate || existing.start_date)
  const endDate = expiredAt
    ? new Date(expiredAt)
    : new Date(existing.endDate || existing.end_date)

  if (status === 'DRAFT') {
    return handleDraftDates(endDate)
  }
  if (status === 'ARCHIVED') {
    return handleArchivedDates(startDate)
  }
  if (status === 'PUBLISHED') {
    return handlePublishedDates(startDate, endDate, publishedAt, expiredAt)
  }

  return { startDate, endDate }
}

export function buildNewsAttachmentsPayload(
  images: string[] | undefined,
  pdfUrl: string | null | undefined,
  existingAttachments: any[] = []
): Array<{ filePath: string; fileType: string; originalName: string }> | undefined {
  if (images === undefined && pdfUrl === undefined) return undefined

  const attachments: Array<{ filePath: string; fileType: string; originalName: string }> = []

  const finalImages: string[] =
    images !== undefined
      ? Array.isArray(images)
        ? images
        : []
      : existingAttachments
          .filter((att: any) => (att.fileType || att.file_type)?.startsWith('image/'))
          .map((att: any) => att.filePath || att.file_path)

  let finalPdfUrl: string | null = null
  if (pdfUrl !== undefined) {
    finalPdfUrl = pdfUrl
  } else {
    const existingPdf = existingAttachments.find(
      (att: any) => (att.fileType || att.file_type) === 'application/pdf'
    )
    finalPdfUrl = existingPdf ? existingPdf.filePath || existingPdf.file_path : null
  }

  for (const imgUrl of finalImages) {
    attachments.push({
      filePath: imgUrl,
      fileType: 'image/jpeg',
      originalName: imgUrl.split('/').pop() || 'image.jpg',
    })
  }

  if (finalPdfUrl) {
    attachments.push({
      filePath: finalPdfUrl,
      fileType: 'application/pdf',
      originalName: finalPdfUrl.split('/').pop() || 'document.pdf',
    })
  }

  return attachments
}
