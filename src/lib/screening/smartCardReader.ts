/**
 * Smart Card Reader (WebHID / Thai National ID Card) Driver and Helpers
 * Supports ISO-7816 / CCID APDU commands and TIS-620 decoding.
 */

export interface SmartCardData {
  cid: string
  titleTh: string
  firstNameTh: string
  lastNameTh: string
  fullNameTh: string
  titleEn?: string
  firstNameEn?: string
  lastNameEn?: string
  fullNameEn?: string
  birthDate?: string
  gender?: string
  address?: string
  photoBase64?: string
  rawPayload: Record<string, any>
}

// Thai ID Card Select Applet APDU (AID: A0 00 00 00 54 48 00 01)
export const APDU_SELECT_APPLET = [
  0x00, 0xa4, 0x04, 0x00, 0x08, 0xa0, 0x00, 0x00, 0x00, 0x54, 0x48, 0x00, 0x01,
]

// Thai ID APDU Commands
export const APDU_READ_CID = [0x80, 0xb0, 0x00, 0x04, 0x02, 0x00, 0x0d]
export const APDU_READ_NAME_TH = [0x80, 0xb0, 0x00, 0x11, 0x02, 0x00, 0x64]
export const APDU_READ_NAME_EN = [0x80, 0xb0, 0x00, 0x75, 0x02, 0x00, 0x64]
export const APDU_READ_BIRTH_GENDER = [0x80, 0xb0, 0x00, 0xe1, 0x02, 0x00, 0x12]
export const APDU_READ_ADDRESS = [0x80, 0xb0, 0x15, 0x79, 0x02, 0x00, 0x64]

/**
 * Decodes TIS-620 (Windows-874) byte buffer into UTF-8 Thai string.
 */
export function decodeTis620(bytes: Uint8Array | number[]): string {
  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  try {
    const decoder = new TextDecoder('windows-874')
    return decoder.decode(uint8).replace(/\0/g, '').trim()
  } catch {
    try {
      const decoder = new TextDecoder('tis-620')
      return decoder.decode(uint8).replace(/\0/g, '').trim()
    } catch {
      return String.fromCharCode(...uint8).trim()
    }
  }
}

/**
 * Parses Thai Buddhist year date string (YYYYMMDD) into formatted date (e.g. 2528-04-12 -> 12 เม.ย. 2528)
 */
export function parseThaiIdBirthDate(raw: string): string {
  if (!raw || raw.length < 8) return raw
  const clean = raw.trim()
  const y = clean.substring(0, 4)
  const m = clean.substring(4, 6)
  const d = clean.substring(6, 8)
  return `${y}-${m}-${d}`
}

/**
 * Parse Thai card name format: "คำนำหน้า#ชื่อตัว#ชื่อกลาง#ชื่อสกุล"
 */
export function parseThaiCardName(rawStr: string): {
  title: string
  firstName: string
  lastName: string
  fullName: string
} {
  const parts = rawStr.split('#').map((s) => s.trim())
  const title = parts[0] || ''
  const firstName = parts[1] || ''
  const middleName = parts[2] || ''
  const lastName = parts[3] || ''

  const nameParts = [title, firstName, middleName, lastName].filter(Boolean)
  const fullName = nameParts.join(' ').trim()

  return {
    title,
    firstName: middleName ? `${firstName} ${middleName}` : firstName,
    lastName,
    fullName,
  }
}

/**
 * Parse Thai card address format: "เลขที่#หมู่ที่#ตรอก/ซอย#ถนน#ตำบล#อำเภอ#จังหวัด"
 */
export function parseThaiCardAddress(rawStr: string): string {
  return rawStr
    .split('#')
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Generate synthetic SmartCardData for testing and demo without physical card reader.
 */
export function generateMockCardData(): SmartCardData {
  const firstNames = ['สมชาย', 'วิภาดา', 'เกรียงไกร', 'กมลวรรณ', 'ธีรยุทธ', 'วันดี', 'บุญชู', 'ศิริพร', 'ประเสริฐ', 'สุมาลี']
  const lastNames = ['ใจดี', 'มั่นคง', 'รัตนโกสินทร์', 'บุญประเสริฐ', 'สว่างวงศ์', 'แซ่ตั้ง', 'เมืองเถิน', 'ศรีสวัสดิ์', 'คำมา', 'วงศ์ใหญ่']
  const titles = ['นาย', 'นาง', 'นางสาว']
  const genders = ['ชาย', 'หญิง']

  const randIdx = Math.floor(Math.random() * firstNames.length)
  const isFemale = randIdx % 2 === 1
  const title = isFemale ? (randIdx % 4 === 1 ? 'นาง' : 'นางสาว') : 'นาย'
  const firstName = firstNames[randIdx]
  const lastName = lastNames[randIdx]
  const gender = isFemale ? 'หญิง' : 'ชาย'

  // Generate synthetic 13-digit citizen ID starting with 15299... (Lampang Thoen district prefix)
  const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString()
  const cid = `1529900${randomSuffix}`

  const birthYear = 2490 + Math.floor(Math.random() * 55) // 2490-2545
  const birthMonth = String(Math.floor(1 + Math.random() * 12)).padStart(2, '0')
  const birthDay = String(Math.floor(1 + Math.random() * 28)).padStart(2, '0')
  const birthDate = `${birthYear}-${birthMonth}-${birthDay}`

  const moo = Math.floor(1 + Math.random() * 12)
  const subdistricts = ['ล้อมแรด', 'เถินบุรี', 'แม่วะ', 'แม่ปะ', 'แม่มอก', 'เวียงมอก', 'ดอนไฟ', 'นาโป่ง']
  const subdistrict = subdistricts[Math.floor(Math.random() * subdistricts.length)]
  const houseNo = `${Math.floor(1 + Math.random() * 200)}/${Math.floor(1 + Math.random() * 10)}`
  const address = `บ้านเลขที่ ${houseNo} หมู่ที่ ${moo} ตำบล${subdistrict} อำเภอเถิน จังหวัดลำปาง 52160`

  return {
    cid,
    titleTh: title,
    firstNameTh: firstName,
    lastNameTh: lastName,
    fullNameTh: `${title}${firstName} ${lastName}`,
    titleEn: isFemale ? 'MISS' : 'MR.',
    firstNameEn: 'MOCK',
    lastNameEn: 'PATIENT',
    fullNameEn: `${isFemale ? 'MISS' : 'MR.'} MOCK PATIENT`,
    birthDate,
    gender,
    address,
    rawPayload: {
      source: 'MOCK_SIMULATION',
      cid,
      fullNameTh: `${title}${firstName} ${lastName}`,
      gender,
      birthDate,
      address,
      readTimestamp: new Date().toISOString(),
      cardReaderType: 'SmartCard Simulation Mode',
      appletVersion: 'v2.0-ThoenHospital',
    },
  }
}
