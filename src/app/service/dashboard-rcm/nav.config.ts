export interface NavPage {
  id: string
  label: string
  href: string
  badge?: string
  keywords?: string[]
  children?: NavPage[]
}

export interface NavModule {
  id: string
  code: string
  label: string
  href?: string
  badge?: string
  children?: NavPage[]
  keywords?: string[]
  requires?: string
}

export interface NavGroup {
  id: string
  title: string
  modules: NavModule[]
}

export const RCM_NAV_CONFIG: NavGroup[] = [
  {
    id: 'opd-dental',
    title: '2.1 ผู้ป่วยนอก & ทันตกรรม',
    modules: [
      {
        id: 'sss-dental',
        code: '2.1.1',
        label: 'ประกันสังคมทำฟัน',
        href: '/service/dashboard-rcm/sss-dental',
        keywords: ['ประกันสังคม', 'ทำฟัน', 'ทันตกรรม', '2.1.1.1'],
      },
      {
        id: 'opd-doctor',
        code: '2.1.2',
        label: 'OPD ตามสิทธิ์',
        href: '/service/dashboard-rcm/opd-doctor',
        keywords: ['opd', 'แพทย์', 'สิทธิ์', '2.1.1.2'],
      },
      {
        id: 'opd',
        code: '2.1.3',
        label: 'สรุปผู้ป่วยนอก (OPD)',
        href: '/service/dashboard-rcm/opd',
        keywords: ['opd', 'ผู้ป่วยนอก', '2.1.1.3'],
      },
    ],
  },
  {
    id: 'ipd',
    title: '2.2 บริการผู้ป่วยใน',
    modules: [
      {
        id: 'ipd',
        code: '2.2.1',
        label: 'สรุปผู้ป่วยใน (IPD)',
        href: '/service/dashboard-rcm/ipd',
        keywords: ['ipd', 'ผู้ป่วยใน', '2.1.2.1'],
      },
    ],
  },
  {
    id: 'rep-funds',
    title: '3.1 ข้อมูลการชดเชยค่าบริการ (REP)',
    modules: [
      {
        id: 'rep-funds',
        code: '3.1.1',
        label: 'ข้อมูล Rep แต่ละกองทุน',
        href: '/service/dashboard-rcm/rep-funds',
        keywords: ['rep', 'ชดเชย', 'กองทุน', '3.1.1'],
      },
    ],
  },
  {
    id: 'finance',
    title: '5.2 การเงิน & รายรับ',
    modules: [
      {
        id: 'invoice-summary',
        code: '5.2.2',
        label: 'สรุปรายรับจาก Invoice',
        href: '/service/dashboard-rcm/invoice-summary',
        keywords: ['invoice', 'รายรับ', 'การเงิน', '5.2.2.1'],
      },
    ],
  },
  {
    id: 'palliative-care',
    title: 'Palliative Care',
    modules: [
      {
        id: 'pc-1',
        code: 'PC.1',
        label: 'End Of Life',
        href: '/service/dashboard-rcm/palliative-care/pc-1',
        keywords: ['end of life', 'pc1', 'palliative', 'eol'],
      },
      {
        id: 'pc-3',
        code: 'PC.3',
        label: 'ตามกลุ่มโรค',
        href: '/service/dashboard-rcm/palliative-care/pc-3',
        keywords: ['pc3', 'กลุ่มโรค', 'palliative'],
      },
      {
        id: 'palliative-registry',
        code: 'REG',
        label: 'ทะเบียน Palliative Care',
        href: '/service/dashboard-rcm/palliative-care/registry',
        keywords: ['ทะเบียน', 'palliative', 'registry'],
      },
      {
        id: 'ltc-registry',
        code: 'LTC',
        label: 'ทะเบียน Long Term Care (LTC)',
        href: '/service/dashboard-rcm/palliative-care/ltc-registry',
        keywords: ['ltc', 'long term care', 'ระยะยาว'],
      },
    ],
  },
  {
    id: 'funds',
    title: 'กองทุน',
    modules: [
      {
        id: 'ccs',
        code: 'CCS',
        label: 'คัดกรองมะเร็งปากมดลูก',
        href: '/service/dashboard-rcm/funds/ccs',
        keywords: ['ccs', 'ปากมดลูก', 'มะเร็ง', '1b005'],
        children: [
          {
            id: 'ccs-2',
            badge: '1.2',
            label: 'รายชื่อผู้รับบริการคัดกรองมะเร็งปากมดลูก',
            href: '/service/dashboard-rcm/funds/ccs/2',
          },
          {
            id: 'ccs-10',
            badge: '1.10',
            label: 'บริการ 1B005',
            href: '/service/dashboard-rcm/funds/ccs/10',
            keywords: ['1b005'],
          },
        ],
      },
      {
        id: 'anc',
        code: 'ANC',
        label: 'บริการฝากครรภ์',
        href: '/service/dashboard-rcm/funds/anc',
        keywords: ['anc', 'ฝากครรภ์', 'ตั้งครรภ์', '30011'],
        children: [
          {
            id: 'anc-3',
            badge: '2.3',
            label: 'US - ตรวจช่องปาก - ขัดฟัน',
            href: '/service/dashboard-rcm/funds/anc/3',
          },
          {
            id: 'anc-4',
            badge: '2.4',
            label: 'บริการ 30011',
            href: '/service/dashboard-rcm/funds/anc/4',
            keywords: ['30011'],
          },
        ],
      },
      {
        id: 'thalassemia',
        code: 'THAL',
        label: 'ธาลัสซีเมียในหญิงตั้งครรภ์',
        href: '/service/dashboard-rcm/funds/thalassemia',
        keywords: ['thal', 'ธาลัสซีเมีย', 'ตั้งครรภ์'],
        children: [
          {
            id: 'thal-1',
            badge: '3.1',
            label: 'คัดกรองธาลัสซีเมีย',
            href: '/service/dashboard-rcm/funds/thalassemia/1',
          },
        ],
      },
      {
        id: 'postpartum',
        code: 'PNC',
        label: 'การตรวจหลังคลอด',
        href: '/service/dashboard-rcm/funds/postpartum',
        keywords: ['pnc', 'หลังคลอด', 'triforine'],
        children: [
          {
            id: 'pnc-2',
            badge: '7.2',
            label: 'การตรวจหลังคลอด ADP',
            href: '/service/dashboard-rcm/funds/postpartum/2',
          },
          {
            id: 'pnc-3',
            badge: '7.3',
            label: 'การจ่ายยา Triforine ADP',
            href: '/service/dashboard-rcm/funds/postpartum/3',
            keywords: ['triforine'],
          },
        ],
      },
      {
        id: 'pregnancy-test',
        code: '8.1',
        label: 'การทดสอบการตั้งครรภ์',
        href: '/service/dashboard-rcm/funds/pregnancy-test',
        keywords: ['8.1', 'ตั้งครรภ์', 'ตรวจครรภ์'],
        children: [
          {
            id: 'pregnancy-test-1',
            badge: '8.1',
            label: 'การทดสอบการตั้งครรภ์',
            href: '/service/dashboard-rcm/funds/pregnancy-test/1',
          },
        ],
      },
      {
        id: 'family-planning',
        code: 'FP',
        label: 'วางแผนครอบครัว & คุมกำเนิด',
        href: '/service/dashboard-rcm/funds/family-planning',
        keywords: ['fp', 'คุมกำเนิด', 'ยาคุม', 'ฝังยาคุม', 'ห่วงอนามัย'],
        children: [
          {
            id: 'fp-1',
            badge: '9.1',
            label: 'วางแผนครอบครัวและการป้องกันการตั้งครรภ์',
            href: '/service/dashboard-rcm/funds/family-planning/1',
          },
          {
            id: 'fp-2',
            badge: '9.2',
            label: 'บริการใส่ห่วงอนามัย',
            href: '/service/dashboard-rcm/funds/family-planning/2',
          },
          {
            id: 'fp-9311',
            badge: '9.3.1.1',
            label: 'รายการฝังยาคุม',
            href: '/service/dashboard-rcm/funds/family-planning/9-3-1-1',
          },
          {
            id: 'fp-9312',
            badge: '9.3.1.2',
            label: 'รายการถอดยาคุม',
            href: '/service/dashboard-rcm/funds/family-planning/9-3-1-2',
          },
          {
            id: 'fp-932',
            badge: '9.3.2',
            label: 'บริการคุมกำเนิดกึ่งถาวร (หญิงอายุ ≥ 20 ปี)',
            href: '/service/dashboard-rcm/funds/family-planning/9-3-2',
          },
          {
            id: 'fp-94',
            badge: '9.4',
            label: 'ยาเม็ดคุมกำเนิดชนิดฮอร์โมนรวม',
            href: '/service/dashboard-rcm/funds/family-planning/9-4',
          },
          {
            id: 'fp-95',
            badge: '9.5',
            label: 'ยาเม็ดคุมกำเนิดชนิดฮอร์โมนเดียว',
            href: '/service/dashboard-rcm/funds/family-planning/9-5',
          },
          {
            id: 'fp-96',
            badge: '9.6',
            label: 'ยาเม็ดคุมกำเนิดชนิดฉุกเฉิน',
            href: '/service/dashboard-rcm/funds/family-planning/9-6',
          },
          {
            id: 'fp-97',
            badge: '9.7',
            label: 'ยาฉีดคุมกำเนิด',
            href: '/service/dashboard-rcm/funds/family-planning/9-7',
          },
        ],
      },
      {
        id: 'telemed-drug',
        code: '11',
        label: 'ระบบ Telemedicine & Drug',
        href: '/service/dashboard-rcm/funds/telemed-drug',
        keywords: ['11', 'telemed', 'เทเล', 'drug', 'ยาไปรษณีย์', 'ไปรษณีย์'],
        children: [
          {
            id: 'telemed',
            label: 'บริการ Telemed',
            href: '/service/dashboard-rcm/funds/telemed-drug/telemed',
            keywords: ['telemed', 'เทเล', 'การแพทย์ทางไกล'],
          },
          {
            id: 'postal-drug',
            label: 'ยาไปรษณีย์ Drug',
            href: '/service/dashboard-rcm/funds/telemed-drug/postal-drug',
            keywords: ['ยา', 'ไปรษณีย์', 'drug', 'ส่งยา'],
          },
        ],
      },
      {
        id: 'oral-cancer',
        code: '12',
        label: 'คัดกรองมะเร็งช่องปาก (40 ปี+)',
        href: '/service/dashboard-rcm/funds/oral-cancer',
        keywords: ['12', 'มะเร็งช่องปาก', 'ช่องปาก'],
        children: [
          {
            id: 'oral-cancer-1',
            badge: '12.1',
            label: 'คัดกรองรอยโรคมะเร็งช่องปาก',
            href: '/service/dashboard-rcm/funds/oral-cancer/1',
          },
        ],
      },
      {
        id: 'health-screening',
        code: '14',
        label: 'คัดกรองสุขภาพกาย/จิต (ADP)',
        href: '/service/dashboard-rcm/funds/health-screening',
        keywords: ['14', 'fpg', '12003', '12004', 'cholesterol', 'hdl', 'น้ำตาล', 'ไขมัน'],
        children: [
          {
            id: 'fpg',
            badge: '14.5',
            label: 'Fasting Plasma Glucose (12003)',
            href: '/service/dashboard-rcm/funds/health-screening/14-5',
            keywords: ['12003', 'fpg', 'เบาหวาน', 'น้ำตาล'],
          },
          {
            id: 'cholesterol',
            badge: '14.6',
            label: 'Total Cholesterol / HDL (12004)',
            href: '/service/dashboard-rcm/funds/health-screening/14-6',
            keywords: ['12004', 'cholesterol', 'hdl', 'ไขมัน'],
          },
        ],
      },
      {
        id: 'anemia-screening',
        code: '17',
        label: 'บริการคัดกรองโลหิตจาง (13-24 ปี)',
        href: '/service/dashboard-rcm/funds/anemia-screening',
        keywords: ['17', 'โลหิตจาง', 'ธาตุเหล็ก', 'anemia'],
        children: [
          {
            id: 'anemia-1',
            badge: '17.1',
            label: 'บริการคัดกรองโลหิตจางจากขาดธาตุเหล็ก อายุ 13-24 ปี ADP',
            href: '/service/dashboard-rcm/funds/anemia-screening/17-1',
          },
        ],
      },
      {
        id: 'iron-supplements',
        code: '18',
        label: 'บริการยาเม็ดเสริมธาตุเหล็ก (13-45 ปี)',
        href: '/service/dashboard-rcm/funds/iron-supplements',
        keywords: ['18', 'ยาเม็ดเสริมธาตุเหล็ก', '14001', 'ธาตุเหล็ก'],
        children: [
          {
            id: 'iron-1',
            badge: '18.2',
            label: 'รายชื่อผู้รับบริการยาเม็ดเสริมธาตุเหล็ก ADP (14001)',
            href: '/service/dashboard-rcm/funds/iron-supplements/18-2',
            keywords: ['14001'],
          },
        ],
      },
      {
        id: 'fluoride-varnish',
        code: '20',
        label: 'บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง)',
        href: '/service/dashboard-rcm/funds/fluoride-varnish',
        keywords: ['20', 'ฟลูออไรด์', '15001', 'เคลือบฟลูออไรด์'],
        children: [
          {
            id: 'fluoride-1',
            badge: '20.1',
            label: 'บริการเคลือบฟลูออไรด์ (กลุ่มเสี่ยง) อายุ 25-59 ปี ADP (15001)',
            href: '/service/dashboard-rcm/funds/fluoride-varnish/20-1',
            keywords: ['15001'],
          },
        ],
      },
      {
        id: 'colorectal-cancer',
        code: '21',
        label: 'คัดกรองมะเร็งลำไส้ใหญ่ (Fit test)',
        href: '/service/dashboard-rcm/funds/colorectal-cancer',
        keywords: ['21', 'มะเร็งลำไส้ใหญ่', 'fit test', '90005'],
        children: [
          {
            id: 'colorectal-1',
            badge: '21.2',
            label: 'รายชื่อผู้รับบริการ ADP (90005)',
            href: '/service/dashboard-rcm/funds/colorectal-cancer/21-2',
            keywords: ['90005'],
          },
        ],
      },
      {
        id: 'viral-hepatitis',
        code: '23',
        label: 'ตรวจคัดกรองไวรัสตับอักเสบ (B & C)',
        href: '/service/dashboard-rcm/funds/viral-hepatitis',
        keywords: ['23', 'ตับอักเสบ', 'ไวรัสตับ', 'hcv', 'hcv rna', '36333'],
        children: [
          {
            id: 'vh-1',
            badge: '23.1',
            label: 'บริการตรวจคัดกรองไวรัสตับอักเสบ B',
            href: '/service/dashboard-rcm/funds/viral-hepatitis/23-1',
          },
          {
            id: 'vh-2',
            badge: '23.2',
            label: 'บริการตรวจคัดกรองไวรัสตับอักเสบ C',
            href: '/service/dashboard-rcm/funds/viral-hepatitis/23-2',
          },
          {
            id: 'vh-4',
            badge: '23.4',
            label: 'ตรวจยืนยันไวรัสตับ C HCV RNA (36333)',
            href: '/service/dashboard-rcm/funds/viral-hepatitis/23-4',
            keywords: ['36333', 'hcv rna'],
          },
        ],
      },
      {
        id: 'thalassemia-fund',
        code: 'THAL',
        label: 'กองทุน Thalassemia',
        href: '/service/dashboard-rcm/funds/thalassemia-fund',
        keywords: ['thalassemia', 'ธาลัสซีเมีย'],
        children: [
          {
            id: 'thal-opd',
            badge: '1',
            label: 'ผู้ป่วยนอก Thalassemia',
            href: '/service/dashboard-rcm/funds/thalassemia-fund/opd',
          },
          {
            id: 'thal-ipd',
            badge: '2',
            label: 'ผู้ป่วยใน Thalassemia',
            href: '/service/dashboard-rcm/funds/thalassemia-fund/ipd',
          },
        ],
      },
      {
        id: 't1dm-gdm-pdm',
        code: 'DM',
        label: 'กองทุน T1DM/GDM/PDM',
        href: '/service/dashboard-rcm/funds/t1dm-gdm-pdm',
        keywords: ['dm', 'เบาหวาน', 't1dm', 'gdm', 'pdm'],
        children: [
          {
            id: 'dm-2',
            badge: '2',
            label: 'รายชื่อผู้รับบริการ',
            href: '/service/dashboard-rcm/funds/t1dm-gdm-pdm/2',
          },
        ],
      },
      {
        id: 'thai-traditional-medicine',
        code: 'TTM',
        label: 'บริการแพทย์แผนไทย และการแพทย์ทางเลือก',
        href: '/service/dashboard-rcm/funds/thai-traditional-medicine',
        keywords: ['แพทย์แผนไทย', 'แผนไทย', 'สมุนไพร'],
        children: [
          {
            id: 'ttm-3',
            badge: '3',
            label: 'รายชื่อผู้รับบริการแพทย์แผนไทยรวม',
            href: '/service/dashboard-rcm/funds/thai-traditional-medicine/3',
          },
          {
            id: 'ttm-11',
            badge: '11',
            label: 'รายชื่อผู้รับบริการรับยาสมุนไพร 32 รายการ',
            href: '/service/dashboard-rcm/funds/thai-traditional-medicine/11',
          },
        ],
      },
      {
        id: 'amed-homeward',
        code: 'AMED',
        label: 'ระบบ AMed และ Home Ward',
        href: '/service/dashboard-rcm/funds/amed-homeward',
        keywords: ['amed', 'homeward', 'home ward', 'hw'],
        children: [
          {
            id: 'hw',
            badge: 'HW',
            label: 'รายงาน HOMEWARD',
            href: '/service/dashboard-rcm/funds/amed-homeward/homeward',
          },
        ],
      },
      {
        id: 'adp-search',
        code: 'ADP',
        label: 'ค้นจากรหัส ADP',
        href: '/service/dashboard-rcm/funds/adp-search',
        keywords: ['adp', 'adpcode', 'รหัส adp'],
        children: [
          {
            id: 'adpcode',
            badge: 'ADPCODE',
            label: 'ค้นหาจากรหัส ADPCODE',
            href: '/service/dashboard-rcm/funds/adp-search/adpcode',
          },
        ],
      },
      {
        id: 'clopidogrel',
        code: 'CLOP',
        label: 'กองทุนยา Clopidogrel',
        href: '/service/dashboard-rcm/funds/clopidogrel',
        keywords: ['clopidogrel', 'clop', 'ยา'],
        children: [
          {
            id: 'clop-usage',
            label: 'รายชื่อการใช้ยา Clopidogrel',
            href: '/service/dashboard-rcm/funds/clopidogrel/usage',
          },
        ],
      },
      {
        id: 'streptokinase',
        code: 'STK',
        label: 'กองทุนยา Streptokinase',
        href: '/service/dashboard-rcm/funds/streptokinase',
        keywords: ['streptokinase', 'stk', 'ยา'],
        children: [
          {
            id: 'stk-recipients',
            label: 'รายชื่อรับยา Streptokinase',
            href: '/service/dashboard-rcm/funds/streptokinase/recipients',
          },
        ],
      },
      {
        id: 'instrument',
        code: 'INST',
        label: 'กองทุนอวัยวะเทียมและอุปกรณ์',
        href: '/service/dashboard-rcm/funds/instrument',
        keywords: ['อวัยวะเทียม', 'อุปกรณ์', 'instrument'],
        children: [
          {
            id: 'inst-list',
            label: 'รายชื่อผู้รับบริการ อวัยวะเทียมและอุปกรณ์',
            href: '/service/dashboard-rcm/funds/instrument',
          },
        ],
      },
      {
        id: 'dental-implant',
        code: 'DENT',
        label: 'กองทุนรากฟันเทียม',
        href: '/service/dashboard-rcm/funds/dental-implant',
        keywords: ['รากฟันเทียม', 'densur', 'ทันตกรรม'],
        children: [
          {
            id: 'densur',
            badge: 'DENSUR',
            label: 'รายชื่อบริการผ่าตัดใส่รากฟันเทียม DENSUR',
            href: '/service/dashboard-rcm/funds/dental-implant/densur',
          },
        ],
      },
      {
        id: 'cancer',
        code: 'CA',
        label: 'กองทุนมะเร็ง',
        href: '/service/dashboard-rcm/funds/cancer',
        keywords: ['มะเร็ง', 'cancer', 'ca'],
        children: [
          {
            id: 'cancer-adp',
            badge: 'ADP',
            label: 'รายชื่อผู้ป่วย จาก ADP (CANCER)',
            href: '/service/dashboard-rcm/funds/cancer/adp',
          },
        ],
      },
      {
        id: 'walkin',
        code: 'WALK',
        label: 'กองทุน Walkin',
        href: '/service/dashboard-rcm/funds/walkin',
        keywords: ['walkin', 'adp'],
        children: [
          {
            id: 'walkin-adp',
            badge: 'WALKIN',
            label: 'รายชื่อผู้รับบริการจาก ADP (WALKIN)',
            href: '/service/dashboard-rcm/funds/walkin/adp',
          },
        ],
      },
      {
        id: 'rehabilitation',
        code: '11.47',
        label: 'กองทุนการให้บริการฟื้นฟูสมรรถภาพและเบิกอุปกรณ์',
        href: '/service/dashboard-rcm/funds/rehabilitation',
        keywords: ['ฟื้นฟู', 'สมรรถภาพ', 'disability', 'imc', '11.47'],
        children: [
          {
            id: 'rehab-services',
            badge: 'ฟื้นฟู',
            label: 'รายการการให้บริการฟื้นฟูสมรรถภาพ',
            href: '/service/dashboard-rcm/funds/rehabilitation/services',
            children: [
              {
                id: 'disability-services',
                badge: 'รายชื่อ',
                label: 'รายชื่อการให้บริการฟื้นฟูสมรรถภาพจากเว็บ Disability',
                href: '/service/dashboard-rcm/funds/rehabilitation/services/disability-services',
              },
            ],
          },
          {
            id: 'rehab-imc',
            badge: 'IMC',
            label: 'รายงานบริการผู้ป่วย IMC',
            href: '/service/dashboard-rcm/funds/rehabilitation/imc',
            children: [
              {
                id: 'imc-eligible',
                badge: 'รายชื่อ',
                label: 'รายชื่อผู้รับบริการตามเกณฑ์ IMC',
                href: '/service/dashboard-rcm/funds/rehabilitation/imc/eligible-patients',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'import',
    title: 'นำเข้าข้อมูล',
    modules: [
      {
        id: 'seamless-import',
        code: 'IMP',
        label: 'นำเข้าข้อมูล Seamless',
        href: '/service/dashboard-rcm/seamless-import',
        keywords: ['seamless', 'import', 'นำเข้า'],
      },
      {
        id: 't1dm-import',
        code: 'T1DM',
        label: 'ทะเบียน T1DM/GDM/PDM',
        href: '/service/dashboard-rcm/t1dm-import',
        keywords: ['t1dm', 'gdm', 'pdm', 'เบาหวาน', 'ทะเบียน', 'import', 'นำเข้า'],
      },
    ],
  },
]
