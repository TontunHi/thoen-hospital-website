import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuditLogsClient from '../AuditLogsClient'

describe('AuditLogsClient Component (Hallmark Anti-AI-Slop Redesign)', () => {
  const mockLogs = [
    {
      id: 101,
      timestamp: '2026-10-15T08:30:00Z',
      username: 'doctor01',
      email: 'doctor01@thoenhospital.go.th',
      action_type: 'LOGIN',
      target_table: null,
      action_details: JSON.stringify({ method: 'OTP', device: 'Chrome on Windows' }),
      ip_address: '192.168.1.50',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    {
      id: 102,
      timestamp: '2026-10-15T09:15:00Z',
      username: 'nurse02',
      email: 'nurse02@thoenhospital.go.th',
      action_type: 'READ',
      target_table: 'salary_slips',
      action_details: JSON.stringify({ slipId: 45, period: '10/2026' }),
      ip_address: '192.168.1.65',
      user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    },
    {
      id: 103,
      timestamp: '2026-10-15T10:00:00Z',
      username: 'admin01',
      email: 'admin01@thoenhospital.go.th',
      action_type: 'UPDATE',
      target_table: 'members',
      action_details: JSON.stringify({ memberId: 12, changes: { role: 'admin' } }),
      ip_address: '127.0.0.1',
      user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  ]

  const mockStats = {
    totalLogs: 1250,
    sizeMb: 4.8,
    oldestLog: '2026-07-15T00:00:00Z',
    newestLog: '2026-10-15T10:00:00Z',
    retainedDays: 92,
    policyRetentionDays: 90,
    loginsToday: 42,
    readsToday: 18,
    changesToday: 7,
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/admin/audit-logs/stats')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, stats: mockStats }),
        })
      }
      if (url.includes('/api/admin/audit-logs')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            logs: mockLogs,
            pagination: { page: 1, limit: 25, total: 3, totalPages: 1 },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      })
    }))
  })

  it('renders executive compliance header and security stats cards', async () => {
    render(<AuditLogsClient />)

    // Verify Title & Badges
    expect(screen.getByText('ระบบประวัติความปลอดภัยและ Audit Logs')).toBeInTheDocument()
    expect(screen.getByText('PDPA & Hospital Security Standard')).toBeInTheDocument()
    expect(screen.getByText('บันทึกเรียลไทม์ Tier-1 Audit')).toBeInTheDocument()

    // Wait for stats to load
    await waitFor(() => {
      expect(screen.getByText('1,250')).toBeInTheDocument()
      expect(screen.getByText('42 ครั้ง')).toBeInTheDocument()
      expect(screen.getByText('18 ครั้ง')).toBeInTheDocument()
      expect(screen.getByText('92 วัน')).toBeInTheDocument()
    })
  })

  it('renders audit logs list with users, actions, target tables, and IP addresses', async () => {
    render(<AuditLogsClient />)

    await waitFor(() => {
      expect(screen.getAllByText('doctor01').length).toBeGreaterThanOrEqual(1)
    })

    // Verify logs
    expect(screen.getAllByText('nurse02').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('admin01').length).toBeGreaterThanOrEqual(1)

    // Verify action badges
    expect(screen.getAllByText('LOGIN').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('READ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('UPDATE').length).toBeGreaterThanOrEqual(1)

    // Verify targets
    expect(screen.getAllByText(/สลิปเงินเดือน/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/ข้อมูลบุคลากร/).length).toBeGreaterThanOrEqual(1)

    // Verify IP
    expect(screen.getAllByText('192.168.1.50').length).toBeGreaterThanOrEqual(1)
  })

  it('filters logs when selecting an action type chip', async () => {
    render(<AuditLogsClient />)

    await waitFor(() => {
      expect(screen.getAllByText('doctor01').length).toBeGreaterThanOrEqual(1)
    })

    const loginChip = screen.getByRole('tab', { name: /LOGIN/ })
    fireEvent.click(loginChip)

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('actionType=LOGIN'))
  })

  it('submits search query and fetches filtered logs', async () => {
    render(<AuditLogsClient />)

    await waitFor(() => {
      expect(screen.getAllByText('doctor01').length).toBeGreaterThanOrEqual(1)
    })

    const searchInput = screen.getByPlaceholderText(/ค้นหาชื่อผู้ใช้/)
    fireEvent.change(searchInput, { target: { value: 'nurse02' } })

    const searchBtn = screen.getByText('ค้นหารายการ')
    fireEvent.click(searchBtn)

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('search=nurse02'))
  })

  it('opens details modal with audit payload and closes cleanly', async () => {
    render(<AuditLogsClient />)

    await waitFor(() => {
      expect(screen.getAllByText('doctor01').length).toBeGreaterThanOrEqual(1)
    })

    // Click "ดูบันทึก" on first row
    const viewButtons = screen.getAllByTitle('ดูข้อมูลเจาะลึกความปลอดภัย')
    fireEvent.click(viewButtons[0])

    // Verify modal is open
    expect(screen.getByText('รายละเอียดบันทึกความปลอดภัย')).toBeInTheDocument()
    expect(screen.getByText('Audit Log Entry ID #101')).toBeInTheDocument()
    expect(screen.getByText(/OTP/)).toBeInTheDocument()

    // Close modal
    const closeBtn = screen.getByLabelText('ปิดหน้าต่าง')
    fireEvent.click(closeBtn)

    expect(screen.queryByText('รายละเอียดบันทึกความปลอดภัย')).not.toBeInTheDocument()
  })
})
