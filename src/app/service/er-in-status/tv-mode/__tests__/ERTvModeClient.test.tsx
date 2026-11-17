import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ERTvModeClient from '../ERTvModeClient'

const syntheticTvResponse = {
  activePatients: [
    {
      hn: 'xxxx0102',
      vn: 'xxxx0002',
      ptname: 'นางสาวตัวอย่าง นามสกุลทดสอบ',
      age: 40,
      bedno: null,
      enter_time: '09:10:00',
      er_list: null,
      er_emergency_level_name: 'Urgency',
      er_emergency_level_id: 3,
      observe: 'N',
      dch_type_name: 'รอผลตรวจ',
    },
    {
      hn: 'xxxx0101',
      vn: 'xxxx0001',
      ptname: 'นายสมมติ นามสกุลปลอม',
      age: 65,
      bedno: '2',
      enter_time: '09:20:00',
      er_list: null,
      er_emergency_level_name: 'Resuscitate',
      er_emergency_level_id: 1,
      observe: 'Y',
      dch_type_name: 'กำลังตรวจรักษา',
    },
  ],
  summary: {
    totalActive: 2,
    critical: 1,
    emergency: 0,
    urgency: 1,
    semiUrgency: 0,
    nonUrgency: 0,
  },
}

describe('ERTvModeClient', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => syntheticTvResponse,
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches tv-mode API, sorts by triage priority, strips surnames, and displays KPI header', async () => {
    render(<ERTvModeClient />)

    await waitFor(() => {
      expect(screen.getByText('โรงพยาบาลเถิน · จอแสดงสถานะห้องฉุกเฉิน')).toBeInTheDocument()
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/er/status?mode=tv')

    // Surnames should be stripped, keeping title + first name
    expect(screen.getByText('นายสมมติ')).toBeInTheDocument()
    expect(screen.queryByText('นามสกุลปลอม')).not.toBeInTheDocument()
    expect(screen.getByText('นางสาวตัวอย่าง')).toBeInTheDocument()

    // Sorting: Level 1 (นายสมมติ) must come before Level 3 (นางสาวตัวอย่าง)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('นายสมมติ')
    expect(rows[2]).toHaveTextContent('นางสาวตัวอย่าง')

    // Bed + Observe tags
    expect(screen.getByText('เตียง 2')).toBeInTheDocument()
    expect(screen.getByText('Observe')).toBeInTheDocument()
  })
})
