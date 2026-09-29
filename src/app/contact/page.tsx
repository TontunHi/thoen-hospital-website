import type { Metadata } from 'next'
import { siteConfig } from '@/config/site'
import ContactClientView from './ContactClientView'

export const metadata: Metadata = {
  title: 'ติดต่อเรา',
  description: 'ช่องทางการติดต่อ โรงพยาบาลเถิน จังหวัดลำปาง หมายเลขโทรศัพท์ แผนที่นำทาง และแบบฟอร์มรับเรื่องร้องเรียน/ข้อเสนอแนะ',
  openGraph: {
    title: `ติดต่อเรา | ${siteConfig.name}`,
    description: 'ช่องทางการติดต่อ โรงพยาบาลเถิน จังหวัดลำปาง แผนที่นำทาง หมายเลขโทรศัพท์ฉุกเฉิน',
  },
}

export default function ContactPage() {
  const contactJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalOrganization',
    name: siteConfig.name,
    url: `${siteConfig.url}/contact`,
    telephone: siteConfig.contact.hospitalPhone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '159 หมู่ 7 ถนนพหลโยธิน ตำบลล้อมแรด',
      addressLocality: 'อำเภอเถิน',
      addressRegion: 'จังหวัดลำปาง',
      postalCode: '52160',
      addressCountry: 'TH',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: String(siteConfig.contact.coordinates.latitude),
      longitude: String(siteConfig.contact.coordinates.longitude),
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: siteConfig.contact.hospitalPhone,
        contactType: 'customer service',
        availableLanguage: ['Thai', 'English'],
      },
      {
        '@type': 'ContactPoint',
        telephone: siteConfig.contact.emergencyPhone,
        contactType: 'emergency',
        availableLanguage: ['Thai'],
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }}
      />
      <ContactClientView />
    </>
  )
}
