import StatusOrClient from './StatusOrClient'

export const metadata = {
  title: 'สถานะการให้บริการห้องผ่าตัด (OR Live Status) | โรงพยาบาลเถิน',
  description: 'ระบบแสดงผลสถานะห้องผ่าตัดประจำวัน โรงพยาบาลเถิน (รอผ่าตัด / กำลังผ่าตัด / พักฟื้น)',
}

export default function StatusOrPage() {
  return <StatusOrClient />
}
