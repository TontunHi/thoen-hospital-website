import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import SystemsClientView from './SystemsClientView'

export const metadata: Metadata = {
  title: 'ระบบสารสนเทศ',
  description: 'ศูนย์รวมระบบสารสนเทศสาธารณสุข กระทรวงสาธารณสุข (MOPH) และแดชบอร์ดสารสนเทศทางการแพทย์ โรงพยาบาลเถิน จังหวัดลำปาง',
  openGraph: {
    title: `ระบบสารสนเทศ | ${siteConfig.name}`,
    description: 'ศูนย์รวมระบบสารสนเทศสาธารณสุข MOPH และแดชบอร์ดสารสนเทศ โรงพยาบาลเถิน',
  },
}

export default function SystemsPage() {
  return <SystemsClientView />
}
