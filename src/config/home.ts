import { 
  HeartPulse, 
  Stethoscope, 
  Smile, 
  Leaf, 
  BedDouble, 
  Baby,
  LucideIcon
} from 'lucide-react';

export interface ServiceItem {
  title: string;
  desc: string;
  icon: LucideIcon;
  link?: string;
}

export interface RelatedOrgItem {
  name: string;
  url?: string;
}

export const services: ServiceItem[] = [
  {
    title: 'โปรแกรมตรวจสุขภาพ รู้ผลได้ใน 1 วัน',
    desc: 'บริการตรวจสุขภาพประจำปี ตรวจวิเคราะห์รวดเร็ว แม่นยำ และทราบผลการตรวจภายในวันเดียว',
    icon: HeartPulse,
    link: '/package/health-check-1day'
  },
  {
    title: 'คลินิกเฉพาะทาง',
    desc: 'ตรวจรักษาโดยแพทย์ผู้เชี่ยวชาญเฉพาะทางหลากหลายสาขา ครอบคลุมโรคเฉพาะโรค',
    icon: Stethoscope
  },
  {
    title: 'ทันตกรรม',
    desc: 'บริการทันตกรรมครบวงจร ดูแลสุขภาพฟัน ขูดหินปูน อุดฟัน ถอนฟัน และทันตกรรมเด็ก',
    icon: Smile,
    link: '/package/dentistry'
  },
  {
    title: 'แพทย์แผนไทย',
    desc: 'บริการนวดรักษา ประคบสมุนไพร อบไอน้ำสมุนไพร และการฟื้นฟูสุขภาพด้วยศาสตร์แพทย์แผนไทย',
    icon: Leaf
  },
  {
    title: 'อัตราการบริการห้องพิเศษ',
    desc: 'ข้อมูลค่าบริการห้องพักพิเศษ สิ่งอำนวยความสะดวกครบครัน และการดูแลระดับพรีเมียม',
    icon: BedDouble,
    link: '/package/vip-room'
  },
  {
    title: 'สูตินรีเวชกรรม',
    desc: 'บริการดูแลคุณแม่ตั้งครรภ์ ฝากครรภ์ คลอดบุตร และตรวจรักษาโรคทางนรีเวชอย่างอบอุ่นและปลอดภัย',
    icon: Baby,
    link: '/package/childbirth'
  },
];

export const relatedOrgs: RelatedOrgItem[] = [
  { name: 'สสจ.ลำปาง', url: 'https://www.lpho.go.th/' },
  { name: 'สสอ.เถิน', url: 'https://www.thoenhealth.go.th/index.php' },
  { name: 'รพ.มะเร็งลำปาง', url: 'https://www.lpch.go.th/lpch/' },
  { name: 'รพ.ศูนย์ลำปาง', url: 'https://www.lph.go.th/lpweb/' },
  { name: 'รพ.เกาะคา', url: 'https://www.kokhahospital.go.th/' },
  { name: 'รพ.งาว', url: 'https://www.ngaohospital.com/' },
  { name: 'รพ.แจ้ห่ม', url: 'https://chaehomlampang.wordpress.com/' },
  { name: 'รพ.เมืองปาน', url: 'https://muangpan.moph.go.th/newsportal/' },
  { name: 'รพ.แม่ทะ', url: 'https://maethahospital.com/' },
  { name: 'รพ.แม่พริก', url: 'http://61.19.35.172/webmaeprik/' },
  { name: 'รพ.แม่เมาะ', url: 'https://www.maemohhospital.go.th/maemohhospital/index.php' },
  { name: 'รพ.วังเหนือ', url: 'http://www.wangnueahospital.com/' },
  { name: 'รพ.สบปราบ', url: 'https://www.sopprabhospital.go.th/' },
  { name: 'รพ.เสริมงาม', url: 'http://www.soemngamhospital.go.th/index.php?page=intro&language=th' },
  { name: 'รพ.ห้างฉัตร', url: 'https://www.hangchathospital.com/' },
];
