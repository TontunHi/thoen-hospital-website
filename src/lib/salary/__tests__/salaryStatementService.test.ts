import { describe, it, expect } from 'vitest'
import {
  parseSalaryAmount,
  getPeriodSortKey,
  buildStatementData
} from '../salaryStatementService'
import { generateStatementExcel } from '../statementExcelExporter'

describe('salaryStatementService', () => {
  describe('parseSalaryAmount', () => {
    it('handles numeric numbers correctly', () => {
      expect(parseSalaryAmount(12500.5)).toBe(12500.5)
      expect(parseSalaryAmount(0)).toBe(0)
    })

    it('handles strings with commas and whitespace', () => {
      expect(parseSalaryAmount(' 15,250.75 ')).toBe(15250.75)
      expect(parseSalaryAmount('1,000,000.00')).toBe(1000000)
    })

    it('handles null, undefined, and empty string', () => {
      expect(parseSalaryAmount(null)).toBe(0)
      expect(parseSalaryAmount(undefined)).toBe(0)
      expect(parseSalaryAmount('')).toBe(0)
      expect(parseSalaryAmount('-')).toBe(0)
    })
  })

  describe('getPeriodSortKey', () => {
    it('computes correct chronological sort keys for Thai periods', () => {
      const jan2567 = getPeriodSortKey('มกราคม', '2567')
      const feb2567 = getPeriodSortKey('กุมภาพันธ์', '2567')
      const dec2567 = getPeriodSortKey('ธันวาคม', '2567')
      const jan2568 = getPeriodSortKey('มกราคม', '2568')

      expect(feb2567).toBeGreaterThan(jan2567)
      expect(dec2567).toBeGreaterThan(feb2567)
      expect(jan2568).toBeGreaterThan(dec2567)
    })
  })

  describe('buildStatementData', () => {
    const mockMember = {
      id: 1,
      username: '1529900123456',
      name: 'นายสมชาย ใจดี',
      department: 'กลุ่มงานการพยาบาล',
      position: 'พยาบาลวิชาชีพปฏิบัติการ'
    }

    const mockSalaryRows = [
      {
        c1: '2024-01-25',
        c3: '012-3-45678-9',
        c4: 'นายสมชาย ใจดี',
        c5: '20000.00',
        c6: '0.00',
        c7: '0.00',
        c8: 'มกราคม 2567',
        c11: '20000.00',
        c12: '750.00',
        c25: '750.00',
        c26: '19250.00'
      },
      {
        c1: '2024-02-25',
        c3: '012-3-45678-9',
        c4: 'นายสมชาย ใจดี',
        c5: '20000.00',
        c6: '1000.00',
        c7: '0.00',
        c8: 'กุมภาพันธ์ 2567',
        c11: '21000.00',
        c12: '750.00',
        c25: '750.00',
        c26: '20250.00'
      },
      {
        c1: '2024-03-25',
        c3: '012-3-45678-9',
        c4: 'นายสมชาย ใจดี',
        c5: '20000.00',
        c6: '0.00',
        c7: '0.00',
        c8: 'มีนาคม 2567',
        c11: '20000.00',
        c12: '750.00',
        c25: '750.00',
        c26: '19250.00'
      }
    ]

    const mockOtRows = [
      {
        c1: '2024-01-28',
        c3: '012-3-45678-9',
        c4: 'นายสมชาย ใจดี',
        c5: '1000.00',
        c6: '4000.00',
        c7: '0.00',
        c8: '1500.00',
        c10: 'มกราคม',
        c15: '6500.00',
        c16: '325.00',
        c22: '325.00',
        c23: '6175.00'
      },
      {
        c1: '2024-02-28',
        c3: '012-3-45678-9',
        c4: 'นายสมชาย ใจดี',
        c5: '1000.00',
        c6: '3000.00',
        c7: '0.00',
        c8: '1500.00',
        c10: 'กุมภาพันธ์',
        c15: '5500.00',
        c16: '275.00',
        c22: '275.00',
        c23: '5225.00'
      }
    ]

    it('aggregates 1m range with single latest period', () => {
      const res = buildStatementData(mockMember, mockSalaryRows, mockOtRows, '1m')
      expect(res.range).toBe('1m')
      expect(res.records.length).toBe(1)
      expect(res.records[0].period).toBe('มีนาคม 2567')
      expect(res.records[0].salaryEarnings).toBe(20000)
      expect(res.records[0].hasSalary).toBe(true)
      expect(res.records[0].hasOt).toBe(false)
      expect(res.summary.periodCount).toBe(1)
      expect(res.summary.totalEarnings).toBe(20000)
      expect(res.summary.totalNetPay).toBe(19250)
    })

    it('aggregates 3m range with both salary and ot combined', () => {
      const res = buildStatementData(mockMember, mockSalaryRows, mockOtRows, '3m')
      expect(res.range).toBe('3m')
      expect(res.records.length).toBe(3)
      // Chronological order: มกราคม -> กุมภาพันธ์ -> มีนาคม
      expect(res.records[0].period).toBe('มกราคม 2567')
      expect(res.records[1].period).toBe('กุมภาพันธ์ 2567')
      expect(res.records[2].period).toBe('มีนาคม 2567')

      // January has both salary (20000) and ot (6500)
      expect(res.records[0].totalEarnings).toBe(26500)
      expect(res.records[0].totalDeductions).toBe(1075) // 750 + 325
      expect(res.records[0].netPay).toBe(25425)

      // Summary checks
      expect(res.summary.periodCount).toBe(3)
      expect(res.summary.fromPeriod).toBe('มกราคม 2567')
      expect(res.summary.toPeriod).toBe('มีนาคม 2567')
      expect(res.summary.totalEarnings).toBe(20000 + 21000 + 20000 + 6500 + 5500) // 73000
      expect(res.summary.avgMonthlyEarnings).toBe(Math.round((73000 / 3) * 100) / 100)

      // Transactions checks (itemized separate rows for income and deductions)
      expect(res.transactions).toBeDefined()
      expect(res.transactions.length).toBe(10) // Jan (4) + Feb (4) + Mar (2)
      
      // Jan Salary Income
      expect(res.transactions[0].type).toBe('salary')
      expect(res.transactions[0].details).toBe('รายรับ: เงินเดือนและค่าจ้างประจำงวด มกราคม 2567')
      expect(res.transactions[0].deposit).toBe(20000)
      expect(res.transactions[0].withdrawal).toBe(0)
      expect(res.transactions[0].balance).toBe(20000)

      // Jan Salary Deduction (separate row)
      expect(res.transactions[1].type).toBe('salary')
      expect(res.transactions[1].details).toBe('รายจ่าย: รายการหักเงินเดือนประจำงวด มกราคม 2567')
      expect(res.transactions[1].deposit).toBe(0)
      expect(res.transactions[1].withdrawal).toBe(750)
      expect(res.transactions[1].balance).toBe(19250)

      // Jan OT Income
      expect(res.transactions[2].type).toBe('ot')
      expect(res.transactions[2].details).toBe('รายรับ: ค่าตอบแทนและค่าล่วงเวลา (OT) ประจำงวด มกราคม 2567')
      expect(res.transactions[2].deposit).toBe(6500)
      expect(res.transactions[2].withdrawal).toBe(0)
      expect(res.transactions[2].balance).toBe(25750)

      // Jan OT Deduction (separate row)
      expect(res.transactions[3].type).toBe('ot')
      expect(res.transactions[3].details).toBe('รายจ่าย: รายการหักค่าตอบแทน/OT ประจำงวด มกราคม 2567')
      expect(res.transactions[3].deposit).toBe(0)
      expect(res.transactions[3].withdrawal).toBe(325)
      expect(res.transactions[3].balance).toBe(25425)

      // Range label without 'ย้อนหลัง'
      expect(res.rangeLabel).toBe('3 เดือน')
      expect(res.availablePeriods).toEqual(['มกราคม 2567', 'กุมภาพันธ์ 2567', 'มีนาคม 2567'])
    })

    it('filters records by custom fromPeriod and toPeriod', () => {
      const res = buildStatementData(mockMember, mockSalaryRows, mockOtRows, {
        range: 'custom',
        fromPeriod: 'มกราคม 2567',
        toPeriod: 'กุมภาพันธ์ 2567'
      })
      expect(res.range).toBe('custom')
      expect(res.records.length).toBe(2)
      expect(res.records[0].period).toBe('มกราคม 2567')
      expect(res.records[1].period).toBe('กุมภาพันธ์ 2567')
      expect(res.rangeLabel).toBe('มกราคม 2567 - กุมภาพันธ์ 2567')
    })

    it('handles fallback member when not registered in members table', () => {
      const unregisteredMember = {
        id: 0,
        username: '1529900999999',
        name: null,
        department: null,
        position: null
      }
      const res = buildStatementData(unregisteredMember, mockSalaryRows, mockOtRows, '1m')
      expect(res.member.name).toBe('นายสมชาย ใจดี')
      expect(res.member.username).toBe('1529900999999')
      expect(res.member.accountNumber).toBe('012-3-45678-9')
    })

    it('generates a valid excel workbook buffer without average row', async () => {
      const res = buildStatementData(mockMember, mockSalaryRows, mockOtRows, '3m')
      const buffer = await generateStatementExcel(res)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(1000)
    })
  })
})
