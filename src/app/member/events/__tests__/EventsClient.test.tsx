import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EventsClient from '../EventsClient'

describe('EventsClient Component', () => {
  const mockUserStats = {
    totalPoints: 120,
    registeredCount: 3,
  }

  const mockCurrentUser = {
    id: 5,
    username: 'nurse_somjai',
    name: 'สมใจ รักษาดี',
    department: 'ผู้ป่วยใน (IPD)',
    position: 'พยาบาลวิชาชีพ',
    role: 'staff',
    isAdmin: false,
  }

  const mockEvents = [
    {
      id: 101,
      title: 'โครงการอบรมช่วยฟื้นคืนชีพขั้นสูง (ACLS 2026)',
      description: 'การฝึกอบรมการช่วยฟื้นคืนชีพสำหรับบุคลากรทางการแพทย์',
      location: 'ห้องประชุมเวียงเถิน ชั้น 4',
      bannerUrl: null,
      eventStartDate: '2026-10-20T08:30:00.000Z',
      eventEndDate: '2026-10-20T16:30:00.000Z',
      checkinOpenTime: '2026-10-20T08:00:00.000Z',
      checkinCloseTime: '2026-10-20T17:00:00.000Z',
      fiscalYear: '2570',
      status: 'PUBLISHED',
      headOrganizerId: 2,
      headOrganizer: {
        id: 2,
        name: 'พญ. พรทิพย์ สุขเกษม',
        department: 'องค์กรแพทย์',
        profilePath: null,
      },
      registrationCount: 25,
      attendanceCount: 0,
      isOrganizer: false,
    },
  ]

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          events: mockEvents,
        }),
      })
    )
  })

  it('renders executive hospital header and personal stats', () => {
    render(
      <EventsClient
        initialEvents={mockEvents}
        userStats={mockUserStats}
        currentUser={mockCurrentUser}
      />
    )

    expect(
      screen.getByText('โรงพยาบาลเถิน จ.ลำปาง • ระบบกิจกรรมและเช็คอิน ThaID')
    ).toBeInTheDocument()
    expect(
      screen.getByText('กิจกรรมและโครงการโรงพยาบาลเถิน')
    ).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('โครงการอบรมช่วยฟื้นคืนชีพขั้นสูง (ACLS 2026)')).toBeInTheDocument()
    expect(screen.getByText('ห้องประชุมเวียงเถิน ชั้น 4')).toBeInTheDocument()
  })

  it('renders admin create button only for admins', () => {
    const { rerender } = render(
      <EventsClient
        initialEvents={mockEvents}
        userStats={mockUserStats}
        currentUser={mockCurrentUser}
      />
    )

    expect(screen.queryByText('+ สร้างกิจกรรมใหม่')).not.toBeInTheDocument()

    rerender(
      <EventsClient
        initialEvents={mockEvents}
        userStats={mockUserStats}
        currentUser={{ ...mockCurrentUser, isAdmin: true }}
      />
    )

    expect(screen.getByText('+ สร้างกิจกรรมใหม่')).toBeInTheDocument()
  })

  it('filters events when searching query', () => {
    render(
      <EventsClient
        initialEvents={mockEvents}
        userStats={mockUserStats}
        currentUser={mockCurrentUser}
      />
    )

    const searchInput = screen.getByPlaceholderText('ค้นหาชื่อกิจกรรม หรือสถานที่...')
    fireEvent.change(searchInput, { target: { value: 'ห้องประชุมเวียงเถิน' } })

    expect(screen.getByText('โครงการอบรมช่วยฟื้นคืนชีพขั้นสูง (ACLS 2026)')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'ไม่พบกิจกรรมใดๆ' } })
    expect(screen.getByText('ไม่พบกิจกรรม')).toBeInTheDocument()
    expect(screen.getByText('ไม่พบกิจกรรมที่ตรงกับคำค้นหาในหมวดหมู่นี้')).toBeInTheDocument()
  })

  it('renders 3 filter tabs with correct badge counts', () => {
    const mixedEvents = [
      {
        id: 1,
        title: 'กิจกรรมเดือนหน้า',
        location: 'ห้องประชุม 1',
        eventStartDate: '2026-11-20T09:00:00.000Z',
        eventEndDate: '2026-11-20T16:00:00.000Z',
        checkinOpenTime: '2026-11-20T08:00:00.000Z',
        checkinCloseTime: '2026-11-20T17:00:00.000Z',
        fiscalYear: '2570',
        status: 'PUBLISHED',
        headOrganizerId: 1,
        registrationCount: 10,
        attendanceCount: 0,
        isOrganizer: false,
      },
      {
        id: 2,
        title: 'กิจกรรมเมื่อวานนี้',
        location: 'ลานกิจกรรม',
        eventStartDate: '2026-10-14T08:00:00.000Z',
        eventEndDate: '2026-10-14T12:00:00.000Z',
        checkinOpenTime: '2026-10-14T07:30:00.000Z',
        checkinCloseTime: '2026-10-14T13:00:00.000Z',
        fiscalYear: '2570',
        status: 'COMPLETED',
        headOrganizerId: 1,
        registrationCount: 30,
        attendanceCount: 28,
        isOrganizer: false,
      },
    ]

    render(
      <EventsClient
        initialEvents={mixedEvents}
        userStats={{ totalPoints: 100, registeredCount: 5 }}
        currentUser={mockCurrentUser}
      />
    )

    // Check tab buttons and badge counts
    expect(screen.getByRole('tab', { name: /กิจกรรม เร็วๆ นี้ \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /กิจกรรมที่เสร็จสิ้น \(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /ที่ฉันลงทะเบียนไว้ \(5\)/ })).toBeInTheDocument()
  })

  it('orders upcoming events nearest first in the default tab and allows tab switching', async () => {
    const upcomingEvents = [
      {
        id: 1,
        title: 'กิจกรรมเดือนหน้า',
        location: 'ห้องประชุม 1',
        eventStartDate: '2026-11-20T09:00:00.000Z',
        eventEndDate: '2026-11-20T16:00:00.000Z',
        checkinOpenTime: '2026-11-20T08:00:00.000Z',
        checkinCloseTime: '2026-11-20T17:00:00.000Z',
        fiscalYear: '2570',
        status: 'PUBLISHED',
        headOrganizerId: 1,
        registrationCount: 10,
        attendanceCount: 0,
        isOrganizer: false,
      },
      {
        id: 2,
        title: 'กิจกรรมสัปดาห์หน้า',
        location: 'ห้องประชุม 2',
        eventStartDate: '2026-10-22T09:00:00.000Z',
        eventEndDate: '2026-10-22T16:00:00.000Z',
        checkinOpenTime: '2026-10-22T08:00:00.000Z',
        checkinCloseTime: '2026-10-22T17:00:00.000Z',
        fiscalYear: '2570',
        status: 'PUBLISHED',
        headOrganizerId: 1,
        registrationCount: 15,
        attendanceCount: 0,
        isOrganizer: false,
      },
      {
        id: 3,
        title: 'กิจกรรมเมื่อวานนี้',
        location: 'ลานกิจกรรม',
        eventStartDate: '2026-10-14T08:00:00.000Z',
        eventEndDate: '2026-10-14T12:00:00.000Z',
        checkinOpenTime: '2026-10-14T07:30:00.000Z',
        checkinCloseTime: '2026-10-14T13:00:00.000Z',
        fiscalYear: '2570',
        status: 'COMPLETED',
        headOrganizerId: 1,
        registrationCount: 30,
        attendanceCount: 28,
        isOrganizer: false,
      },
      {
        id: 4,
        title: 'กิจกรรมเดือนที่แล้ว',
        location: 'ห้องประชุม 3',
        eventStartDate: '2026-09-20T09:00:00.000Z',
        eventEndDate: '2026-09-20T16:00:00.000Z',
        checkinOpenTime: '2026-09-20T08:00:00.000Z',
        checkinCloseTime: '2026-09-20T17:00:00.000Z',
        fiscalYear: '2569',
        status: 'COMPLETED',
        headOrganizerId: 1,
        registrationCount: 40,
        attendanceCount: 38,
        isOrganizer: false,
      },
    ]

    const completedEvents = [upcomingEvents[2], upcomingEvents[3]]

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('tab=completed')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              events: completedEvents,
            }),
          })
        }
        if (url.includes('tab=registered')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              events: [upcomingEvents[1], upcomingEvents[2]],
            }),
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            events: upcomingEvents,
          }),
        })
      })
    )

    render(
      <EventsClient
        initialEvents={upcomingEvents}
        userStats={mockUserStats}
        currentUser={mockCurrentUser}
      />
    )

    // In default upcoming tab, only upcoming events are visible, sorted by nearest date first:
    const upcomingTitles = screen.getAllByRole('link', { name: /กิจกรรม/ }).map((el) => el.textContent)
    expect(upcomingTitles).toContain('กิจกรรมสัปดาห์หน้า')
    expect(upcomingTitles).toContain('กิจกรรมเดือนหน้า')
    expect(upcomingTitles).not.toContain('กิจกรรมเมื่อวานนี้')
    expect(upcomingTitles).not.toContain('กิจกรรมเดือนที่แล้ว')

    const indexNextWeek = upcomingTitles.indexOf('กิจกรรมสัปดาห์หน้า')
    const indexNextMonth = upcomingTitles.indexOf('กิจกรรมเดือนหน้า')
    expect(indexNextWeek).toBeLessThan(indexNextMonth)

    // Switch to completed tab
    const completedTab = screen.getByRole('tab', { name: /กิจกรรมที่เสร็จสิ้น/ })
    fireEvent.click(completedTab)

    await waitFor(() => {
      expect(screen.getByText('กิจกรรมเมื่อวานนี้')).toBeInTheDocument()
      expect(screen.getByText('กิจกรรมเดือนที่แล้ว')).toBeInTheDocument()
    })

    // Switch to registered tab with both upcoming and past events -> divider appears
    const registeredTab = screen.getByRole('tab', { name: /ที่ฉันลงทะเบียนไว้/ })
    fireEvent.click(registeredTab)

    await waitFor(() => {
      expect(screen.getByText('กิจกรรมที่เสร็จสิ้นแล้ว')).toBeInTheDocument()
    })
  })

  it('renders pre-registration button next to details button and allows toggling registration', async () => {
    const singleUpcomingEvent = [
      {
        id: 501,
        title: 'โครงการอบรมช่วยฟื้นคืนชีพขั้นสูง (ACLS 2026)',
        location: 'ห้องประชุมเวียงเถิน ชั้น 4',
        eventStartDate: '2026-10-25T08:30:00.000Z',
        eventEndDate: '2026-10-25T16:30:00.000Z',
        checkinOpenTime: '2026-10-25T08:00:00.000Z',
        checkinCloseTime: '2026-10-25T17:00:00.000Z',
        fiscalYear: '2570',
        status: 'PUBLISHED',
        headOrganizerId: 2,
        registrationCount: 10,
        attendanceCount: 0,
        isOrganizer: false,
        hasRegistered: false,
      },
    ]

    const mockFetch = vi.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/register')) {
        const isDelete = options?.method === 'DELETE'
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            message: isDelete ? 'ยกเลิกการลงทะเบียนเรียบร้อยแล้ว' : 'ลงทะเบียนเรียบร้อยแล้ว',
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, events: singleUpcomingEvent }),
      })
    })

    vi.stubGlobal('fetch', mockFetch)

    render(
      <EventsClient
        initialEvents={singleUpcomingEvent}
        userStats={{ totalPoints: 99, registeredCount: 0 }}
        currentUser={mockCurrentUser}
      />
    )

    // Pre-registration button should be present next to details button
    const registerBtn = screen.getByRole('button', { name: /ลงทะเบียนล่วงหน้า/ })
    expect(registerBtn).toBeInTheDocument()
    expect(screen.getByText('ดูรายละเอียด')).toBeInTheDocument()

    // Click to register
    fireEvent.click(registerBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/member/events/501/register'),
        expect.objectContaining({ method: 'POST' })
      )
      expect(screen.getByRole('button', { name: /ลงทะเบียนแล้ว/ })).toBeInTheDocument()
      expect(screen.getByText('11')).toBeInTheDocument() // 10 + 1 registration count
    })

    // Click again to cancel registration
    const registeredBtn = screen.getByRole('button', { name: /ลงทะเบียนแล้ว/ })
    fireEvent.click(registeredBtn)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/member/events/501/register'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(screen.getByRole('button', { name: /ลงทะเบียนล่วงหน้า/ })).toBeInTheDocument()
      expect(screen.getByText('10')).toBeInTheDocument() // reverts back to 10
    })
  })
})
