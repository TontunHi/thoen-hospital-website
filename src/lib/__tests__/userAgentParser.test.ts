import { describe, it, expect } from 'vitest'
import { parseUserAgent } from '../userAgentParser'

describe('parseUserAgent', () => {
  it('handles empty or null user agent', () => {
    expect(parseUserAgent(null).deviceType).toBe('unknown')
    expect(parseUserAgent('').deviceType).toBe('unknown')
  })

  it('correctly parses Windows Desktop with Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    const result = parseUserAgent(ua)
    expect(result.deviceType).toBe('desktop')
    expect(result.os).toBe('Windows 10/11')
    expect(result.browser).toBe('Chrome 122')
    expect(result.displayShort).toContain('Windows 10/11 • Chrome 122')
  })

  it('correctly parses Windows Desktop with Edge', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.2365.92'
    const result = parseUserAgent(ua)
    expect(result.deviceType).toBe('desktop')
    expect(result.os).toBe('Windows 10/11')
    expect(result.browser).toBe('Edge 122')
  })

  it('correctly parses iPhone Mobile with Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
    const result = parseUserAgent(ua)
    expect(result.deviceType).toBe('mobile')
    expect(result.deviceModel).toBe('iPhone')
    expect(result.os).toBe('iOS 17.4')
    expect(result.browser).toBe('Safari 17')
    expect(result.displayShort).toContain('📱 iPhone • Safari 17')
  })

  it('correctly parses iPad Tablet', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
    const result = parseUserAgent(ua)
    expect(result.deviceType).toBe('tablet')
    expect(result.deviceModel).toBe('iPad')
    expect(result.os).toBe('iOS 16.5')
  })

  it('correctly parses Android Samsung Mobile with Chrome', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.178 Mobile Safari/537.36'
    const result = parseUserAgent(ua)
    expect(result.deviceType).toBe('mobile')
    expect(result.deviceModel).toBe('Samsung')
    expect(result.os).toBe('Android 14')
    expect(result.browser).toBe('Chrome 121')
  })

  it('detects bots/crawlers', () => {
    const ua = 'Googlebot/2.1 (+http://www.google.com/bot.html)'
    const result = parseUserAgent(ua)
    expect(result.deviceType).toBe('bot')
    expect(result.browser).toBe('Googlebot')
  })
})
