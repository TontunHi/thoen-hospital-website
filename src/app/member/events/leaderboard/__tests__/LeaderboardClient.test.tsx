import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LeaderboardClient, { IndividualRankItem, DepartmentRankItem } from '../LeaderboardClient'

describe('LeaderboardClient Component (New Design)', () => {
  const mockIndividual: IndividualRankItem[] = [
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

  const mockDepartment: DepartmentRankItem[] = [
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

  it('renders header, back link, fiscal year select, and Rank 1 summary card', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5}
      />
    )

    // Back link
    expect(screen.getByText('← กลับระบบกิจกรรม')).toBeInTheDocument()

    // Header title and subtitle
    expect(screen.getByText('กระดานคะแนนกิจกรรม')).toBeInTheDocument()
    expect(
      screen.getByText('บันทึกและเชิดชูเกียรติการเข้าร่วมกิจกรรมโรงพยาบาลเถินผ่าน ThaID')
    ).toBeInTheDocument()

    // Rank 1 card
    expect(screen.getByText('อันดับ 1')).toBeInTheDocument()
    expect(screen.getAllByText('นพ. เกรียงไกร มั่นคง').length).toBeGreaterThanOrEqual(1)

    // Summary stats
    expect(screen.getByText('ผู้เข้าร่วม')).toBeInTheDocument()
    expect(screen.getAllByText('แผนก/กลุ่มงาน').length).toBeGreaterThanOrEqual(1)
  })

  it('displays user standing card highlighting logged in member with score', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5} // rank 3, 20 points
      />
    )

    expect(screen.getByText('สถานะของฉัน')).toBeInTheDocument()
    expect(screen.getByText('อันดับของคุณ: 3 · คะแนน: 20')).toBeInTheDocument()
  })

  it('displays empty standing notice with CTA link when member has no points', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={999} // not in list
      />
    )

    expect(screen.getByText(/คุณยังไม่มีคะแนนสะสมในปีงบประมาณ/)).toBeInTheDocument()
    const ctaBtn = screen.getByRole('link', { name: 'ดูกิจกรรมที่เปิดรับ' })
    expect(ctaBtn).toBeInTheDocument()
    expect(ctaBtn).toHaveAttribute('href', '/member/events')
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

    const deptTab = screen.getByRole('tab', { name: /ระดับแผนก/ })
    expect(deptTab).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(deptTab)
    expect(deptTab).toHaveAttribute('aria-pressed', 'true')

    expect(screen.getByText('องค์กรแพทย์')).toBeInTheDocument()
    expect(screen.getByText('ผู้ป่วยใน (IPD)')).toBeInTheDocument()
  })

  it('filters individuals when searching query and shows empty state on no match', () => {
    render(
      <LeaderboardClient
        initialIndividual={mockIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={5}
      />
    )

    const searchInput = screen.getByPlaceholderText('ค้นหาชื่อ หรือแผนก')
    fireEvent.change(searchInput, { target: { value: 'วิชัย' } })

    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('นาย วิชัย ช่างทอง')
    expect(table).not.toHaveTextContent('นพ. เกรียงไกร มั่นคง')

    // Search query with no match
    fireEvent.change(searchInput, { target: { value: 'ไม่มีใครชื่อนี้แน่นอน' } })
    expect(screen.getByText('ไม่พบรายการที่ตรงกับคำค้นหา')).toBeInTheDocument()
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

  it('displays tied rank 1 properly in summary card when multiple members share rank 1', () => {
    const tiedIndividual: IndividualRankItem[] = [
      {
        rank: 1,
        memberId: 101,
        name: 'สมชาย รักชาติ',
        department: 'แผนก A',
        position: 'เจ้าหน้าที่',
        profilePath: null,
        totalPoints: 50,
        eventCount: 20,
      },
      {
        rank: 1,
        memberId: 102,
        name: 'สมหญิง ใจดี',
        department: 'แผนก B',
        position: 'พยาบาล',
        profilePath: null,
        totalPoints: 50,
        eventCount: 20,
      },
      {
        rank: 2,
        memberId: 103,
        name: 'สมศักดิ์ มั่งมี',
        department: 'แผนก C',
        position: 'แพทย์',
        profilePath: null,
        totalPoints: 40,
        eventCount: 15,
      },
    ]

    render(
      <LeaderboardClient
        initialIndividual={tiedIndividual}
        initialDepartment={mockDepartment}
        fiscalYears={mockFiscalYears}
        currentMemberId={101}
      />
    )

    expect(screen.getByText('อันดับ 1 ร่วมกัน 2 คน')).toBeInTheDocument()
    expect(screen.getAllByText('สมชาย รักชาติ').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('สมหญิง ใจดี').length).toBeGreaterThanOrEqual(1)
  })
})
