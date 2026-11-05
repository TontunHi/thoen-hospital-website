import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import EOfficeStatusClient from './EOfficeStatusClient'

export const metadata: Metadata = {
  title: 'Dashboard สถานะการใช้งานระบบ E-office สป.สธ. (ส่วนภูมิภาค)',
  description:
    'รายงานสรุปสถานะการใช้งานระบบสารบรรณอิเล็กทรอนิกส์ (E-office) ของหน่วยงานในสังกัด สป.สธ. (ส่วนภูมิภาค) โดยศูนย์เทคโนโลยีสารสนเทศและการสื่อสาร (ศทส.) กระทรวงสาธารณสุข',
  openGraph: {
    title: `Dashboard สถานะการใช้งานระบบ E-office สป.สธ. | ${siteConfig.name}`,
    description:
      'รายงานสรุปสถานะการใช้งานระบบสารบรรณอิเล็กทรอนิกส์ (E-office) ของหน่วยงานในสังกัด สป.สธ. (ส่วนภูมิภาค)',
  },
}

export default function EOfficeStatusPage() {
  return <EOfficeStatusClient />
}
