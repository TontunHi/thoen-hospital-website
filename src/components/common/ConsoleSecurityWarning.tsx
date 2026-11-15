'use client'

import { useEffect } from 'react'

export const CONSOLE_WARNING_SHOWN_KEY = Symbol.for('thoen.consoleSecurityWarningShown')

/**
 * Logs a one-time Self-XSS warning to the browser developer console.
 * Guards against duplicate logs from React StrictMode double-mounts or client navigation.
 */
export function printConsoleSecurityWarning(): void {
  const globalRecord = globalThis as Record<symbol, boolean>
  if (globalRecord[CONSOLE_WARNING_SHOWN_KEY]) return
  globalRecord[CONSOLE_WARNING_SHOWN_KEY] = true

  console.log(
    '%cหยุดก่อน! (STOP!)',
    'color: #dc2626; font-size: 32px; font-weight: 800; text-shadow: 0 1px 0 #00000033;'
  )
  console.log(
    '%cนี่คือฟีเจอร์ของเบราว์เซอร์สำหรับนักพัฒนา หากมีใครบอกให้คุณคัดลอกและวางโค้ดลงในหน้าต่างนี้ อาจเป็นกลโกง (Self-XSS) เพื่อขโมยข้อมูลหรือสิทธิ์การเข้าถึงบัญชีโรงพยาบาลเถินของคุณ\n\nThis is a browser feature intended for developers. If someone told you to copy-paste something here, it may be a Self-XSS attack to steal your account or sensitive hospital data.',
    'font-size: 14px; font-weight: 500; line-height: 1.6;'
  )
}

export default function ConsoleSecurityWarning() {
  useEffect(() => {
    printConsoleSecurityWarning()
  }, [])

  return null
}
