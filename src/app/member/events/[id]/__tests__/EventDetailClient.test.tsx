import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import EventDetailClient from '../EventDetailClient'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockqr'),
  },
}))

describe('EventDetailClient - Member Photo Upload & Permissions', () => {
  const regularUser = {
    id: 55,
    username: 'staff55',
    name: 'นายสมบัติ รักดี',
    department: 'ผู้ป่วยใน',
    position: 'พยาบาลวิชาชีพ',
    role: 'user',
    isAdmin: false,
  }

  const organizerUser = {
    id: 10,
    username: 'doctor10',
    name: 'นพ. สมชาย เก่งกาจ',
    department: 'องค์กรแพทย์',
    position: 'นายแพทย์ชำนาญการ',
    role: 'user',
    isAdmin: false,
  }

  const baseEvent = {
    id: 101,
    title: 'กิจกรรมส่งเสริมสุขภาพโรงพยาบาลเถิน 2026',
    description: 'กิจกรรมวิ่งเพื่อสุขภาพและตรวจสุขภาพประจำปี',
    location: 'ลานอเนกประสงค์',
    eventStartDate: '2026-10-28T08:30:00.000Z',
    eventEndDate: '2026-10-28T16:30:00.000Z',
    checkinOpenTime: '2026-10-28T08:00:00.000Z',
    checkinCloseTime: '2026-10-28T17:00:00.000Z',
    status: 'UPCOMING',
    headOrganizerId: 10,
    canManage: false,
    attendances: [],
    registrations: [],
    attachments: [
      {
        id: 1,
        eventId: 101,
        attachmentType: 'IMAGE',
        title: 'ภาพจากเพื่อนร่วมงาน',
        filePath: '/uploads/events/101/friend.jpg',
        fileType: 'image/jpeg',
        fileSize: 1024,
        uploadedByMemberId: 88, // Another member
        createdAt: '2026-10-25T10:00:00+07:00',
        uploadedBy: { id: 88, name: 'นางสาวมาลี ดวงใจ' },
      },
      {
        id: 2,
        eventId: 101,
        attachmentType: 'IMAGE',
        title: 'ภาพของฉันเอง',
        filePath: '/uploads/events/101/myphoto.jpg',
        fileType: 'image/jpeg',
        fileSize: 2048,
        uploadedByMemberId: 55, // Logged-in regular member
        createdAt: '2026-10-25T11:00:00+07:00',
        uploadedBy: { id: 55, name: 'นายสมบัติ รักดี' },
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      })
    )
  })

  it('allows regular member to see "อัปโหลดภาพกิจกรรม" button and opens photo upload modal', async () => {
    render(
      <EventDetailClient
        event={baseEvent}
        checkinUrl="http://localhost:3000/checkin/test"
        currentUser={regularUser}
      />
    )

    // Switch to attachments tab
    const attachTabBtn = screen.getByRole('button', { name: /เอกสารและภาพกิจกรรม/i })
    fireEvent.click(attachTabBtn)

    // Regular member sees "อัปโหลดภาพกิจกรรม" buttons (both top action and tab header)
    const uploadButtons = screen.getAllByRole('button', { name: /อัปโหลดภาพกิจกรรม/i })
    expect(uploadButtons.length).toBeGreaterThanOrEqual(1)

    // Click to open upload modal
    fireEvent.click(uploadButtons[0])

    // Modal should open with photo upload title and member sharing notice
    expect(screen.getByText('📸 อัปโหลดภาพกิจกรรม')).toBeDefined()
    expect(screen.getByText(/สมาชิกทุกคนสามารถร่วมแชร์ภาพบรรยากาศกิจกรรมได้/i)).toBeDefined()
    
    // Once modal is open, modal submit button is present (along with the trigger buttons)
    const allUploadBtns = screen.getAllByRole('button', { name: /อัปโหลดภาพกิจกรรม/i })
    expect(allUploadBtns.length).toBe(3)
  })

  it('allows regular member to delete only their own uploaded photo', async () => {
    render(
      <EventDetailClient
        event={baseEvent}
        checkinUrl="http://localhost:3000/checkin/test"
        currentUser={regularUser}
      />
    )

    // Switch to attachments tab
    const attachTabBtn = screen.getByRole('button', { name: /เอกสารและภาพกิจกรรม/i })
    fireEvent.click(attachTabBtn)

    // Both photos are displayed
    expect(screen.getByText('ภาพจากเพื่อนร่วมงาน')).toBeDefined()
    expect(screen.getByText('ภาพของฉันเอง')).toBeDefined()

    // Check delete buttons: only 1 delete button should be visible (for my photo)
    const deleteButtons = screen.getAllByTitle('ลบรูปภาพ')
    expect(deleteButtons).toHaveLength(1)
  })

  it('allows organizer to see full management controls and delete all attachments', async () => {
    const organizerEvent = {
      ...baseEvent,
      canManage: true,
    }

    render(
      <EventDetailClient
        event={organizerEvent}
        checkinUrl="http://localhost:3000/checkin/test"
        currentUser={organizerUser}
      />
    )

    // Switch to attachments tab
    const attachTabBtn = screen.getByRole('button', { name: /เอกสารและภาพกิจกรรม/i })
    fireEvent.click(attachTabBtn)

    // Organizer sees "แนบไฟล์ / เอกสาร / ภาพ"
    const addBtn = screen.getByRole('button', { name: /แนบไฟล์ \/ เอกสาร \/ ภาพ/i })
    expect(addBtn).toBeDefined()

    // Organizer can delete both photos
    const deleteButtons = screen.getAllByTitle('ลบรูปภาพ')
    expect(deleteButtons).toHaveLength(2)

    // Click to open modal
    fireEvent.click(addBtn)

    // Organizer sees full type selection (IMAGE, DOCUMENT, NOTE)
    expect(screen.getByText('📄 เอกสาร/PDF')).toBeDefined()
    expect(screen.getByText('📝 ข้อความบันทึก')).toBeDefined()
    expect(screen.getByRole('button', { name: /บันทึกสิ่งที่แนบ/i })).toBeDefined()
  })
})
