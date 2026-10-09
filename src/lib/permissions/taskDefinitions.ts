export type PermRoleType = 'view' | 'edit' | 'approve' | 'manage'

export interface TaskRoleConfig {
  roleType: PermRoleType
  label: string
  shortLabel: string
  description: string
  permissionKey: string
  allowedActions: string[]
}

export interface TaskDefinition {
  id: string
  name: string
  shortName: string
  category: 'workflow' | 'system'
  categoryLabel: string
  description: string
  iconName: string
  badgeColor: string
  roles: TaskRoleConfig[]
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  // ==========================================
  // 1. Workflow Tasks (งานบริการ & กล่องงาน)
  // ==========================================
  {
    id: 'MEDIA_REQUEST',
    name: 'งานขอสื่อประชาสัมพันธ์',
    shortName: 'งานขอสื่อ',
    category: 'workflow',
    categoryLabel: 'งานบริการ & กล่องงาน',
    description: 'คำขอผลิตสื่อกราฟิก ออกแบบ วิดีโอ ไวนิล และประชาสัมพันธ์ของโรงพยาบาล',
    iconName: 'Palette',
    badgeColor: '#8b5cf6',
    roles: [
      {
        roleType: 'view',
        label: 'ผู้ดูคำขอสื่อทั้งหมด (View)',
        shortLabel: 'ดูงานสื่อทั้งหมด',
        description: 'สามารถเปิดดูและติดตามคำขอผลิตสื่อทั้งหมดในระบบ',
        permissionKey: 'view_media_requests',
        allowedActions: ['เปิดดูรายละเอียดคำขอสื่อทั้งหมด', 'ติดตามสถานะการผลิต'],
      },
      {
        roleType: 'edit',
        label: 'ผู้ผลิตสื่อ / กราฟิก (Produce / Edit)',
        shortLabel: 'ผู้ผลิตสื่อ (รับงาน)',
        description: 'ทีมผู้ผลิตสื่อ สามารถกดรับงาน ผลิตสื่อ แนบไฟล์ผลงาน และส่งมอบงาน',
        permissionKey: 'produce_media',
        allowedActions: ['กดรับงานผลิตสื่อ', 'อัปโหลดไฟล์ผลงาน', 'บันทึกความคืบหน้า', 'ส่งมอบงาน'],
      },
      {
        roleType: 'approve',
        label: 'ผู้อนุมัติคำขอผลิตสื่อ (Approve)',
        shortLabel: 'ผู้อนุมัติคำขอสื่อ',
        description: 'ผู้บริหารหรือหัวหน้างานที่มีอำนาจพิจารณาอนุมัติคำขอผลิตสื่อ',
        permissionKey: 'approve_media',
        allowedActions: ['ลงนามอนุมัติคำขอผลิตสื่อ', 'ส่งกลับแก้ไข (Send Back)', 'ตรวจรับงาน'],
      },
      {
        roleType: 'manage',
        label: 'ผู้ดูแลระบบงานสื่อ (Manage)',
        shortLabel: 'หัวหน้างานสื่อ/ดูแลระบบ',
        description: 'หัวหน้างานสื่อและประชาสัมพันธ์ มอบหมายงาน จัดการขั้นตอน และดูแลภาพรวม',
        permissionKey: 'manage_media_requests',
        allowedActions: ['มอบหมายผู้รับผิดชอบ', 'แก้ไขข้อมูลคำขอ', 'ยกเลิก/ระงับงาน', 'ดูรายงานสถิติ'],
      },
    ],
  },
  {
    id: 'IT_REPAIR',
    name: 'งานแจ้งซ่อมคอมพิวเตอร์และสารสนเทศ',
    shortName: 'งานซ่อมไอที',
    category: 'workflow',
    categoryLabel: 'งานบริการ & กล่องงาน',
    description: 'งานแจ้งซ่อมเครื่องคอมพิวเตอร์ ระบบเครือข่าย ปริ้นเตอร์ และซอฟต์แวร์โรงพยาบาล',
    iconName: 'Monitor',
    badgeColor: '#0284c7',
    roles: [
      {
        roleType: 'view',
        label: 'ผู้ดูงานซ่อมไอทีทั้งหมด (View)',
        shortLabel: 'ดูงานซ่อมไอที',
        description: 'สามารถดูและติดตามรายการแจ้งซ่อมไอทีทั้งหมดในระบบ',
        permissionKey: 'view_it_repairs',
        allowedActions: ['เปิดดูรายการแจ้งซ่อมไอทีทั้งหมด', 'ติดตามสถานะการซ่อม'],
      },
      {
        roleType: 'edit',
        label: 'ช่างซ่อมคอมพิวเตอร์ / ไอที (Technician)',
        shortLabel: 'ช่างไอที (รับงาน)',
        description: 'เจ้าหน้าที่ศูนย์คอมพิวเตอร์ กดรับงาน บันทึกผลซ่อม และประเมินค่าใช้จ่าย',
        permissionKey: 'take_repairs_it',
        allowedActions: ['กดรับงานซ่อมไอที', 'บันทึกอาการที่พบและวิธีแก้', 'ระบุช่างร่วม', 'บันทึกผลสำเร็จ'],
      },
      {
        roleType: 'approve',
        label: 'ผู้อนุมัติ/ตรวจรับงานซ่อม (Approve)',
        shortLabel: 'อนุมัติ/ตรวจรับงานซ่อม',
        description: 'ผู้บริหารหรือหัวหน้างานในการอนุมัติและตรวจรับงานซ่อมบำรุง',
        permissionKey: 'approve_repairs',
        allowedActions: ['ลงนามตรวจรับงานซ่อม', 'ส่งกลับแก้ไข'],
      },
      {
        roleType: 'manage',
        label: 'หัวหน้าช่าง / ดูแลระบบงานซ่อม (Manage)',
        shortLabel: 'หัวหน้าช่าง/ดูแลระบบซ่อม',
        description: 'หัวหน้าทีมช่าง มอบหมายงาน ตรวจสอบการส่งซ่อมภายนอก และบริหารจัดการงานซ่อม',
        permissionKey: 'manage_repairs',
        allowedActions: ['มอบหมายช่างผู้รับผิดชอบ', 'แก้ไขรายการแจ้งซ่อม', 'บันทึกส่งซ่อมภายนอก', 'ดูสถิติงานซ่อม'],
      },
    ],
  },
  {
    id: 'GENERAL_REPAIR',
    name: 'งานแจ้งซ่อมบำรุงทั่วไป / งานช่าง',
    shortName: 'งานซ่อมทั่วไป',
    category: 'workflow',
    categoryLabel: 'งานบริการ & กล่องงาน',
    description: 'งานแจ้งซ่อมอาคารสถานที่ ไฟฟ้า ประปา แอร์ สุขภัณฑ์ และงานช่างบำรุงรักษาทั่วไป',
    iconName: 'Wrench',
    badgeColor: '#d97706',
    roles: [
      {
        roleType: 'view',
        label: 'ผู้ดูงานซ่อมบำรุงทั่วไปทั้งหมด (View)',
        shortLabel: 'ดูงานซ่อมทั่วไป',
        description: 'สามารถดูและติดตามรายการแจ้งซ่อมงานช่างทั่วไปทั้งหมดในระบบ',
        permissionKey: 'view_general_repairs',
        allowedActions: ['เปิดดูรายการแจ้งซ่อมทั่วไปทั้งหมด', 'ติดตามสถานะการซ่อม'],
      },
      {
        roleType: 'edit',
        label: 'ช่างซ่อมบำรุงทั่วไป (Technician)',
        shortLabel: 'ช่างทั่วไป (รับงาน)',
        description: 'ทีมช่างซ่อมบำรุงทั่วไป กดรับงาน ดำเนินการซ่อม และบันทึกผลการซ่อม',
        permissionKey: 'take_repairs_general',
        allowedActions: ['กดรับงานซ่อมทั่วไป', 'บันทึกการใช้อะไหล่/ค่าใช้จ่าย', 'ระบุช่างร่วม', 'ปิดงานซ่อม'],
      },
      {
        roleType: 'approve',
        label: 'ผู้อนุมัติ/ตรวจรับงานซ่อม (Approve)',
        shortLabel: 'อนุมัติ/ตรวจรับงานซ่อม',
        description: 'ผู้บริหารหรือหัวหน้างานในการอนุมัติและตรวจรับงานซ่อมบำรุง',
        permissionKey: 'approve_repairs',
        allowedActions: ['ลงนามตรวจรับงานซ่อม', 'ส่งกลับแก้ไข'],
      },
      {
        roleType: 'manage',
        label: 'หัวหน้าช่าง / ดูแลระบบงานซ่อม (Manage)',
        shortLabel: 'หัวหน้าช่าง/ดูแลระบบซ่อม',
        description: 'หัวหน้าทีมช่าง มอบหมายงาน ตรวจสอบการส่งซ่อมภายนอก และบริหารจัดการงานซ่อม',
        permissionKey: 'manage_repairs',
        allowedActions: ['มอบหมายช่างผู้รับผิดชอบ', 'แก้ไขรายการแจ้งซ่อม', 'บันทึกส่งซ่อมภายนอก', 'ดูสถิติงานซ่อม'],
      },
    ],
  },
  {
    id: 'MEDICAL_REPAIR',
    name: 'งานแจ้งซ่อมเครื่องมือทางการแพทย์',
    shortName: 'งานซ่อมเครื่องมือแพทย์',
    category: 'workflow',
    categoryLabel: 'งานบริการ & กล่องงาน',
    description: 'งานแจ้งซ่อมและสอบเทียบเครื่องมือแพทย์ อุปกรณ์ทางการแพทย์ และเครื่องช่วยชีวิต',
    iconName: 'HeartPulse',
    badgeColor: '#e11d48',
    roles: [
      {
        roleType: 'view',
        label: 'ผู้ดูงานซ่อมเครื่องมือแพทย์ทั้งหมด (View)',
        shortLabel: 'ดูงานเครื่องมือแพทย์',
        description: 'สามารถดูและติดตามรายการแจ้งซ่อมเครื่องมือทางการแพทย์ทั้งหมดในระบบ',
        permissionKey: 'view_medical_repairs',
        allowedActions: ['เปิดดูรายการแจ้งซ่อมเครื่องมือแพทย์ทั้งหมด', 'ติดตามสถานะการซ่อม'],
      },
      {
        roleType: 'edit',
        label: 'ช่าง / ผู้รับผิดชอบเครื่องมือแพทย์ (Technician)',
        shortLabel: 'ช่างแพทย์ (รับงาน)',
        description: 'ผู้รับผิดชอบเครื่องมือแพทย์ กดรับงาน ตรวจสอบอาการ และบันทึกผลการซ่อมบำรุง',
        permissionKey: 'take_repairs_medical',
        allowedActions: ['กดรับงานซ่อมเครื่องมือแพทย์', 'บันทึกผลการตรวจสอบ/สอบเทียบ', 'บันทึกส่งซ่อมบริษัท', 'ปิดงาน'],
      },
      {
        roleType: 'approve',
        label: 'ผู้อนุมัติ/ตรวจรับงานซ่อม (Approve)',
        shortLabel: 'อนุมัติ/ตรวจรับงานซ่อม',
        description: 'ผู้บริหารหรือหัวหน้างานในการอนุมัติและตรวจรับงานซ่อมบำรุง',
        permissionKey: 'approve_repairs',
        allowedActions: ['ลงนามตรวจรับงานซ่อม', 'ส่งกลับแก้ไข'],
      },
      {
        roleType: 'manage',
        label: 'หัวหน้าช่าง / ดูแลระบบงานซ่อม (Manage)',
        shortLabel: 'หัวหน้าช่าง/ดูแลระบบซ่อม',
        description: 'หัวหน้าทีมช่าง มอบหมายงาน ตรวจสอบการส่งซ่อมภายนอก และบริหารจัดการงานซ่อม',
        permissionKey: 'manage_repairs',
        allowedActions: ['มอบหมายช่างผู้รับผิดชอบ', 'แก้ไขรายการแจ้งซ่อม', 'บันทึกส่งซ่อมภายนอก', 'ดูสถิติงานซ่อม'],
      },
    ],
  },
  {
    id: 'INBOX_CENTRAL',
    name: 'กล่องงานกลาง & ภาพรวมงานบริการ',
    shortName: 'กล่องงานกลาง',
    category: 'workflow',
    categoryLabel: 'งานบริการ & กล่องงาน',
    description: 'ระบบกล่องงานส่วนกลาง การติดตามสถานะเอกสารข้ามหน่วยงาน และสายการบังคับบัญชา',
    iconName: 'Inbox',
    badgeColor: '#059669',
    roles: [
      {
        roleType: 'view',
        label: 'ผู้ดูภาพรวมงานทั้งหมดในโรงพยาบาล (View All)',
        shortLabel: 'ดูงานทั้งหมดใน รพ.',
        description: 'สิทธิ์ดูและติดตามงานช่างและภารกิจทุกประเภทในระบบแบบอ่านอย่างเดียว',
        permissionKey: 'view_all_work',
        allowedActions: ['เปิดดูกล่องงานและรายการงานทั้งหมดของโรงพยาบาล'],
      },
      {
        roleType: 'view',
        label: 'ผู้ดูงานทั้งหมดในหน่วยงานตนเอง (View Dept)',
        shortLabel: 'ดูงานในหน่วยงาน',
        description: 'สิทธิ์ดูงานทุกประเภทที่สร้างโดยสมาชิกในกลุ่มงานหรือหน่วยงานเดียวกัน',
        permissionKey: 'view_department_tasks',
        allowedActions: ['เปิดดูรายการงานทั้งหมดที่สร้างโดยสมาชิกในหน่วยงานเดียวกัน'],
      },
      {
        roleType: 'manage',
        label: 'ผู้ดูแลระบบกล่องงานกลางและสายอนุมัติ (Manage)',
        shortLabel: 'ดูแลกล่องงานกลาง',
        description: 'ผู้ดูแลระบบกล่องงานกลาง ตรวจสอบและติดตามขั้นตอนงานและสถานะเอกสารทั้งหมด',
        permissionKey: 'manage_inbox',
        allowedActions: ['แก้ไขข้อมูลงานในกล่องงาน', 'ข้ามขั้นตอน/ส่งต่อสายอนุมัติ', 'ดูประวัติ Audit Log งาน'],
      },
    ],
  },

  // ==========================================
  // 2. System & Governance Modules (ระบบบริหาร & กำกับดูแล)
  // ==========================================
  {
    id: 'SALARY',
    name: 'งานสลิปเงินเดือนและค่าตอบแทน',
    shortName: 'สลิปเงินเดือน',
    category: 'system',
    categoryLabel: 'ระบบบริหาร & กำกับดูแล',
    description: 'ระบบตรวจสอบและอัปโหลดไฟล์สลิปเงินเดือน ค่าตอบแทน และภาษีของบุคลากรโรงพยาบาล',
    iconName: 'Coins',
    badgeColor: '#d97706',
    roles: [
      {
        roleType: 'view',
        label: 'ผู้ดูสลิปเงินเดือนบุคลากรทุกคน (View All Salary)',
        shortLabel: 'ดูสลิปเงินเดือนทุกคน',
        description: 'เจ้าหน้าที่ฝ่ายบุคคลหรือผู้บริหารที่ได้รับอนุญาตตรวจสอบข้อมูลเงินเดือนรวมของ รพ.',
        permissionKey: 'view_all_salary',
        allowedActions: ['เปิดดูและค้นหาสลิปเงินเดือนของบุคลากรทุกคน', 'ตรวจสอบข้อมูลภาษีและค่าตอบแทน'],
      },
      {
        roleType: 'edit',
        label: 'ผู้อัปโหลดเงินเดือน / ค่าตอบแทน (Upload Salary)',
        shortLabel: 'อัปโหลดสลิปเงินเดือน',
        description: 'เจ้าหน้าที่การเงินในการนำเข้าและอัปโหลดไฟล์ข้อมูลเงินเดือนเข้าสู่ระบบฐานข้อมูล',
        permissionKey: 'upload_salary',
        allowedActions: ['อัปโหลดไฟล์ Excel/CSV เงินเดือนประจำเดือน', 'ตรวจสอบความถูกต้องก่อนบันทึก'],
      },
    ],
  },
  {
    id: 'FACILITY_ASSET',
    name: 'งานพัสดุ ครุภัณฑ์ และสถานที่',
    shortName: 'พัสดุ & สถานที่',
    category: 'system',
    categoryLabel: 'ระบบบริหาร & กำกับดูแล',
    description: 'ระบบจัดการฐานข้อมูลสถานที่ ตึก-ชั้น-ห้อง และระบบทะเบียนทรัพย์สินครุภัณฑ์ของโรงพยาบาล',
    iconName: 'Package',
    badgeColor: '#0284c7',
    roles: [
      {
        roleType: 'edit',
        label: 'ผู้จัดการข้อมูลสถานที่ ตึก-ชั้น-ห้อง (Manage Locations)',
        shortLabel: 'จัดการสถานที่ ตึก-ชั้น',
        description: 'เจ้าหน้าที่ดูแลข้อมูลอาคารสถานที่ ตึก ชั้น และห้อง สำหรับผูกกับระบบแจ้งซ่อมและครุภัณฑ์',
        permissionKey: 'manage_locations',
        allowedActions: ['เพิ่ม/แก้ไข/ลบ ข้อมูลตึก ชั้น และห้อง', 'ปรับปรุงสถานะการใช้งานห้อง'],
      },
      {
        roleType: 'manage',
        label: 'ผู้จัดการทะเบียนครุภัณฑ์และพัสดุ (Manage Assets)',
        shortLabel: 'จัดการทะเบียนครุภัณฑ์',
        description: 'เจ้าหน้าที่พัสดุในการจัดการข้อมูลครุภัณฑ์ ค้นหา นำเข้าข้อมูล และตรวจสอบสถานะประกัน',
        permissionKey: 'manage_assets',
        allowedActions: ['เพิ่ม/แก้ไข/ลบ ทะเบียนครุภัณฑ์', 'อัปเดตสถานะประกัน', 'ผูกสถานที่ติดตั้งกับ Gotowin'],
      },
    ],
  },
  {
    id: 'OUTGOING_DOC',
    name: 'งานสารบรรณและหนังสือส่งออก Online',
    shortName: 'หนังสือส่งออก',
    category: 'system',
    categoryLabel: 'ระบบบริหาร & กำกับดูแล',
    description: 'ระบบจัดการทะเบียนหนังสือส่งออกทางราชการ เชื่อมโยงกับ Google Sheets ประจำปีงบประมาณ',
    iconName: 'FileSpreadsheet',
    badgeColor: '#10b981',
    roles: [
      {
        roleType: 'manage',
        label: 'ผู้จัดการทะเบียนหนังสือส่งออก (Manage Outgoing Doc)',
        shortLabel: 'จัดการหนังสือส่งออก',
        description: 'เจ้าหน้าที่สารบรรณ/ธุรการ ในการเพิ่ม แก้ไข ลบ และจัดลำดับลิงก์ Google Sheets ประจำปี',
        permissionKey: 'manage_outgoing_doc',
        allowedActions: ['เพิ่มปีงบประมาณใหม่', 'แก้ไขลิงก์ Google Sheets', 'เปิด/ปิดการแสดงผลรายปี'],
      },
    ],
  },
  {
    id: 'ETHICS',
    name: 'งานชมรมจริยธรรมและส่งเสริมคุณธรรม',
    shortName: 'ชมรมจริยธรรม',
    category: 'system',
    categoryLabel: 'ระบบบริหาร & กำกับดูแล',
    description: 'ระบบจัดการเอกสาร แผนปฏิบัติการ คำสั่งแต่งตั้ง และรายงานผลการดำเนินงานชมรมจริยธรรม',
    iconName: 'Scale',
    badgeColor: '#4f46e5',
    roles: [
      {
        roleType: 'manage',
        label: 'ผู้จัดการเอกสารชมรมจริยธรรม (Manage Ethics)',
        shortLabel: 'จัดการชมรมจริยธรรม',
        description: 'คณะทำงานขับเคลื่อนชมรมจริยธรรม ในการเพิ่มปีงบประมาณ สร้างหัวข้อเอกสาร และอัปโหลดไฟล์ PDF',
        permissionKey: 'manage_ethics',
        allowedActions: ['เพิ่มปีงบประมาณ', 'เพิ่มหัวข้อและโฟลเดอร์เอกสาร', 'อัปโหลด/ลบไฟล์ PDF', 'จัดลำดับเอกสาร'],
      },
    ],
  },
  {
    id: 'ITA',
    name: 'งานประเมินคุณธรรมและความโปร่งใส (ITA)',
    shortName: 'ข้อมูล ITA',
    category: 'system',
    categoryLabel: 'ระบบบริหาร & กำกับดูแล',
    description: 'ระบบเขียน เผยแพร่บทความ และจัดเก็บข้อมูลการประเมินคุณธรรมและความโปร่งใสของโรงพยาบาล',
    iconName: 'BookOpen',
    badgeColor: '#7c3aed',
    roles: [
      {
        roleType: 'manage',
        label: 'ผู้จัดการบทความและข้อมูล ITA (Manage ITA)',
        shortLabel: 'จัดการบทความ & ITA',
        description: 'ผู้รับผิดชอบงาน ITA ในการเขียน แก้ไข และเผยแพร่บทความหน้าเว็บไซต์',
        permissionKey: 'manage_ita',
        allowedActions: ['เขียนบทความใหม่', 'แก้ไขบทความ ITA', 'เผยแพร่และจัดเก็บเอกสารประกอบ'],
      },
    ],
  },
  {
    id: 'RDU',
    name: 'งานการใช้ยาอย่างสมเหตุผล (RDU)',
    shortName: 'เอกสาร RDU',
    category: 'system',
    categoryLabel: 'ระบบบริหาร & กำกับดูแล',
    description: 'ระบบจัดการโฟลเดอร์ปีและอัปโหลดเอกสารรายงานการใช้ยาอย่างสมเหตุผลของโรงพยาบาล',
    iconName: 'Pill',
    badgeColor: '#0d9488',
    roles: [
      {
        roleType: 'manage',
        label: 'ผู้จัดการข้อมูลและเอกสาร RDU (Manage RDU)',
        shortLabel: 'จัดการเอกสาร RDU',
        description: 'ผู้รับผิดชอบงาน RDU ในการจัดการโฟลเดอร์ปีงบประมาณ และอัปโหลดไฟล์รายงาน PDF',
        permissionKey: 'manage_rdu',
        allowedActions: ['สร้างโฟลเดอร์ปีงบประมาณ', 'อัปโหลดไฟล์ PDF รายงาน', 'เปิด/ปิดการแสดงผลไฟล์'],
      },
    ],
  },
  {
    id: 'NEWS',
    name: 'งานข่าวสาร ประชาสัมพันธ์ และสไลด์หน้าเว็บ',
    shortName: 'ข่าว & สไลด์',
    category: 'system',
    categoryLabel: 'ระบบบริหาร & กำกับดูแล',
    description: 'ระบบเขียนข่าวประชาสัมพันธ์ ข่าวประกาศจัดซื้อจัดจ้าง และภาพแบนเนอร์สไลด์หน้าแรก',
    iconName: 'Newspaper',
    badgeColor: '#f43f5e',
    roles: [
      {
        roleType: 'manage',
        label: 'ผู้จัดการข่าวสารและสไลด์หน้าเว็บ (Manage News)',
        shortLabel: 'จัดการข่าวสารหน้าเว็บ',
        description: 'ทีมประชาสัมพันธ์สามารถเขียน แก้ไข เผยแพร่ข่าวสาร และจัดการภาพสไลด์หน้าเว็บไซต์',
        permissionKey: 'manage_news',
        allowedActions: ['เขียนข่าวประชาสัมพันธ์/จัดซื้อจัดจ้าง', 'อัปโหลดภาพสไลด์หน้าแรก', 'แก้ไข/ลบข่าวสาร'],
      },
    ],
  },
]
