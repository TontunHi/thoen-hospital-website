import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ServicePage from '../page'
import * as memberAuth from '@/lib/memberAuth'
import * as navigation from 'next/navigation'

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT')
    ;(error as any).digest = `NEXT_REDIRECT;${url}`
    throw error
  }),
}))

describe('ServicePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('redirects to /member/login when session is not present', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue(null)

    await expect(ServicePage()).rejects.toThrow('NEXT_REDIRECT')
    expect(navigation.redirect).toHaveBeenCalledWith('/member/login')
  })

  it('shows only lab, lab-tracker, and tb-cxr-tracker for subdistrict role', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 10,
      name: 'เจ้าหน้าที่ รพ.สต.',
      cid: '1234567890123',
      role: 'subdistrict',
    } as any)

    const jsx = await ServicePage()
    render(jsx)

    // Allowed services for subdistrict
    expect(screen.getByText('EMR Online')).toBeInTheDocument()
    expect(screen.getByText('รพ.สต. ติดตามผลแลป')).toBeInTheDocument()
    expect(screen.getByText('ติดตามการทำ CXR ผู้ป่วย TB')).toBeInTheDocument()

    // Hospital internal services should NOT be visible to subdistrict
    expect(screen.queryByText('สถานะห้องฉุกเฉิน (ER)')).not.toBeInTheDocument()
    expect(screen.queryByText('สถานะผู้ป่วยใน (IPD)')).not.toBeInTheDocument()
    expect(screen.queryByText('อัตราการครองเตียง')).not.toBeInTheDocument()
    expect(screen.queryByText('สถานะการรอรับยา OPD')).not.toBeInTheDocument()
    expect(screen.queryByText('รายการนัดผิดห้องตรวจ')).not.toBeInTheDocument()
    expect(screen.queryByText('ติดตามงบประมาณประจำปี')).not.toBeInTheDocument()
    expect(screen.queryByText('Dashboard-RCM')).not.toBeInTheDocument()
  })

  it('shows all internal systems for hospital member/admin roles', async () => {
    vi.spyOn(memberAuth, 'verifyMemberSession').mockResolvedValue({
      id: 1,
      name: 'เจ้าหน้าที่ รพ.เถิน',
      cid: '1234567890123',
      role: 'admin',
    } as any)

    const jsx = await ServicePage()
    render(jsx)

    expect(screen.getByText('EMR Online')).toBeInTheDocument()
    expect(screen.getByText('รพ.สต. ติดตามผลแลป')).toBeInTheDocument()
    expect(screen.getByText('ติดตามการทำ CXR ผู้ป่วย TB')).toBeInTheDocument()
    expect(screen.getByText('สถานะห้องฉุกเฉิน (ER)')).toBeInTheDocument()
    expect(screen.getByText('สถานะผู้ป่วยใน (IPD)')).toBeInTheDocument()
    expect(screen.getByText('Dashboard-RCM')).toBeInTheDocument()
  })
})
