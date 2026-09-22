export interface ParsedUserAgent {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'
  os: string
  browser: string
  deviceModel?: string
  displayShort: string
}

/**
 * Parses a raw User-Agent header into structured, human-readable client information.
 * Lightweight, zero-dependency, and safe for both server and client components.
 */
export function parseUserAgent(uaString: string | null | undefined): ParsedUserAgent {
  if (!uaString || typeof uaString !== 'string' || uaString.trim() === '') {
    return {
      deviceType: 'unknown',
      os: 'ไม่ระบุ OS',
      browser: 'ไม่ระบุเบราว์เซอร์',
      displayShort: 'ไม่ทราบอุปกรณ์'
    }
  }

  const ua = uaString.trim()

  // 1. Detect Bots / Automated Crawlers
  if (/bot|crawler|spider|curl|wget|postman|insomnia|headless/i.test(ua)) {
    let botName = 'Bot / Script'
    if (/googlebot/i.test(ua)) botName = 'Googlebot'
    else if (/bingbot/i.test(ua)) botName = 'Bingbot'
    else if (/curl/i.test(ua)) botName = 'cURL'
    else if (/postman/i.test(ua)) botName = 'Postman'
    return {
      deviceType: 'bot',
      os: 'Automated Agent',
      browser: botName,
      displayShort: `🤖 ${botName}`
    }
  }

  // 2. Detect Device Type & Model
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop'
  let deviceModel: string | undefined

  if (/ipad/i.test(ua) || (/macintosh/i.test(ua) && typeof navigator !== 'undefined' && (navigator as any)?.maxTouchPoints > 1)) {
    deviceType = 'tablet'
    deviceModel = 'iPad'
  } else if (/tablet|playbook|silk/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) {
    deviceType = 'tablet'
  } else if (/iphone/i.test(ua)) {
    deviceType = 'mobile'
    deviceModel = 'iPhone'
  } else if (/ipod/i.test(ua)) {
    deviceType = 'mobile'
    deviceModel = 'iPod'
  } else if (/android.*mobile/i.test(ua) || /mobile/i.test(ua)) {
    deviceType = 'mobile'
  }

  // Extract common phone brands if Android
  if (deviceType === 'mobile' && !deviceModel) {
    if (/samsung|sm-[a-z0-9]+/i.test(ua)) deviceModel = 'Samsung'
    else if (/huawei|honor/i.test(ua)) deviceModel = 'Huawei'
    else if (/xiaomi|redmi|mi\s/i.test(ua)) deviceModel = 'Xiaomi'
    else if (/oppo/i.test(ua)) deviceModel = 'OPPO'
    else if (/vivo/i.test(ua)) deviceModel = 'vivo'
    else if (/pixel/i.test(ua)) deviceModel = 'Google Pixel'
    else deviceModel = 'Android Phone'
  }

  // 3. Detect Operating System (OS)
  let os = 'Unknown OS'
  if (/windows nt 10\.0/i.test(ua)) {
    // Note: Windows 11 also uses NT 10.0 in standard UA strings
    os = 'Windows 10/11'
  } else if (/windows nt 6\.3/i.test(ua)) {
    os = 'Windows 8.1'
  } else if (/windows nt 6\.2/i.test(ua)) {
    os = 'Windows 8'
  } else if (/windows nt 6\.1/i.test(ua)) {
    os = 'Windows 7'
  } else if (/windows/i.test(ua)) {
    os = 'Windows'
  } else if (/iphone os\s([\d_]+)/i.test(ua) || /cpu os\s([\d_]+)/i.test(ua)) {
    const match = ua.match(/(?:iphone os|cpu os)\s([\d_]+)/i)
    const ver = match ? match[1].replace(/_/g, '.') : ''
    os = ver ? `iOS ${ver}` : 'iOS'
  } else if (/mac os x\s([\d_]+)/i.test(ua)) {
    const match = ua.match(/mac os x\s([\d_]+)/i)
    const ver = match ? match[1].replace(/_/g, '.') : ''
    os = ver ? `macOS ${ver}` : 'macOS'
  } else if (/android\s([\d.]+)/i.test(ua)) {
    const match = ua.match(/android\s([\d.]+)/i)
    os = match ? `Android ${match[1]}` : 'Android'
  } else if (/cros/i.test(ua)) {
    os = 'ChromeOS'
  } else if (/linux/i.test(ua)) {
    os = 'Linux'
  }

  // 4. Detect Browser & Major Version
  let browser = 'Unknown Browser'
  let browserMatch: RegExpMatchArray | null = null

  if ((browserMatch = ua.match(/edg(?:e|a|ios)?\/([\d.]+)/i))) {
    browser = `Edge ${browserMatch[1].split('.')[0]}`
  } else if ((browserMatch = ua.match(/(?:opera|opr)\/([\d.]+)/i))) {
    browser = `Opera ${browserMatch[1].split('.')[0]}`
  } else if ((browserMatch = ua.match(/line\/([\d.]+)/i))) {
    browser = 'LINE In-App'
  } else if ((browserMatch = ua.match(/fbav\/([\d.]+)/i))) {
    browser = 'Facebook In-App'
  } else if ((browserMatch = ua.match(/chrome\/([\d.]+)/i)) && !/chromium|edg/i.test(ua)) {
    browser = `Chrome ${browserMatch[1].split('.')[0]}`
  } else if ((browserMatch = ua.match(/version\/([\d.]+).*safari/i))) {
    browser = `Safari ${browserMatch[1].split('.')[0]}`
  } else if ((browserMatch = ua.match(/firefox\/([\d.]+)/i))) {
    browser = `Firefox ${browserMatch[1].split('.')[0]}`
  } else if (/safari/i.test(ua) && !/chrome|chromium/i.test(ua)) {
    browser = 'Safari'
  }

  // 5. Friendly Display Text
  const icon = deviceType === 'mobile' ? '📱' : deviceType === 'tablet' ? '📟' : '💻'
  const devicePart = deviceModel || os
  const displayShort = `${icon} ${devicePart} • ${browser}`

  return {
    deviceType,
    os,
    browser,
    deviceModel,
    displayShort
  }
}
