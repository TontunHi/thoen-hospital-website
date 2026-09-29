import { getAuthenticatedMember } from '@/lib/memberAuth'
import UploadSalaryClient from './UploadSalaryClient'

export const metadata = {
  title: 'นำเข้าข้อมูลการเงิน | โรงพยาบาลเถิน',
  description: 'ระบบอัปโหลดไฟล์เอกสารเงินเดือนและค่าตอบแทน โรงพยาบาลเถิน',
}

export default async function UploadSalaryPage() {
  await getAuthenticatedMember({
    requiredPermission: 'upload_salary',
    redirectTo: '/unauthorized',
  })

  return <UploadSalaryClient />
}

