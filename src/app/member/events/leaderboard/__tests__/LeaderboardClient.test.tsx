import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LeaderboardClient from '../LeaderboardClient'

describe('LeaderboardClient Component', () => {
  const mockIndividual = [
    {
      rank: 1,
      memberId: 10,
      name: 'นพ. เกรียงไกร มั่นคง',
      department: 'กลุ่มงานศัลยกรรม',
      position: 'นายแพทย์ชำนาญการพิเศษ',
      profilePath: null,
      totalPoints: 35,
      eventCount: 15,
    },
    {
      rank: 2,
      memberId: 12,
      name: 'พญ. พรทิพย์ สุขเกษม',
      department: 'องค์กรแพทย์',
      position: 'นายแพทย์ชำนาญการ',
      profilePath: null,
      totalPoints: 28,
      eventCount: 12,
    },
    {
      rank: 3,
      memberId: 5,
      name: 'พยาบาล สมใจ รักษาดี',
      department: 'ผู้ป่วยใน (IPD)',
      position: 'พยาบาลวิชาชีพชำนาญการ',
      profilePath: null,
      totalPoints: 20,
      eventCount: 9,
    },
    {
      rank: 4,
      memberId: 20,
      name: 'นาย วิชัย ช่างทอง',
      department: 'ศูนย์คอมพิวเตอร์',
      position: 'นักวิชาการคอมพิวเตอร์',
      profilePath: null,
      totalPoints: 14,
      eventCount: 6,
    },
  ]

  const mockDepartment = [
    {
      rank: 1,
      department: 'องค์กรแพทย์',
      totalPoints: 63,
      memberCount: 5,
      avgPointsPerMember: 12.6,
    },
    {
      rank: 2,
      department: 'ผู้ป่วยใน (IPD)',
      totalPoints: 50,
      memberCount: 10,
      avgPointsPerMember: 5.0,
    },
  ]

  const mockFiscalYears = ['2570', '2569']

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            individual: mockIndividual,
            department: mockDepartment,
            fiscalYears: mockFiscalYears,
          },
        }),
      })
    )
  })

  it('renders hospital hero header, fiscal year select, and podium for top 3', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5}
      />
    )

    // Hero title and tag
    expect(screen.getByText('กระดานคะแนนกิจกรรม')).toBeInTheDocument()
    expect(screen.getByText('กระดานเกียรติยศการมีส่วนร่วม • โรงพยาบาลเถิน')).toBeInTheDocument()

    // Podium top 3 names exist in document
    expect(screen.getAllByText('นพ. เกรียงไกร มั่นคง').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('พญ. พรทิพย์ สุขเกษม').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('พยาบาล สมใจ รักษาดี').length).toBeGreaterThanOrEqual(1)

    // Top 1 Gold crown badge
    expect(screen.getByText('อันดับ 1 (ยอดเยี่ยม)')).toBeInTheDocument()
  })

  it('displays user standing card highlighting logged in member', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5} // rank 3
      />
    )

    // My standing shows rank #3 and Top 3 Honor badge
    expect(screen.getByText('สถานะของฉัน')).toBeInTheDocument()
    expect(screen.getByText('#3')).toBeInTheDocument()
    expect(screen.getByText('Top 3 เกียรติยศ')).toBeInTheDocument()
  })

  it('switches between individual and department tabs', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5}
      />
    )

    const deptTab = screen.getByRole('tab', { name: /อันดับระดับแผนก/ })
    fireEvent.click(deptTab)

    expect(screen.getByText('องค์กรแพทย์')).toBeInTheDocument()
    expect(screen.getByText('12.6 แต้ม/คน')).toBeInTheDocument()
    expect(screen.getByText('ผู้ป่วยใน (IPD)')).toBeInTheDocument()
  })

  it('filters individuals when searching query', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5}
      />
    )

    const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ หรือแผนก...')
    fireEvent.change(searchInput, { target: { value: 'วิชัย' } })

    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('นาย วิชัย ช่างทอง')
    expect(table).not.toHaveTextContent('นพ. เกรียงไกร มั่นคง')

    // Clear search
    const clearBtn = screen.getByTitle('ล้างคำค้นหา')
    fireEvent.click(clearBtn)
    expect(table).toHaveTextContent('นพ. เกรียงไกร มั่นคง')
  })

  it('handles fiscal year change and fetches new data', async () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5}
      />
    )

    const yearSelect = screen.getByLabelText('เลือกปีงบประมาณ')
    fireEvent.change(yearSelect, { target: { value: '2569' } })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/member/events/leaderboard?fiscalYear=2569')
      )
    })
  })
})
