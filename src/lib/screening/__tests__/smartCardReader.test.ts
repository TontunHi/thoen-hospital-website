import { describe, it, expect } from 'vitest'
import {
  decodeTis620,
  parseThaiCardName,
  parseThaiCardAddress,
  parseThaiIdBirthDate,
  generateMockCardData,
} from '../smartCardReader'

describe('Smart Card Reader Utilities', () => {
  describe('decodeTis620', () => {
    it('decodes ASCII and handles empty or null bytes', () => {
      const bytes = [0x41, 0x42, 0x43, 0x00] // "ABC\0"
      expect(decodeTis620(bytes)).toBe('ABC')
    })

    it('decodes Thai characters correctly', () => {
      // "ไทย" in TIS-620: ไ = 0xe4, ท = 0xb7, ย = 0xc2
      const thaiBytes = [0xe4, 0xb7, 0xc2]
      const decoded = decodeTis620(thaiBytes)
      expect(decoded).toBe('ไทย')
    })
  })

  describe('parseThaiCardName', () => {
    it('parses title, first name, and last name from hash-separated string', () => {
      const raw = 'นาย#สมศักดิ์##ใจดี#'
      const parsed = parseThaiCardName(raw)
      expect(parsed.title).toBe('นาย')
      expect(parsed.firstName).toBe('สมศักดิ์')
      expect(parsed.lastName).toBe('ใจดี')
      expect(parsed.fullName).toBe('นาย สมศักดิ์ ใจดี')
    })

    it('handles middle name if present', () => {
      const raw = 'นาย#สมศักดิ์#ณ ลำปาง#ใจดี#'
      const parsed = parseThaiCardName(raw)
      expect(parsed.firstName).toBe('สมศักดิ์ ณ ลำปาง')
      expect(parsed.lastName).toBe('ใจดี')
    })
  })

  describe('parseThaiCardAddress', () => {
    it('parses address parts into clean readable string', () => {
      const raw = '99/1#หมู่ที่ 2#ซอย 3#ถนนพหลโยธิน#ตำบลล้อมแรด#อำเภอเถิน#จังหวัดลำปาง'
      const addr = parseThaiCardAddress(raw)
      expect(addr).toBe('99/1 หมู่ที่ 2 ซอย 3 ถนนพหลโยธิน ตำบลล้อมแรด อำเภอเถิน จังหวัดลำปาง')
    })
  })

  describe('parseThaiIdBirthDate', () => {
    it('converts YYYYMMDD into YYYY-MM-DD', () => {
      expect(parseThaiIdBirthDate('25350820')).toBe('2535-08-20')
    })
  })

  describe('generateMockCardData', () => {
    it('generates valid mock card data with 13-digit CID and rawPayload', () => {
      const mock = generateMockCardData()
      expect(mock.cid).toMatch(/^\d{13}$/)
      expect(mock.fullNameTh).toBeTruthy()
      expect(mock.address).toBeTruthy()
      expect(mock.rawPayload).toBeDefined()
      expect(mock.rawPayload.source).toBe('MOCK_SIMULATION')
    })
  })
})
