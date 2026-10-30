import { Metadata } from 'next'
import OrganizationPublicClient from './OrganizationPublicClient'
import './page.css'

export const metadata: Metadata = {
  title: 'โครงสร้างกลุ่มงานและบุคลากร | โรงพยาบาลเถิน',
  description: 'โครงสร้างองค์กร แผนผังกลุ่มงาน และบุคลากรผู้ให้บริการโรงพยาบาลเถิน อำเภอเถิน จังหวัดลำปาง',
}

export default function OrganizationPage() {
  return <OrganizationPublicClient />
}
