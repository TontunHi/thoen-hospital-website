import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  RcmT1dmGdmPdmService,
  type T1dmGdmPdmReportParams,
} from '../rcmT1dmGdmPdmService'
import { invalidateCacheKey } from '@/lib/cache'

describe('RcmT1dmGdmPdmService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCacheKey('rcm-t1dm-gdm-pdm-recipients-2026-10-01-2027-09-30')
  })

  const mockRows = [
    {
      vn: '691001000001',
      hn: '0011111',
      cid: '1529900011111',
      ptname: 'นาง สุภาวรรณ ใจงาม',
      sex_code: '2',
      birthday: '1998-04-12',
      age: 28,
      nation: 'ไทย',
      tel: '0812345678',
      ok: 'Y',
      type: 'GDM',
      regdate: '2026-10-05',
      vstdate: '2026-10-10',
      vsttime: '08:45:00',
      lmp: '2026-03-01',
      authencode: 'AUTH001',
      pttypename_patient: 'ประกันสุขภาพถ้วนหน้า',
      pttypename_visit: 'ประกันสุขภาพถ้วนหน้า',
      maininscl: 'UCS',
      department: 'ห้องตรวจสูตินรีเวชกรรม',
      clinic: 'สูตินรีเวชกรรม',
      pdx: 'O244',
      dx0: 'Z340',
      dx1: null,
      dx2: null,
      dx3: null,
      dx4: null,
      dx5: null,
      op0: '8876',
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      status: 'มี Rep แล้ว',
      rep: 'REP-T1DM-01',
      compensated: 2400,
      fund: 'O24',
      subfund: 'GDM',
    },
    {
      vn: '691002000002',
      hn: '0022222',
      cid: '1529900022222',
      ptname: 'นางสาว ดวงใจ ศรีสุข',
      sex_code: '2',
      birthday: '1995-09-20',
      age: 31,
      nation: 'ไทย',
      tel: '0898765432',
      ok: null,
      type: null,
      regdate: null,
      vstdate: '2026-10-15',
      vsttime: '09:30:00',
      lmp: '2026-04-15',
      authencode: null,
      pttypename_patient: 'จ่ายเงินเอง',
      pttypename_visit: 'จ่ายเงินเอง',
      maininscl: 'PAY',
      department: 'ห้องตรวจสูตินรีเวชกรรม',
      clinic: 'สูตินรีเวชกรรม',
      pdx: 'O240',
      dx0: null,
      dx1: null,
      dx2: null,
      dx3: null,
      dx4: null,
      dx5: null,
      op0: null,
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      status: 'รอส่งเบิก',
      rep: null,
      compensated: 0,
      fund: null,
      subfund: null,
    },
    {
      vn: '691003000003',
      hn: '0033333',
      cid: '1529900033333',
      ptname: 'นาง นิตยา มั่นคง',
      sex_code: '2',
      birthday: '1990-11-05',
      age: 36,
      nation: 'ไทย',
      tel: '0861112233',
      ok: 'Y',
      type: 'T1DM',
      regdate: '2026-08-01',
      vstdate: '2026-11-02',
      vsttime: '10:00:00',
      lmp: '2026-05-10',
      authencode: 'AUTH002',
      pttypename_patient: 'ข้าราชการ กรมบัญชีกลาง',
      pttypename_visit: 'ข้าราชการ กรมบัญชีกลาง',
      maininscl: 'OFC',
      department: 'ห้องตรวจสูตินรีเวชกรรม',
      clinic: 'สูตินรีเวชกรรม',
      pdx: 'O240',
      dx0: 'E109',
      dx1: null,
      dx2: null,
      dx3: null,
      dx4: null,
      dx5: null,
      op0: null,
      op1: null,
      op2: null,
      op3: null,
      op4: null,
      op5: null,
      status: 'มี Rep แล้ว',
      rep: 'REP-T1DM-02',
      compensated: 1800,
      fund: 'O24',
      subfund: 'T1DM',
    },
  ]

  it('aggregates T1DM/GDM/PDM service recipients and computes summary correctly', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const params: T1dmGdmPdmReportParams = {
      startDate: '2026-10-01',
      endDate: '2027-09-30',
      page: 1,
      pageSize: 50,
    }

    const res = await RcmT1dmGdmPdmService.getRecipientsReport(params, mockExecutor)

    expect(res.totalCount).toBe(3)
    expect(res.summary.totalCases).toBe(3)
    expect(res.summary.uniquePatients).toBe(3)
    expect(res.summary.registeredCases).toBe(2)
    expect(res.summary.notRegisteredCases).toBe(1)
    expect(res.summary.compensatedCases).toBe(2)
    expect(res.summary.totalCompensated).toBe(4200)
    expect(res.summary.withAuthenCases).toBe(2)
    expect(res.summary.noAuthenCases).toBe(1)
    expect(res.summary.ucCases).toBe(1)

    // Check item details
    const item1 = res.items.find((i) => i.vn === '691001000001')
    expect(item1).toBeDefined()
    expect(item1?.isRegistered).toBe(true)
    expect(item1?.type).toBe('GDM')
    expect(item1?.pdx).toBe('O244')
    expect(item1?.allDx).toContain('O244')
    expect(item1?.allDx).toContain('Z340')
    expect(item1?.allOp).toContain('8876')
    expect(item1?.isCompensated).toBe(true)
    expect(item1?.isUc).toBe(true)
  })

  it('filters by cardFilter REGISTERED', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const res = await RcmT1dmGdmPdmService.getRecipientsReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        cardFilter: 'REGISTERED',
      },
      mockExecutor
    )

    expect(res.totalCount).toBe(2)
    expect(res.items.every((i) => i.isRegistered)).toBe(true)
  })

  it('filters by cardFilter UNCOMPENSATED', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const res = await RcmT1dmGdmPdmService.getRecipientsReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        cardFilter: 'UNCOMPENSATED',
      },
      mockExecutor
    )

    expect(res.totalCount).toBe(1)
    expect(res.items[0].hn).toBe('0022222')
    expect(res.items[0].isCompensated).toBe(false)
  })

  it('filters by cardFilter UC_ONLY', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const res = await RcmT1dmGdmPdmService.getRecipientsReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        cardFilter: 'UC_ONLY',
      },
      mockExecutor
    )

    expect(res.totalCount).toBe(1)
    expect(res.items[0].hn).toBe('0011111')
    expect(res.items[0].isUc).toBe(true)
  })

  it('filters by global search term', async () => {
    const mockExecutor = vi.fn().mockResolvedValue(mockRows)

    const res = await RcmT1dmGdmPdmService.getRecipientsReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        search: 'นิตยา',
      },
      mockExecutor
    )

    expect(res.totalCount).toBe(1)
    expect(res.items[0].hn).toBe('0033333')
  })

  it('falls back gracefully if rcmdb.t1dm table does not exist', async () => {
    const mockExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error("Table 'rcmdb.t1dm' doesn't exist"))
      .mockResolvedValueOnce([
        {
          ...mockRows[1],
        },
      ])

    const res = await RcmT1dmGdmPdmService.getRecipientsReport(
      {
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        refresh: true,
      },
      mockExecutor
    )

    expect(mockExecutor).toHaveBeenCalledTimes(2)
    expect(res.totalCount).toBe(1)
    expect(res.items[0].isRegistered).toBe(false)
  })
})
