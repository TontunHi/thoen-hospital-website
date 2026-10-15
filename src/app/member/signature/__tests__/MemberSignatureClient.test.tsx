import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MemberSignatureClient from '../MemberSignatureClient'

describe('MemberSignatureClient Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/signatures') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              exists: true,
              updatedAt: '2026-10-15T09:00:00.000Z',
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        })
      })
    )
  })

  it('renders executive header and existing signature status', async () => {
    render(<MemberSignatureClient />)

    expect(screen.getByText('โรงพยาบาลเถิน จ.ลำปาง • ระบบลายเซ็นดิจิทัล')).toBeInTheDocument()
    expect(
      screen.getByText('จัดการลายเซ็นดิจิทัลเจ้าหน้าที่ (Digital Signature)')
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('ลงทะเบียนแล้ว')).toBeInTheDocument()
    })
  })

  it('allows switching between draw and upload tabs', async () => {
    render(<MemberSignatureClient />)

    const drawTab = screen.getByRole('tab', { name: /วาดลายเซ็นดิจิทัล/ })
    const uploadTab = screen.getByRole('tab', { name: /อัปโหลดไฟล์ภาพ/ })

    expect(drawTab).toHaveAttribute('aria-selected', 'true')
    expect(uploadTab).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(uploadTab)
    await waitFor(() => {
      expect(uploadTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('คลิกเพื่อเลือกไฟล์รูปภาพลายเซ็น')).toBeInTheDocument()
    })

    fireEvent.click(drawTab)
    await waitFor(() => {
      expect(drawTab).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('ล้างกระดาน')).toBeInTheDocument()
    })
  })

  it('shows error message if attempting to save empty canvas', async () => {
    render(<MemberSignatureClient />)

    const saveButton = screen.getByText('บันทึกลายเซ็นนี้')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('กรุณาวาดลายเซ็นของคุณก่อนกดบันทึก')
    })
  })
})
