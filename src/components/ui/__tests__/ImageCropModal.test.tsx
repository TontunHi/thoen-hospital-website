import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ImageCropModal from '../ImageCropModal'

describe('ImageCropModal Component', () => {
  const mockOnClose = vi.fn()
  const mockOnSave = vi.fn()
  const sampleImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn().mockReturnValue({
        data: new Uint8ClampedArray(400),
        width: 10,
        height: 10
      })
    }) as any

    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((cb) => {
      const blob = new Blob(['fake-image'], { type: 'image/png' })
      cb(blob)
    })

    // Mock Image in jsdom to trigger onload immediately
    class MockImage {
      naturalWidth = 800
      naturalHeight = 1000
      width = 800
      height = 1000
      crossOrigin = ''
      _src = ''
      onload: (() => void) | null = null

      set src(val: string) {
        this._src = val
        setTimeout(() => {
          if (this.onload) this.onload()
        }, 10)
      }
      get src() {
        return this._src
      }
    }

    vi.stubGlobal('Image', MockImage)
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ImageCropModal
        isOpen={false}
        imageSrc={sampleImage}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders modal with crop tools and live previews when open', async () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc={sampleImage}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    expect(screen.getByText('ตัดครอบรูปถ่ายบุคลากร (Crop Staff Photo)')).toBeDefined()
    expect(screen.getByText('3 : 4')).toBeDefined()
    expect(screen.getByText('1 : 1')).toBeDefined()
    expect(screen.getByText('อิสระ')).toBeDefined()
    expect(screen.getByText('ซูมภาพ (Zoom)')).toBeDefined()
    expect(screen.getByText('หมุน 90°')).toBeDefined()
    expect(screen.getByText('กลับแนวนอน')).toBeDefined()
    expect(screen.getByText('อวาตาร์วงกลม')).toBeDefined()
    expect(screen.getByText('รูปติดบัตร 3:4')).toBeDefined()
  })

  it('triggers onClose when clicking cancel button', () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc={sampleImage}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    const cancelBtn = screen.getByText('ยกเลิก')
    fireEvent.click(cancelBtn)
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('triggers onSave when clicking save button after image loads', async () => {
    render(
      <ImageCropModal
        isOpen={true}
        imageSrc={sampleImage}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    // Wait for image onload
    await new Promise((r) => setTimeout(r, 50))

    const saveBtn = screen.getByText('ตกลงและบันทึกรูปภาพ')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1)
      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })
  })

  it('allows dragging and moving the crop box across viewport', async () => {
    const { container } = render(
      <ImageCropModal
        isOpen={true}
        imageSrc={sampleImage}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    )

    await new Promise((r) => setTimeout(r, 50))

    const canvas = container.querySelector('canvas') as HTMLCanvasElement
    expect(canvas).toBeDefined()

    Object.defineProperty(canvas, 'clientWidth', { value: 700, configurable: true })
    Object.defineProperty(canvas, 'clientHeight', { value: 500, configurable: true })
    canvas.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      width: 700,
      height: 500
    })

    // Pointer down in center of crop box
    fireEvent.pointerDown(canvas, { clientX: 350, clientY: 250, pointerId: 1 })
    // Move 50px right, 30px down
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 280, pointerId: 1 })
    // Pointer up
    fireEvent.pointerUp(canvas, { clientX: 400, clientY: 280, pointerId: 1 })

    // Save and check
    const saveBtn = screen.getByText('ตกลงและบันทึกรูปภาพ')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1)
    })
  })
})
