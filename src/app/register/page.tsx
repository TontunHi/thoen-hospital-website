import type { Metadata } from 'next'
import RegisterClientView from './RegisterClientView'

// หน้านี้ไม่ลิงก์จากที่ใดในเว็บ และไม่ให้เครื่องมือค้นหาเก็บ
// ไม่ใส่ใน robots.txt เพราะการ disallow จะเปิดเผย URL นี้
export const metadata: Metadata = {
  title: 'ลงทะเบียนบุคลากร',
  robots: { index: false, follow: false, nocache: true },
}

export default function RegisterPage() {
  return <RegisterClientView />
}
