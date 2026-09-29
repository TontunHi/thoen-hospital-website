/**
 * Site Configuration for Thoen Hospital Website
 * Centralized settings for hospital metadata, features, and UI toggles.
 */

export const siteConfig = {
  name: 'โรงพยาบาลเถิน',
  englishName: 'Thoen Hospital',
  province: 'จังหวัดลำปาง',
  tagline: 'บริการด้วยน้ำใจ เพื่อความปลอดภัยของทุกคน',
  description: 'โรงพยาบาลเถิน จังหวัดลำปาง ให้บริการด้านสุขภาพอย่างครบวงจร ด้วยทีมแพทย์และบุคลากรที่มีคุณภาพ พร้อมดูแลสุขภาพของประชาชนในพื้นที่อำเภอเถินและใกล้เคียง',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  
  // UI Features and Flags
  features: {
    // Flag to show/hide mourning ribbon on the navbar (D7 in upgrade.md)
    showMourningRibbon: true,
  },

  // Contact & Emergency Information
  contact: {
    emergencyPhone: '1669',
    hospitalPhone: '054-291568',
    fax: '054-291569',
    email: 'thoenhospital@gmail.com',
    facebook: 'https://www.facebook.com/thoenhospital',
    facebookName: 'โรงพยาบาลเถิน',
    address: '159 หมู่ 7 ถนนพหลโยธิน ตำบลล้อมแรด อำเภอเถิน จังหวัดลำปาง 52160',
    coordinates: {
      latitude: 17.618683,
      longitude: 99.219808,
    },
    googleMapsUrl: 'https://maps.app.goo.gl/GbH8tpsfqjM54yUR6',
  },

  // Service Hours
  hours: {
    emergency: 'เปิดให้บริการตลอด 24 ชั่วโมง ทุกวัน',
    opd: 'วันจันทร์ - ศุกร์ 08.00 - 16.00 น. (เว้นวันหยุดราชการ)',
    specialClinic: 'ตามตารางนัดหมายแพทย์เฉพาะทาง',
    traditionalMedicine: 'วันจันทร์ - ศุกร์ 08.30 - 16.30 น.',
    dentistry: 'วันจันทร์ - ศุกร์ 08.00 - 16.00 น.',
  },
}
