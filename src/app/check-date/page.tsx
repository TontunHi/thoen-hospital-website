import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import CheckDateClientView from './CheckDateClientView'

export const metadata: Metadata = {
  title: 'ตรวจสอบตารางนัดหมายแพทย์',
  description: 'บริการตรวจสอบวันและเวลานัดหมายแพทย์ โรงพยาบาลเถิน จังหวัดลำปาง สะดวก รวดเร็ว ด้วยเลขประจำตัวประชาชน 13 หลัก',
  openGraph: {
    title: `ตรวจสอบตารางนัดหมายแพทย์ | ${siteConfig.name}`,
    description: 'บริการตรวจสอบวันและเวลานัดหมายแพทย์ โรงพยาบาลเถิน จังหวัดลำปาง สะดวก รวดเร็ว',
  },
}

export default function CheckDatePage() {
  return <CheckDateClientView />
}
