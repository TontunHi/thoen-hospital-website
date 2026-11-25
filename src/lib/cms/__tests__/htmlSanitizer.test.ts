import { describe, it, expect } from 'vitest'
import { sanitizeRichHtml } from '../htmlSanitizer'

describe('sanitizeRichHtml', () => {
  it('strips script tags and inline event handlers while keeping safe formatting', () => {
    const dirty =
      '<p>ประกาศ <strong>โรงพยาบาลเถิน</strong></p>' +
      '<script>alert("xss")</script>' +
      '<img src="https://example.com/pic.jpg" onerror="alert(1)" alt="pic" />'

    const clean = sanitizeRichHtml(dirty)

    expect(clean).toContain('<p>ประกาศ <strong>โรงพยาบาลเถิน</strong></p>')
    expect(clean).toContain('<img src="https://example.com/pic.jpg" alt="pic" />')
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('alert(')
    expect(clean).not.toContain('onerror')
  })

  it('strips javascript: URLs from links and enforces rel="noopener noreferrer" on target="_blank"', () => {
    const dirty =
      '<a href="javascript:alert(1)">bad</a>' +
      '<a href="https://thlp.moph.go.th" target="_blank">good</a>'

    const clean = sanitizeRichHtml(dirty)

    expect(clean).not.toContain('javascript:')
    expect(clean).toContain('href="https://thlp.moph.go.th"')
    expect(clean).toContain('rel="noopener noreferrer"')
  })

  it('preserves safe editor inline styles and strips unsafe CSS expressions', () => {
    const dirty =
      '<span style="font-size: 18px; color: #1e293b; background-image: url(javascript:alert(1))">ข้อความ</span>'

    const clean = sanitizeRichHtml(dirty)

    expect(clean).toContain('font-size:18px')
    expect(clean).toContain('color:#1e293b')
    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('background-image')
  })
})
