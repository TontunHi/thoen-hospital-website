import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cleanCellValue,
  detectColumnStyle,
  buildRcmExcelWorkbook,
  exportRcmExcel,
} from '../rcmExcelExport'

describe('rcmExcelExport', () => {
  describe('cleanCellValue', () => {
    it('handles null, undefined, numbers, booleans', () => {
      expect(cleanCellValue(null)).toBe('')
      expect(cleanCellValue(undefined)).toBe('')
      expect(cleanCellValue(123)).toBe(123)
      expect(cleanCellValue(true)).toBe(true)
    })

    it('strips CSV formula wrappers like ="12345"', () => {
      expect(cleanCellValue('="000123"')).toBe('000123')
      expect(cleanCellValue('="681010105235"')).toBe('681010105235')
    })

    it('strips outer quotes and handles unescaped quotes', () => {
      expect(cleanCellValue('"นาย สมชาย ใจดี"')).toBe('นาย สมชาย ใจดี')
      expect(cleanCellValue('"คำว่า ""ทดสอบ"""')).toBe('คำว่า "ทดสอบ"')
    })

    it('strips leading single quote used in CSV injection guards', () => {
      expect(cleanCellValue("'=SUM(A1:A10)")).toBe('=SUM(A1:A10)')
      expect(cleanCellValue("'+cmd|'")).toBe('+cmd|')
    })
  })

  describe('detectColumnStyle', () => {
    it('detects text format for CID, HN, VN, AN, Rep', () => {
      expect(detectColumnStyle('เลขบัตรประชาชน (CID)').numFmt).toBe('@')
      expect(detectColumnStyle('HN').alignment).toBe('center')
      expect(detectColumnStyle('VN').numFmt).toBe('@')
      expect(detectColumnStyle('AN').numFmt).toBe('@')
      expect(detectColumnStyle('เลข REP').alignment).toBe('center')
    })

    it('detects currency format for financial columns', () => {
      const style = detectColumnStyle('ค่ารักษา (บาท)')
      expect(style.numFmt).toBe('#,##0.00')
      expect(style.alignment).toBe('right')
    })

    it('detects integer count format for visits and patients', () => {
      const style = detectColumnStyle('จำนวนครั้ง (VN)')
      expect(style.numFmt).toBe('#,##0')
      expect(style.alignment).toBe('right')
    })
  })

  describe('buildRcmExcelWorkbook', () => {
    it('builds workbook with styled header, title, data rows, and frozen panes', async () => {
      const wb = await buildRcmExcelWorkbook({
        filename: 'test.xlsx',
        title: 'รายงานผู้ป่วยทดสอบ',
        subtitle: 'ช่วงวันที่ 1 ต.ค. 2568 ถึง 30 ก.ย. 2569',
        headers: ['ลำดับ', 'HN', 'เลขประจำตัวประชาชน', 'ชื่อ-สกุล', 'ค่ารักษา (บาท)'],
        rows: [
          [1, '0000063', '1520100012345', 'นาย ทดสอบ หนึ่ง', 1500.5],
          [2, '0000064', '1520100012346', 'นาง ทดสอบ สอง', '2,400.00'],
        ],
        summaryRows: [['', '', '', 'รวมทั้งหมด', 3900.5]],
      })

      expect(wb).toBeDefined()
      const ws = wb.getWorksheet(1)
      expect(ws).toBeDefined()

      // Should have rows: Title, Subtitle, empty, Headers, 2 data rows, 1 summary row
      expect(ws?.rowCount).toBe(7)

      // Title row
      expect(ws?.getCell(1, 1).value).toBe('รายงานผู้ป่วยทดสอบ')

      // Header row
      expect(ws?.getCell(4, 1).value).toBe('ลำดับ')
      expect(ws?.getCell(4, 2).value).toBe('HN')

      // CID cell preserves string
      const cidCell = ws?.getCell(5, 3)
      expect(cidCell?.value).toBe('1520100012345')

      // Currency cell
      const moneyCell = ws?.getCell(5, 5)
      expect(moneyCell?.value).toBe(1500.5)

      // Parsed currency from string
      const moneyCell2 = ws?.getCell(6, 5)
      expect(moneyCell2?.value).toBe(2400)
    })
  })

  describe('exportRcmExcel', () => {
    beforeEach(() => {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        configurable: true,
        value: vi.fn(() => 'blob:test-url'),
      })
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        configurable: true,
        value: vi.fn(),
      })
    })

    it('triggers download and renames .csv to .xlsx', async () => {
      let clicked = false
      let downloadedName = ''

      const origCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName)
        if (tagName === 'a') {
          el.click = () => {
            clicked = true
            downloadedName = el.getAttribute('download') || ''
          }
        }
        return el
      })

      await exportRcmExcel({
        filename: 'report_sample.csv',
        headers: ['ลำดับ', 'ชื่อ'],
        rows: [[1, 'ทดสอบ']],
      })

      expect(clicked).toBe(true)
      expect(downloadedName).toBe('report_sample.xlsx')
    })
  })
})
