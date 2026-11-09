/**
 * Standard Patient Rights (สิทธิการรักษา) and e-Claim definitions for Thoen Hospital RCM Dashboards.
 * Sourced directly from HOSxP pttype and pttype_eclaim tables.
 */

export interface PttypeOption {
  code: string
  name: string
  pttype?: string
  eclaimCode?: string
}

export interface PttypeMatchTarget {
  pttypename?: string | null
  pttype_eclaim_id?: string | null
  pttype?: string | null
  isUc?: boolean
  uc?: string | boolean | null
}

/**
 * Master list of active HOSxP patient rights (สิทธิการรักษา) at Thoen Hospital.
 */
export const HOSPITAL_PTTYPE_OPTIONS: readonly PttypeOption[] = [
  {
    "code": "HI COVID สิทธิต่างด้าว (เบิกส่วนกลาง)",
    "name": "HI COVID สิทธิต่างด้าว (เบิกส่วนกลาง)",
    "pttype": "59",
    "eclaimCode": "23"
  },
  {
    "code": "HI COVID สิทธิบัตรทอง",
    "name": "HI COVID สิทธิบัตรทอง",
    "pttype": "55",
    "eclaimCode": "36"
  },
  {
    "code": "HI COVID สิทธิเบิกจ่ายตรง อปท.",
    "name": "HI COVID สิทธิเบิกจ่ายตรง อปท.",
    "pttype": "57",
    "eclaimCode": "18"
  },
  {
    "code": "HI COVID สิทธิเบิกจ่ายตรงกรมบัญชีกลาง",
    "name": "HI COVID สิทธิเบิกจ่ายตรงกรมบัญชีกลาง",
    "pttype": "58",
    "eclaimCode": "17"
  },
  {
    "code": "HI COVID สิทธิประกันสังคม",
    "name": "HI COVID สิทธิประกันสังคม",
    "pttype": "56",
    "eclaimCode": "14"
  },
  {
    "code": "Uc walk in บัตรทองนอกเขตนอกจังหวัด",
    "name": "Uc walk in บัตรทองนอกเขตนอกจังหวัด",
    "pttype": "52",
    "eclaimCode": "04"
  },
  {
    "code": "Uc walk in บัตรทองนอกเขตในจว.",
    "name": "Uc walk in บัตรทองนอกเขตในจว.",
    "pttype": "51",
    "eclaimCode": "07"
  },
  {
    "code": "UCEP บัตรทอง ฉุกเฉินวิกฤต",
    "name": "UCEP บัตรทอง ฉุกเฉินวิกฤต",
    "pttype": "EP",
    "eclaimCode": "03"
  },
  {
    "code": "กองทุนทดแทนผู���ประสบภัยจากรถ",
    "name": "กองทุนทดแทนผู���ประสบภัยจากรถ",
    "pttype": "01",
    "eclaimCode": "28"
  },
  {
    "code": "ครอบครัวทหารผ่านศึกในเขต",
    "name": "ครอบครัวทหารผ่านศึกในเขต",
    "pttype": "80",
    "eclaimCode": "01"
  },
  {
    "code": "ครอบครัวผู้นำชุมชน ในเขต",
    "name": "ครอบครัวผู้นำชุมชน ในเขต",
    "pttype": "87",
    "eclaimCode": "01"
  },
  {
    "code": "โครงการพิเศษ สปสช.(ฟันเทียมฯลฯ)",
    "name": "โครงการพิเศษ สปสช.(ฟันเทียมฯลฯ)",
    "pttype": "42",
    "eclaimCode": "06"
  },
  {
    "code": "โครงการส่งเสริมไม่เสียเงิน",
    "name": "โครงการส่งเสริมไม่เสียเงิน",
    "pttype": "43",
    "eclaimCode": "06"
  },
  {
    "code": "จ่ายเงินเอง นอกสิทธิ์เบิกได้ข้าราชการ",
    "name": "จ่ายเงินเอง นอกสิทธิ์เบิกได้ข้าราชการ",
    "pttype": "97",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเอง นอกสิทธิ์ประกันสังคม",
    "name": "จ่ายเงินเอง นอกสิทธิ์ประกันสังคม",
    "pttype": "95",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเอง บุคคลรอพิสูจน์สัญชาติ นอกเขต",
    "name": "จ่ายเงินเอง บุคคลรอพิสูจน์สัญชาติ นอกเขต",
    "pttype": "29",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเอง เบิกบริษัทประกันชีวิต",
    "name": "จ่ายเงินเอง เบิกบริษัทประกันชีวิต",
    "pttype": "96",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเอง ประกันสังคมทำฟัน",
    "name": "จ่ายเงินเอง ประกันสังคมทำฟัน",
    "pttype": "92",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเอง ประกันสังคมฝากครรภ์/คลอด",
    "name": "จ่ายเงินเอง ประกันสังคมฝากครรภ์/คลอด",
    "pttype": "93",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเอง พรบ. รถ",
    "name": "จ่ายเงินเอง พรบ. รถ",
    "pttype": "99",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเองนอกสิทธิ์บัตรทอง",
    "name": "จ่ายเงินเองนอกสิทธิ์บัตรทอง",
    "pttype": "94",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเองบัตรทองต่างจังหวัด",
    "name": "จ่ายเงินเองบัตรทองต่างจังหวัด",
    "pttype": "89",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเองบัตรทองต่างอำเภอ",
    "name": "จ่ายเงินเองบัตรทองต่างอำเภอ",
    "pttype": "90",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเองบุคคลต่างด้าว/ต่างชาติ",
    "name": "จ่ายเงินเองบุคคลต่างด้าว/ต่างชาติ",
    "pttype": "18",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเองประกันสังคมนอกเขต",
    "name": "จ่ายเงินเองประกันสังคมนอกเขต",
    "pttype": "91",
    "eclaimCode": "27"
  },
  {
    "code": "จ่ายเงินเองไม่มีสิทธิบัตรทอง(กรุณาติดต่อห้องบัตร)",
    "name": "จ่ายเงินเองไม่มีสิทธิบัตรทอง(กรุณาติดต่อห้องบัตร)",
    "pttype": "09",
    "eclaimCode": "27"
  },
  {
    "code": "เด็กแรกเกิด",
    "name": "เด็กแรกเกิด",
    "pttype": "06",
    "eclaimCode": "01"
  },
  {
    "code": "ตรวจสุขภาพประกันสังคม",
    "name": "ตรวจสุขภาพประกันสังคม",
    "pttype": "44",
    "eclaimCode": "13"
  },
  {
    "code": "ตรวจสุขภาพประจำปี เบิกจากต้นสังกัด (ประกันสังคม)",
    "name": "ตรวจสุขภาพประจำปี เบิกจากต้นสังกัด (ประกันสังคม)",
    "pttype": "Z1",
    "eclaimCode": "30"
  },
  {
    "code": "ตรวจสุขภาพประจำปี เบิกจากต้นสังกัด (รัฐวิสหกิจ)",
    "name": "ตรวจสุขภาพประจำปี เบิกจากต้นสังกัด (รัฐวิสหกิจ)",
    "pttype": "Z2",
    "eclaimCode": "29"
  },
  {
    "code": "ตรวจสุขภาพประจำปี เบิกต้นสังกัด (บัตรทอง)",
    "name": "ตรวจสุขภาพประจำปี เบิกต้นสังกัด (บัตรทอง)",
    "pttype": "Z3",
    "eclaimCode": "30"
  },
  {
    "code": "ต่างด้าว เบิกส่วนกลาง",
    "name": "ต่างด้าว เบิกส่วนกลาง",
    "pttype": "53",
    "eclaimCode": "23"
  },
  {
    "code": "ต่างด้าวรับ Refer",
    "name": "ต่างด้าวรับ Refer",
    "pttype": "37",
    "eclaimCode": "22"
  },
  {
    "code": "บัตรทอง 30บาท นอกเขต",
    "name": "บัตรทอง 30บาท นอกเขต",
    "pttype": "34",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง 30บาท ในเขต",
    "name": "บัตรทอง 30บาท ในเขต",
    "pttype": "33",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง กลุ่มค่าใช้จ่ายสูง",
    "name": "บัตรทอง กลุ่มค่าใช้จ่ายสูง",
    "pttype": "83",
    "eclaimCode": "03"
  },
  {
    "code": "บัตรทอง ครอบครัว อสม.นอกเขต",
    "name": "บัตรทอง ครอบครัว อสม.นอกเขต",
    "pttype": "28",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ครอบครัว อสม.ในเขต",
    "name": "บัตรทอง ครอบครัว อสม.ในเขต",
    "pttype": "88",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ครอบครัวผู้นำชุมชน นอกเขต",
    "name": "บัตรทอง ครอบครัวผู้นำชุมชน นอกเขต",
    "pttype": "41",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง เด็ก 0-12 ปี นอกเขต",
    "name": "บัตรทอง เด็ก 0-12 ปี นอกเขต",
    "pttype": "21",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง เด็ก 0-12 ปี ในเขต",
    "name": "บัตรทอง เด็ก 0-12 ปี ในเขต",
    "pttype": "71",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ต่างจังหวัด A/E ในสังกัด สธ.",
    "name": "บัตรทอง ต่างจังหวัด A/E ในสังกัด สธ.",
    "pttype": "36",
    "eclaimCode": "04"
  },
  {
    "code": "บัตรทอง ต่างอำเภอ A/E",
    "name": "บัตรทอง ต่างอำเภอ A/E",
    "pttype": "35",
    "eclaimCode": "07"
  },
  {
    "code": "บัตรทอง ทหารผ่านศึก นอกเขต",
    "name": "บัตรทอง ทหารผ่านศึก นอกเขต",
    "pttype": "25",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ทหารผ่านศึก ในเขต",
    "name": "บัตรทอง ทหารผ่านศึก ในเขต",
    "pttype": "75",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ทันตกรรมป้องกัน",
    "name": "บัตรทอง ทันตกรรมป้องกัน",
    "pttype": "45",
    "eclaimCode": "06"
  },
  {
    "code": "บัตรทอง นักเรียน นอกเขต",
    "name": "บัตรทอง นักเรียน นอกเขต",
    "pttype": "23",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง นักเรียน ในเขต",
    "name": "บัตรทอง นักเรียน ในเขต",
    "pttype": "73",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ผู้นำชุมชน นอกเขต",
    "name": "บัตรทอง ผู้นำชุมชน นอกเขต",
    "pttype": "31",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ผู้นำชุมชน ในเขต",
    "name": "บัตรทอง ผู้นำชุมชน ในเขต",
    "pttype": "81",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ผู้บริจาคโลหิต",
    "name": "บัตรทอง ผู้บริจาคโลหิต",
    "pttype": "68",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ผู้พิการ ต่างจังหวัด",
    "name": "บัตรทอง ผู้พิการ ต่างจังหวัด",
    "pttype": "64",
    "eclaimCode": "08"
  },
  {
    "code": "บัตรทอง ผู้พิการ ต่างอำเภอ",
    "name": "บัตรทอง ผู้พิการ ต่างอำเภอ",
    "pttype": "24",
    "eclaimCode": "07"
  },
  {
    "code": "บัตรทอง ผู้พิการ ในเขต",
    "name": "บัตรทอง ผู้พิการ ในเขต",
    "pttype": "74",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ผู้สูงอายุ ในเขต",
    "name": "บัตรทอง ผู้สูงอายุ ในเขต",
    "pttype": "77",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ผู้สูงอายุนอกเขต",
    "name": "บัตรทอง ผู้สูงอายุนอกเขต",
    "pttype": "27",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ภิกษุ/สามเณร/ชี นอกเขต",
    "name": "บัตรทอง ภิกษุ/สามเณร/ชี นอกเขต",
    "pttype": "26",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง ภิกษุ/สามเณร/ชี ในเขต",
    "name": "บัตรทอง ภิกษุ/สามเณร/ชี ในเขต",
    "pttype": "76",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง โรงพยาบาลค่ายฯ / ทหารเกณฑ์",
    "name": "บัตรทอง โรงพยาบาลค่ายฯ / ทหารเกณฑ์",
    "pttype": "08",
    "eclaimCode": "09"
  },
  {
    "code": "บัตรทอง สปร. นอกเขต",
    "name": "บัตรทอง สปร. นอกเขต",
    "pttype": "62",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง สปรในเขต",
    "name": "บัตรทอง สปรในเขต",
    "pttype": "72",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง สิทธิ์หลักประกันสุขภาพแห่งชาติ (ใช้ได้ทุกที่)",
    "name": "บัตรทอง สิทธิ์หลักประกันสุขภาพแห่งชาติ (ใช้ได้ทุกที่)",
    "pttype": "79",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง อสม. นอกเขต",
    "name": "บัตรทอง อสม. นอกเขต",
    "pttype": "32",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง อสม. ในเขต",
    "name": "บัตรทอง อสม. ในเขต",
    "pttype": "82",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรทอง อาสาสมัครมาลาเรียในเขต",
    "name": "บัตรทอง อาสาสมัครมาลาเรียในเขต",
    "pttype": "78",
    "eclaimCode": "01"
  },
  {
    "code": "บัตรผู้บริจาคโลหิต",
    "name": "บัตรผู้บริจาคโลหิต",
    "pttype": "13",
    "eclaimCode": ""
  },
  {
    "code": "บัตรอนามัยเด็ก",
    "name": "บัตรอนามัยเด็ก",
    "pttype": "30",
    "eclaimCode": "06"
  },
  {
    "code": "บัตรอนามัยมารดา",
    "name": "บัตรอนามัยมารดา",
    "pttype": "98",
    "eclaimCode": "06"
  },
  {
    "code": "บุคคลต่างด้าวขึ้นทะเบียนในเขต",
    "name": "บุคคลต่างด้าวขึ้นทะเบียนในเขต",
    "pttype": "17",
    "eclaimCode": "21"
  },
  {
    "code": "บุคคลในครอบครัวของผู้ได้รับพระราชทานเหรียญงานสงครามในทวีปยุโรป",
    "name": "บุคคลในครอบครัวของผู้ได้รับพระราชทานเหรียญงานสงครามในทวีปยุโรป",
    "pttype": "86",
    "eclaimCode": "01"
  },
  {
    "code": "บุคคลรอพิสูจน์สัญชาติ นอกเขต (เฉพาะ ARV)",
    "name": "บุคคลรอพิสูจน์สัญชาติ นอกเขต (เฉพาะ ARV)",
    "pttype": "46",
    "eclaimCode": "24"
  },
  {
    "code": "บุคคลรอพิสูจน์สัญชาติ ในเขต",
    "name": "บุคคลรอพิสูจน์สัญชาติ ในเขต",
    "pttype": "20",
    "eclaimCode": "24"
  },
  {
    "code": "เบิกได้ จ่ายตรง กรมบัญชีกลาง",
    "name": "เบิกได้ จ่ายตรง กรมบัญชีกลาง",
    "pttype": "22",
    "eclaimCode": "17"
  },
  {
    "code": "เบิกได้ จ่ายตรง ขสมก.",
    "name": "เบิกได้ จ่ายตรง ขสมก.",
    "pttype": "BM",
    "eclaimCode": "33"
  },
  {
    "code": "เบิกได้ จ่ายตรง ข้าราชการกรุงเทพมหานคร",
    "name": "เบิกได้ จ่ายตรง ข้าราชการกรุงเทพมหานคร",
    "pttype": "S1",
    "eclaimCode": "19"
  },
  {
    "code": "เบิกได้ จ่ายตรง สนง. กกต.",
    "name": "เบิกได้ จ่ายตรง สนง. กกต.",
    "pttype": "38",
    "eclaimCode": "33"
  },
  {
    "code": "เบิกได้ จ่ายตรง สำนักงานกองทุนฟื้นฟูและพัฒนาเกษตรกร",
    "name": "เบิกได้ จ่ายตรง สำนักงานกองทุนฟื้นฟูและพัฒนาเกษตรกร",
    "pttype": "B3",
    "eclaimCode": "33"
  },
  {
    "code": "เบิกได้ จ่ายตรง อปท.",
    "name": "เบิกได้ จ่ายตรง อปท.",
    "pttype": "10",
    "eclaimCode": "18"
  },
  {
    "code": "เบิกได้ เจ้าหน้าที่รพ.เถิน",
    "name": "เบิกได้ เจ้าหน้าที่รพ.เถิน",
    "pttype": "12",
    "eclaimCode": ""
  },
  {
    "code": "เบิกได้ ในเขต (ชำระเงิน ออกใบเสร็จ)",
    "name": "เบิกได้ ในเขต (ชำระเงิน ออกใบเสร็จ)",
    "pttype": "11",
    "eclaimCode": "16"
  },
  {
    "code": "เบิกได้ ผู้มีสิทธิครูเอกชน",
    "name": "เบิกได้ ผู้มีสิทธิครูเอกชน",
    "pttype": "B4",
    "eclaimCode": "16"
  },
  {
    "code": "เบิกต้นสังกัด (ผู้ป่วยใน) ใช้ใบส่งตัว",
    "name": "เบิกต้นสังกัด (ผู้ป่วยใน) ใช้ใบส่งตัว",
    "pttype": "60",
    "eclaimCode": "16"
  },
  {
    "code": "เบิกตรง ไปรษณีย์ไทย",
    "name": "เบิกตรง ไปรษณีย์ไทย",
    "pttype": "B1",
    "eclaimCode": "16"
  },
  {
    "code": "เบิกตรง รฟท.(การรถไฟไทย)",
    "name": "เบิกตรง รฟท.(การรถไฟไทย)",
    "pttype": "B2",
    "eclaimCode": "33"
  },
  {
    "code": "ประกันชีวิต iClaim",
    "name": "ประกันชีวิต iClaim",
    "pttype": "A1",
    "eclaimCode": "27"
  },
  {
    "code": "ประกันภัยรถตามพรบ.บุคคลที่ 3",
    "name": "ประกันภัยรถตามพรบ.บุคคลที่ 3",
    "pttype": "16",
    "eclaimCode": "28"
  },
  {
    "code": "ประกันสังคม กรณีทุพพลภาพ",
    "name": "ประกันสังคม กรณีทุพพลภาพ",
    "pttype": "04",
    "eclaimCode": "13"
  },
  {
    "code": "ประกันสังคม ต่างจังหวัดฉุกเฉิน",
    "name": "ประกันสังคม ต่างจังหวัดฉุกเฉิน",
    "pttype": "15",
    "eclaimCode": "15"
  },
  {
    "code": "ประกันสังคม ทำฟัน รพ.ดำเนินการ",
    "name": "ประกันสังคม ทำฟัน รพ.ดำเนินการ",
    "pttype": "00",
    "eclaimCode": "13"
  },
  {
    "code": "ประกันสังคม ผู้ป่วยใน 72 ชั่วโมงแรก",
    "name": "ประกันสังคม ผู้ป่วยใน 72 ชั่วโมงแรก",
    "pttype": "66",
    "eclaimCode": "14"
  },
  {
    "code": "ประกันสังคม ผู้ป่วยใน COVID",
    "name": "ประกันสังคม ผู้ป่วยใน COVID",
    "pttype": "67",
    "eclaimCode": "14"
  },
  {
    "code": "ประกันสังคม ผู้ป่วยใน หลัง 72 ชั่วโมง",
    "name": "ประกันสังคม ผู้ป่วยใน หลัง 72 ชั่วโมง",
    "pttype": "65",
    "eclaimCode": "11"
  },
  {
    "code": "ประกันสังคม ผู้พิการ",
    "name": "ประกันสังคม ผู้พิการ",
    "pttype": "39",
    "eclaimCode": "13"
  },
  {
    "code": "ประกันสังคม รพ.ค่ายฯ",
    "name": "ประกันสังคม รพ.ค่ายฯ",
    "pttype": "19",
    "eclaimCode": "12"
  },
  {
    "code": "ประกันสังคม รพ.ศูนย์",
    "name": "ประกันสังคม รพ.ศูนย์",
    "pttype": "14",
    "eclaimCode": "10"
  },
  {
    "code": "ประกันสังคม ส่งเงินไม่ครบ  3 เดือน",
    "name": "ประกันสังคม ส่งเงินไม่ครบ  3 เดือน",
    "pttype": "02",
    "eclaimCode": "03"
  },
  {
    "code": "ประกันสังคม ส่งเงินไม่ครบ 7  เดือน",
    "name": "ประกันสังคม ส่งเงินไม่ครบ 7  เดือน",
    "pttype": "03",
    "eclaimCode": "03"
  },
  {
    "code": "ประกันสังคม ส่งเสริมคัดกรอง COVID-19",
    "name": "ประกันสังคม ส่งเสริมคัดกรอง COVID-19",
    "pttype": "49",
    "eclaimCode": "06"
  },
  {
    "code": "ประกันสังคม อุบัติเหตุจากการทำงาน",
    "name": "ประกันสังคม อุบัติเหตุจากการทำงาน",
    "pttype": "05",
    "eclaimCode": "13"
  },
  {
    "code": "ประกันอุบัติเหตุ นักเรียน/นักศึกษา",
    "name": "ประกันอุบัติเหตุ นักเรียน/นักศึกษา",
    "pttype": "40",
    "eclaimCode": "27"
  },
  {
    "code": "ผู้ป่วยขออนุเคราะห์",
    "name": "ผู้ป่วยขออนุเคราะห์",
    "pttype": "63",
    "eclaimCode": "27"
  },
  {
    "code": "ฟอกไตสิทธิ์ บัตรทอง",
    "name": "ฟอกไตสิทธิ์ บัตรทอง",
    "pttype": "H1",
    "eclaimCode": "01"
  },
  {
    "code": "ฟอกไตสิทธิ์ เบิกได้จ่ายตรง",
    "name": "ฟอกไตสิทธิ์ เบิกได้จ่ายตรง",
    "pttype": "H3",
    "eclaimCode": "17"
  },
  {
    "code": "ฟอกไตสิทธิ์ ประกันสังคม",
    "name": "ฟอกไตสิทธิ์ ประกันสังคม",
    "pttype": "H2",
    "eclaimCode": "15"
  },
  {
    "code": "ฟอกไตสิทธิ์ อปท.",
    "name": "ฟอกไตสิทธิ์ อปท.",
    "pttype": "H4",
    "eclaimCode": "18"
  },
  {
    "code": "ส่งเสริม Vaccine COVID-19",
    "name": "ส่งเสริม Vaccine COVID-19",
    "pttype": "47",
    "eclaimCode": "06"
  },
  {
    "code": "ส่งเสริมคัดกรอง COVID-19  ข้าราชการ",
    "name": "ส่งเสริมคัดกรอง COVID-19  ข้าราชการ",
    "pttype": "50",
    "eclaimCode": "06"
  },
  {
    "code": "ส่งเสริมคัดกรอง COVID-19  บัตรทอง",
    "name": "ส่งเสริมคัดกรอง COVID-19  บัตรทอง",
    "pttype": "48",
    "eclaimCode": "06"
  },
  {
    "code": "สิทธิว่างใช้สิทธิครั้งแรก",
    "name": "สิทธิว่างใช้สิทธิครั้งแรก",
    "pttype": "07",
    "eclaimCode": "03"
  }
] as const;

export const ECLAIM_PTTYPE_OPTIONS: readonly PttypeOption[] = [
  { code: '01', name: 'UC ใน CUP' },
  { code: '02', name: 'UC ใน CUP ร่วมจ่าย 30 บาท' },
  { code: '03', name: 'บริการเฉพาะ(CR)' },
  { code: '04', name: 'บริการเฉพาะ(CR)' },
  { code: '05', name: 'บริการเฉพาะ(CR)' },
  { code: '06', name: 'UC-PP Expressed demand สร้างเสริมสุขภาพและป้องกันโรค' },
  { code: '07', name: 'UC นอก CUP ในจังหวัด' },
  { code: '08', name: 'UC นอก CUP ต่างจังหวัด' },
  { code: '09', name: 'UC ต่างสังกัด สป.' },
  { code: '10', name: 'ประกันสังคม ในเครือข่าย' },
  { code: '11', name: 'ประกันสังคม นอกเครือข่าย' },
  { code: '12', name: 'ประกันสังคม ต่างสังกัด สป.' },
  { code: '13', name: 'ประกันสังคม กองทุนทดแทน' },
  { code: '14', name: 'ประกันสังคม 72 ชั่วโมงแรก' },
  { code: '15', name: 'ประกันสังคม HC/AE' },
  { code: '16', name: 'เบิกต้นสังกัด' },
  { code: '17', name: 'เบิกจ่ายตรงกรมบัญชีกลาง' },
  { code: '18', name: 'เบิกจ่ายตรง อปท.' },
  { code: '19', name: 'เบิกจ่ายตรง อปท.รูปแบบพิเศษ (กทม)' },
  { code: '20', name: 'เบิกจ่ายตรง อปท.รูปแบบพิเศษ (พัทยา)' },
  { code: '21', name: 'แรงงานต่างด้าว' },
  { code: '22', name: 'แรงงานต่างด้าว นอก CUP' },
  { code: '23', name: 'แรงงานด้างด้าวเบิกจากส่วนกลาง' },
  { code: '24', name: 'บุคคลที่มีปัญหาทางสิทธิในCUP' },
  { code: '25', name: 'บุคคลที่มีปัญหาทางสิทธิ นอก CUP' },
  { code: '26', name: 'บุคคลที่มีปัญหาทางสิทธิ เบิกจากส่วนกลาง' },
  { code: '27', name: 'ชำระเงิน' },
  { code: '28', name: 'พรบ.รถ' },
  { code: '29', name: 'ตรวจสุขภาพหน่วยงานภาครัฐ' },
  { code: '30', name: 'ค่าตรวจสุขภาพบุคคลภายนอก' },
  { code: '31', name: 'ระบบปฏิบัติการฉุกเฉิน(EMS)' },
  { code: '32', name: 'OP Refer' },
  { code: '33', name: 'เบิกจ่ายตรง - หน่วยงานอื่น (กกต./สปสช.)' },
  { code: '34', name: 'ค่าสิ่งส่งตรวจหน่วยงานภาครัฐ' },
  { code: '35', name: 'ค่าสิ่งส่งตรวจบุคคลภายนอก' },
  { code: '36', name: 'ค่าวัสดุ/ อุปกรณ์/น้ำยาหน่วยงานภาครัฐ' },
  { code: '37', name: 'ค่าสินค้า หน่วยงานภาครัฐ' },
] as const;

export const UC_ECLAIM_CODES: readonly string[] = [
  '01', '02', '03', '04', '05', '06', '07', '08', '09'
] as const;

export function isUcEclaimCode(code?: string | null): boolean {
  if (!code) return false;
  return UC_ECLAIM_CODES.includes(code.trim());
}

/**
 * Check if a row item matches the selected patient rights (สิทธิการรักษา) filter.
 * Supports:
 * - matchesPttypeFilter(item: PttypeMatchTarget, selectedCodes)
 * - matchesPttypeFilter(pttypenameOrId, selectedCodes, itemIsUc, pttypeEclaimId)
 * - matchesPttypeFilter(selectedCodes, pttypenameOrId, itemIsUc)
 */
export function matchesPttypeFilter(
  arg1?: PttypeMatchTarget | readonly string[] | string[] | string | null,
  arg2?: readonly string[] | string[] | string | null,
  itemIsUc?: boolean,
  arg4PttypeEclaimId?: string | null
): boolean {
  let selectedCodes: readonly string[] = [];
  let targetObject: PttypeMatchTarget | null = null;
  let targetString: string | null = null;

  if (typeof arg1 === 'object' && arg1 !== null && !Array.isArray(arg1)) {
    targetObject = arg1 as PttypeMatchTarget;
    if (Array.isArray(arg2)) {
      selectedCodes = arg2;
    } else if (typeof arg2 === 'string') {
      selectedCodes = arg2.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } else if (typeof arg2 === 'object' && arg2 !== null && !Array.isArray(arg2)) {
    targetObject = arg2 as PttypeMatchTarget;
    if (Array.isArray(arg1)) {
      selectedCodes = arg1;
    } else if (typeof arg1 === 'string') {
      selectedCodes = arg1.split(',').map((s) => s.trim()).filter(Boolean);
    }
  } else if (Array.isArray(arg1)) {
    selectedCodes = arg1;
    targetString = typeof arg2 === 'string' ? arg2 : null;
  } else if (Array.isArray(arg2)) {
    selectedCodes = arg2;
    targetString = typeof arg1 === 'string' ? arg1 : null;
  } else if (typeof arg2 === 'string' && (arg2.includes(',') || arg2.length >= 2)) {
    selectedCodes = arg2.split(',').map((s) => s.trim()).filter(Boolean);
    targetString = typeof arg1 === 'string' ? arg1 : null;
  } else if (typeof arg1 === 'string') {
    selectedCodes = arg1.split(',').map((s) => s.trim()).filter(Boolean);
    targetString = typeof arg2 === 'string' ? arg2 : null;
  }

  if (!selectedCodes || selectedCodes.length === 0) return true;

  if (targetObject) {
    const name = (targetObject.pttypename || '').trim();
    const pttype = (targetObject.pttype || '').trim();
    const eclaimId = (targetObject.pttype_eclaim_id || '').trim();
    const isUc = Boolean(targetObject.isUc || targetObject.uc === 'Y' || targetObject.uc === true);

    if (name && selectedCodes.includes(name)) return true;
    if (pttype && selectedCodes.includes(pttype)) return true;
    if (eclaimId && selectedCodes.includes(eclaimId)) return true;

    // Check if user selected "UC" preset and item is UC
    const isAllSelectedUc =
      selectedCodes.length === UC_ECLAIM_CODES.length &&
      UC_ECLAIM_CODES.every((c) => selectedCodes.includes(c));
    if (isAllSelectedUc && isUc) return true;

    return false;
  }

  if (targetString) {
    const trimmed = targetString.trim();
    if (selectedCodes.includes(trimmed)) return true;
  }

  if (arg4PttypeEclaimId) {
    const trimmedEclaim = arg4PttypeEclaimId.trim();
    if (selectedCodes.includes(trimmedEclaim)) return true;
  }

  const isAllSelectedUc =
    selectedCodes.length === UC_ECLAIM_CODES.length &&
    UC_ECLAIM_CODES.every((c) => selectedCodes.includes(c));
  if (isAllSelectedUc && itemIsUc) {
    return true;
  }

  return false;
}
