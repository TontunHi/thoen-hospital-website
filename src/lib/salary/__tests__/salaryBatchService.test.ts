import { describe, it, expect, vi } from 'vitest'
import {
  SalaryBatchService,
  decodeBuffer,
  parseCSV,
  formatNumericValue,
  parseAndFormatDate,
  SalaryDbExecutor,
} from '../salaryBatchService'

describe('SalaryBatchService', () => {
  describe('decodeBuffer', () => {
    it('decodes standard UTF-8 buffer correctly', () => {
      const buf = Buffer.from('เงินเดือน,ค่าเวร,30 กันยายน 2569', 'utf8')
      expect(decodeBuffer(buf)).toBe('เงินเดือน,ค่าเวร,30 กันยายน 2569')
    })
  })

  describe('parseCSV', () => {
    it('parses comma-separated values handling quotes and trim correctly', () => {
      const csv = `c1,c2,c3\n"2026-09-30","นายสมชาย ใจดี","15,000.00"\n"2026-09-30","นางสาวทดสอบ, งานพยาบาล","20,000.00"`
      const rows = parseCSV(csv)
      expect(rows).toHaveLength(3)
      expect(rows[1]).toEqual(['2026-09-30', 'นายสมชาย ใจดี', '15,000.00'])
      expect(rows[2]).toEqual(['2026-09-30', 'นางสาวทดสอบ, งานพยาบาล', '20,000.00'])
    })
  })

  describe('formatNumericValue', () => {
    it('expands scientific notation 13-digit citizen IDs accurately', () => {
      // e.g. Excel export of citizen ID: 1.529900112233E+12
      const formatted = formatNumericValue('1.529900112233E+12')
      expect(formatted).toBe('1529900112233')
    })

    it('formats normal monetary numbers to 2 decimal places', () => {
      expect(formatNumericValue('15000')).toBe('15,000.00')
      expect(formatNumericValue('2450.5')).toBe('2,450.50')
    })

    it('preserves 10-digit bank account strings', () => {
      expect(formatNumericValue('5240123456')).toBe('5240123456')
    })
  })

  describe('parseAndFormatDate', () => {
    it('converts Buddhist Era d/m/yyyy dates to CE ISO dates', () => {
      expect(parseAndFormatDate('30/9/2569')).toBe('2026-09-30')
      expect(parseAndFormatDate('05-01-2569')).toBe('2026-01-05')
    })

    it('retains existing ISO dates untouched', () => {
      expect(parseAndFormatDate('2026-09-30')).toBe('2026-09-30')
    })
  })

  describe('SalaryBatchService batch operations', () => {
    it('parses batch buffer and normalizes 30-column rows', () => {
      const csv = `c1,c2,c3,c4\n30/09/2569,1.529900112233E+12,นายสมชาย,15000`
      const buffer = Buffer.from(csv, 'utf8')
      const batch = SalaryBatchService.parseBatchBuffer(buffer, 'salary')

      expect(batch.type).toBe('salary')
      expect(batch.tableName).toBe('salary')
      expect(batch.totalCount).toBe(1)
      expect(batch.rows[0]).toHaveLength(30)
      expect(batch.rows[0][0]).toBe('2026-09-30')
      expect(batch.rows[0][1]).toBe('1529900112233')
      expect(batch.rows[0][2]).toBe('นายสมชาย')
      expect(batch.rows[0][3]).toBe('15,000.00')
    })

    it('ingests parsed batch through executor', async () => {
      const mockExecutor: SalaryDbExecutor = vi.fn().mockResolvedValue({ affectedRows: 1 })
      const batch = {
        type: 'salary' as const,
        tableName: 'salary' as const,
        rows: [Array(30).fill('')],
        totalCount: 1,
      }

      const result = await SalaryBatchService.ingestBatch(batch, mockExecutor)
      expect(result.insertedCount).toBe(1)
      expect(mockExecutor).toHaveBeenCalledTimes(1)
    })

    it('gets latest batch summary and executes atomic deletion', async () => {
      const mockExecutor: SalaryDbExecutor = vi.fn().mockImplementation((sql: string) => {
        if (sql.includes('ORDER BY id DESC')) {
          return Promise.resolve([{ latest_date: '2026-09-30' }])
        }
        if (sql.includes('COUNT(*)')) {
          return Promise.resolve([{ total_count: 50 }])
        }
        if (sql.includes('DELETE FROM')) {
          return Promise.resolve({ affectedRows: 50 })
        }
        return Promise.resolve([])
      })

      const summary = await SalaryBatchService.getLatestBatchSummary('salary', mockExecutor)
      expect(summary).toEqual({
        tableName: 'salary',
        date: '2026-09-30',
        count: 50,
      })

      const delResult = await SalaryBatchService.deleteLatestBatch(
        {
          type: 'salary',
          confirmedDate: '2026-09-30',
          user: { username: 'finance_admin' },
        },
        mockExecutor
      )

      expect(delResult.success).toBe(true)
      expect(delResult.deletedCount).toBe(50)
      expect(delResult.deletedDate).toBe('2026-09-30')
    })
  })
})
