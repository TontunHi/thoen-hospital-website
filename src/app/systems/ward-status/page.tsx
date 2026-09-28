import WardStatusPublicClient from './WardStatusPublicClient'

export const metadata = {
  title: 'สถานะผู้ป่วยนอนรักษาพยาบาล (IPD Status) | โรงพยาบาลเถิน',
  description: 'ระบบติดตามจำนวนผู้ป่วยครองเตียงในแต่ละหอผู้ป่วยแบบเรียลไทม์ โรงพยาบาลเถิน',
}

export default function WardStatusPublicPage() {
  return <WardStatusPublicClient />
}
