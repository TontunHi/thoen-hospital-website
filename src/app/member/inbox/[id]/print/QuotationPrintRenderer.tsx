'use client'

import React, { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface QuotationItem {
  fileName: string
  filePath: string
  fileType?: string
  fileSize?: number
}

interface QuotationPrintRendererProps {
  quotations?: QuotationItem[]
}

function SingleQuotationPdf({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [pageImages, setPageImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false

    async function loadPdf() {
      try {
        setLoading(true)
        setError(null)

        const pdfjsLib = await import('pdfjs-dist')
        if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        }

        const loadingTask = pdfjsLib.getDocument(filePath)
        const pdfDoc = await loadingTask.promise
        const numPages = pdfDoc.numPages
        const renderedUrls: string[] = []

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (isCancelled) return
          const page = await pdfDoc.getPage(pageNum)
          // 2.0 scale gives high-res crisp rendering for A4 printing
          const viewport = page.getViewport({ scale: 2.0 })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const context = canvas.getContext('2d')

          if (context) {
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise
            renderedUrls.push(canvas.toDataURL('image/png'))
          }
        }

        if (!isCancelled) {
          setPageImages(renderedUrls)
          setLoading(false)
        }
      } catch (err: any) {
        console.error('Error rendering PDF quotation for print:', err)
        if (!isCancelled) {
          setError(err?.message || 'ไม่สามารถแสดงผล PDF ได้')
          setLoading(false)
        }
      }
    }

    loadPdf()

    return () => {
      isCancelled = true
    }
  }, [filePath])

  if (loading) {
    return (
      <div className="quotation-print-page" style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
          <Loader2 className="animate-spin" size={18} />
          <span>กำลังเตรียมเอกสารใบเสนอราคา ({fileName})...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="quotation-print-page" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>⚠️ ไม่สามารถโหลดหน้าเอกสาร {fileName} ได้ ({error})</p>
      </div>
    )
  }

  return (
    <>
      {pageImages.map((dataUrl, idx) => (
        <div key={idx} className="quotation-print-page" style={{ textAlign: 'center', margin: 0, padding: 0 }}>
          <img
            src={dataUrl}
            alt={`${fileName} หน้า ${idx + 1}`}
            style={{
              maxWidth: '100%',
              maxHeight: '275mm',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
            }}
          />
        </div>
      ))}
    </>
  )
}

export default function QuotationPrintRenderer({ quotations }: QuotationPrintRendererProps) {
  if (!quotations || !Array.isArray(quotations) || quotations.length === 0) {
    return null
  }

  return (
    <>
      {quotations.map((q, idx) => {
        const isPdf = /\.pdf$/i.test(q.fileName || q.filePath) || q.fileType === 'application/pdf'

        if (isPdf) {
          return (
            <SingleQuotationPdf
              key={idx}
              filePath={q.filePath}
              fileName={q.fileName}
            />
          )
        }

        // Image file
        return (
          <div key={idx} className="quotation-print-page" style={{ textAlign: 'center', margin: 0, padding: 0 }}>
            <img
              src={q.filePath}
              alt={q.fileName || `ใบเสนอราคา ${idx + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '275mm',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                display: 'block',
                margin: '0 auto',
              }}
            />
          </div>
        )
      })}
    </>
  )
}
