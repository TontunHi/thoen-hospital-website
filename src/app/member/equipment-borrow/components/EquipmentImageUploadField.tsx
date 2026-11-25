'use client'

import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ImagePlus, Trash2, UploadCloud } from 'lucide-react'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export interface EquipmentImageUploadFieldProps {
  currentImageUrl: string | null
  pendingFile: File | null
  onFileSelect: (file: File | null) => void
  onClearImage: () => void
  disabled?: boolean
  label?: string
}

export function EquipmentImageUploadField({
  currentImageUrl,
  pendingFile,
  onFileSelect,
  onClearImage,
  disabled = false,
  label = 'รูปภาพประกอบอุปกรณ์',
}: EquipmentImageUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const objectUrl = useMemo(() => {
    if (!pendingFile) return null
    return URL.createObjectURL(pendingFile)
  }, [pendingFile])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const previewUrl = objectUrl || currentImageUrl

  const validateAndAccept = (file: File | null | undefined) => {
    if (!file) return
    setValidationError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP หรือ GIF เท่านั้น')
      return
    }
    if (file.size <= 0) {
      setValidationError('ไฟล์รูปภาพว่างเปล่า กรุณาเลือกไฟล์อื่น')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setValidationError('ขนาดรูปภาพต้องไม่เกิน 5 MB')
      return
    }

    onFileSelect(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    validateAndAccept(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    validateAndAccept(file)
  }

  return (
    <div className="formGroup">
      <label htmlFor={inputId}>{label}</label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="srOnlyInput"
        disabled={disabled}
        onChange={handleInputChange}
      />

      {previewUrl ? (
        <div className="imageUploadPreviewCard">
          <div className="imageUploadPreviewThumbWrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="ตัวอย่างรูปภาพอุปกรณ์" className="imageUploadPreviewImg" />
          </div>
          <div className="imageUploadPreviewMeta">
            <div className="imageUploadFileName">
              {pendingFile ? pendingFile.name : 'รูปภาพปัจจุบันที่แนบไว้'}
            </div>
            <div className="imageUploadHint">
              {pendingFile
                ? `ไฟล์ใหม่ ${(pendingFile.size / 1024).toFixed(0)} KB (จะบันทึกเมื่อกดปุ่มบันทึก)`
                : 'รองรับ JPG, PNG, WebP, GIF ขนาดไม่เกิน 5 MB'}
            </div>
            <div className="imageUploadActions">
              <button
                type="button"
                className="secondaryButton compactBtn"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus size={16} strokeWidth={1.5} />
                เปลี่ยนรูปภาพ
              </button>
              <button
                type="button"
                className="secondaryButton compactBtn dangerOutlineBtn"
                disabled={disabled}
                onClick={() => {
                  setValidationError(null)
                  onFileSelect(null)
                  onClearImage()
                }}
              >
                <Trash2 size={16} strokeWidth={1.5} />
                ลบรูปภาพ
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`imageDropzone ${isDragging ? 'imageDropzoneActive' : ''} ${disabled ? 'imageDropzoneDisabled' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="เลือกหรือลากไฟล์รูปภาพมาวางเพื่ออัปโหลด"
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
        >
          <UploadCloud size={24} strokeWidth={1.5} className="imageDropzoneIcon" aria-hidden="true" />
          <div className="imageDropzoneTitle">คลิกเพื่อเลือกรูปภาพ หรือลากไฟล์มาวางที่นี่</div>
          <div className="imageDropzoneHint">รองรับไฟล์ JPG, PNG, WebP, GIF ขนาดไม่เกิน 5 MB</div>
        </div>
      )}

      {validationError && (
        <div className="imageUploadError" role="alert">
          {validationError}
        </div>
      )}
    </div>
  )
}
