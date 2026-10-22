import { describe, it, expect } from 'vitest'
import {
  formatThaiDateTime,
  buildScreeningExcelWorkbook,
  ScreeningExportItem,
} from '../exportScreeningExcel'

describe('exportScreeningExcel utility', () => {
  describe('formatThaiDateTime', () => {
    it('formats ISO date into Thai Buddhist calendar format with time', () => {
      // 2026-10-22T08:30:00+07:00
      const formatted = formatThaiDateTime('2026-10-22T08:30:00+07:00')
      expect(formatted).toContain('22/10/2569')
      expect(formatted).toContain('08:30 น.')
    })

    it('handles falsy or invalid input gracefully', () => {
      expect(formatThaiDateTime('')).toBe('-')
      expect(formatThaiDateTime(null as any)).toBe('-')
    })
  })

  describe('buildScreeningExcelWorkbook', () => {
    const mockItems: ScreeningExportItem[] = [
      {
        id: 1,
        cid: '0500123456789', // Note leading zero
        fullName: 'นายสมชาย ใจดี',
        createdAt: '2026-10-22T08:30:00+07:00',
        status: 'VISIT_OPENED',
      },
      {
        id: 2,
        cid: '1529900987654',
        fullName: 'นางสาววิภา พัฒนา',
        createdAt: '2026-10-22T09:15:00+07:00',
        status: 'WAITING',
      },
    ]

    it('generates worksheet with exactly 3 specified data columns', async () => {
      const workbook = await buildScreeningExcelWorkbook(mockItems, {
        selectedDate: '2026-10-22',
        statusFilter: 'ALL',
      })

      const worksheet = workbook.getWorksheet('รายชื่อผู้รับบริการ')
      expect(worksheet).toBeDefined()

      // Header row (Row 4)
      const headerRow = worksheet!.getRow(4)
      expect(headerRow.getCell(1).value).toBe('วันที่รับบริการ')
      expect(headerRow.getCell(2).value).toBe('เลขบัตรประชาชน')
      expect(headerRow.getCell(3).value).toBe('ชื่อ - สกุล')
      expect(headerRow.getCell(4).value).toBeNull()

      // Row 5: First patient
      const row1 = worksheet!.getRow(5)
      expect(row1.getCell(1).value).toContain('22/10/2569')
      // CID must retain leading zero and text format
      expect(row1.getCell(2).value).toBe('0500123456789')
      expect(row1.getCell(2).numFmt).toBe('@')
      expect(row1.getCell(3).value).toBe('นายสมชาย ใจดี')

      // Row 6: Second patient
      const row2 = worksheet!.getRow(6)
      expect(row2.getCell(1).value).toContain('22/10/2569')
      expect(row2.getCell(2).value).toBe('1529900987654')
      expect(row2.getCell(3).value).toBe('นางสาววิภา พัฒนา')
    })

    it('sets column widths and freeze panes appropriately', async () => {
      const workbook = await buildScreeningExcelWorkbook(mockItems, {
        selectedDate: 'today',
        statusFilter: 'VISIT_OPENED',
      })

      const worksheet = workbook.getWorksheet('รายชื่อผู้รับบริการ')
      expect(worksheet!.columns?.length).toBe(3)
      expect((worksheet!.views[0] as any).ySplit).toBe(4) // Frozen top 4 rows
    })
  })
})
