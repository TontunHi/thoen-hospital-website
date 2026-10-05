import { describe, it, expect } from 'vitest'
import {
  formatMaskedCitizenId,
  renderOtpEmailHtml,
  renderOtpEmailText,
} from '../otpEmailTemplate'

describe('otpEmailTemplate', () => {
  describe('formatMaskedCitizenId', () => {
    it('returns "-" for empty or missing citizen ID', () => {
      expect(formatMaskedCitizenId('')).toBe('-')
    })

    it('masks 13-digit Thai National ID to show only the last 4 digits per PDPA', () => {
      const masked = formatMaskedCitizenId('1234567890123')
      expect(masked).toBe('x-xxxx-xxxxx-01-23')
    })

    it('masks non-13 digit long strings correctly', () => {
      const masked = formatMaskedCitizenId('admin123456')
      expect(masked).toBe('•••••••3456')
    })
  })

  describe('renderOtpEmailHtml', () => {
    it('renders beautiful HTML with prominent OTP code and recipient name', () => {
      const html = renderOtpEmailHtml({
        otp: '849201',
        username: '1234567890123',
        name: 'นายสมชาย ใจดี',
        expiryMinutes: 5,
      })

      // Must contain the prominent OTP code
      expect(html).toContain('849201')
      // Must contain recipient name
      expect(html).toContain('นายสมชาย ใจดี')
      // Must contain masked ID
      expect(html).toContain('x-xxxx-xxxxx-01-23')
      // Must contain validity info
      expect(html).toContain('5 นาที')
      // Must contain hospital name
      expect(html).toContain('โรงพยาบาลเถิน')
      // Must contain security notice
      expect(html).toContain('ห้ามเปิดเผยรหัส OTP ให้แก่ผู้อื่นทราบโดยเด็ดขาด')
      // Must contain copy hint
      expect(html).toContain('Ready to Copy')
    })

    it('renders fallback display name when name is not provided', () => {
      const html = renderOtpEmailHtml({
        otp: '654321',
        username: '1234567890123',
      })

      expect(html).toContain('654321')
      expect(html).toContain('x-xxxx-xxxxx-01-23')
    })
  })

  describe('renderOtpEmailText', () => {
    it('renders clean plain text with OTP box and details', () => {
      const text = renderOtpEmailText({
        otp: '849201',
        username: '1234567890123',
        name: 'นายสมชาย ใจดี',
        expiryMinutes: 5,
      })

      expect(text).toContain('849201')
      expect(text).toContain('นายสมชาย ใจดี')
      expect(text).toContain('5 นาที')
      expect(text).toContain('โรงพยาบาลเถิน')
      expect(text).toContain('054-291316-8')
    })
  })
})
