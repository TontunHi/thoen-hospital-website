import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MokClient from '../MokClient'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('MokClient Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    // Default mock response
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('mode=summary')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              counts: { asthma: 2, ckd_all: 5, copd: 3 },
            }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [
              {
                cid: '1520800123456',
                hn: '001234',
                ptname: 'นายสมชาย ใจดี',
                age: 65,
                address: '123 ม.2 ต.ล้อมแรด',
                moopart: '2',
                tambon_name: 'ล้อมแรด',
                occupation_name: 'เกษตรกร',
                vstdate: '2024-03-15',
                cn: 'ระยะ 1',
              },
            ],
          }),
      })
    })
  })

  it('renders header, title, and catchment toggle without errors', async () => {
    render(<MokClient user={{ username: 'testuser', role: 'staff' }} />)

    expect(screen.getByText('หมออนามัยครอบครัว (มอค.)')).toBeInTheDocument()
    expect(screen.getByText('กลับหน้ารวมบริการ')).toBeInTheDocument()
    expect(screen.getByText('ในเขตรับผิดชอบ (Type 1, 3)')).toBeInTheDocument()
    expect(screen.getByText('นอกเขต อ.เถิน (Type 4)')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText('นายสมชาย ใจดี').length).toBeGreaterThan(0)
    })
  })

  it('formats CID with Thai ID masking/grouping (1-5208-00123-45-6)', async () => {
    render(<MokClient user={{ username: 'testuser' }} />)

    await waitFor(() => {
      expect(screen.getAllByText('1-5208-00123-45-6').length).toBeGreaterThan(0)
    })
  })

  it('displays category group pills without emojis', async () => {
    render(<MokClient user={{ username: 'testuser' }} />)

    expect(screen.getByRole('tab', { name: /ทั้งหมด/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /คลินิกโรคเรื้อรัง/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /เฝ้าระวังและการดูแลเฉพาะ/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ตรวจสอบคุณภาพข้อมูล/ })).toBeInTheDocument()
  })

  it('filters records when search query is entered and clears on clear button', async () => {
    render(<MokClient user={{ username: 'testuser' }} />)

    await waitFor(() => {
      expect(screen.getAllByText('นายสมชาย ใจดี').length).toBeGreaterThan(0)
    })

    const searchInput = screen.getByPlaceholderText(/ค้นหา CID, HN, ชื่อ-สกุล/)
    fireEvent.change(searchInput, { target: { value: 'ไม่พบชื่อนี้แน่นอน' } })

    await waitFor(() => {
      expect(screen.queryByText('นายสมชาย ใจดี')).not.toBeInTheDocument()
      expect(screen.getByText('ไม่พบข้อมูลผู้ป่วยในหมวดหมู่นี้')).toBeInTheDocument()
    })

    // Click clear button
    const clearBtn = screen.getByTitle('ล้างข้อความค้นหา')
    fireEvent.click(clearBtn)

    await waitFor(() => {
      expect(screen.getAllByText('นายสมชาย ใจดี').length).toBeGreaterThan(0)
    })
  })

  it('restores saved catchment from localStorage after mount without hydration mismatch', async () => {
    localStorage.setItem('mok_catchment', 'out_catchment')
    render(<MokClient user={{ username: 'testuser' }} />)

    await waitFor(() => {
      const outCatchmentBtn = screen.getByText('นอกเขต อ.เถิน (Type 4)').closest('button')
      expect(outCatchmentBtn?.classList.contains('active')).toBe(true)
    })
  })
})
