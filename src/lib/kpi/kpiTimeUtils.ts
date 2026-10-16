/**
 * KPI Time Utilities for Fiscal Year and Period Tracking
 * 
 * Thai Fiscal Year: 1 October - 30 September
 * Example: Fiscal Year 2570 corresponds to 1 Oct 2026 - 30 Sep 2027.
 */

export interface PeriodDefinition {
  key: string
  label: string
  unlockMonth: number // 1-12
  unlockDay: number   // 1-31
  unlockYearOffset: number // 0 for same calendar year as fiscal start, 1 for next calendar year
  description: string
}

export const FREQUENCY_PERIODS: Record<string, PeriodDefinition[]> = {
  'ราย 6 เดือน': [
    {
      key: 'H1',
      label: 'รอบ 6 เดือนแรก (ต.ค. - มี.ค.)',
      unlockMonth: 4,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 31 มีนาคม',
    },
    {
      key: 'H2',
      label: 'รอบ 12 เดือน / สิ้นปีงบประมาณ (เม.ย. - ก.ย.)',
      unlockMonth: 10,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 กันยายน',
    },
  ],
  'รายไตรมาส': [
    {
      key: 'Q1',
      label: 'ไตรมาสที่ 1 (ต.ค. - ธ.ค.)',
      unlockMonth: 1,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 31 ธันวาคม',
    },
    {
      key: 'Q2',
      label: 'ไตรมาสที่ 2 (ม.ค. - มี.ค.)',
      unlockMonth: 4,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 31 มีนาคม',
    },
    {
      key: 'Q3',
      label: 'ไตรมาสที่ 3 (เม.ย. - มิ.ย.)',
      unlockMonth: 7,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 มิถุนายน',
    },
    {
      key: 'Q4',
      label: 'ไตรมาสที่ 4 (ก.ค. - ก.ย.)',
      unlockMonth: 10,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 กันยายน',
    },
  ],
  'รายปี': [
    {
      key: 'YEAR',
      label: 'รอบสิ้นปีงบประมาณ (ต.ค. - ก.ย.)',
      unlockMonth: 10,
      unlockDay: 1,
      unlockYearOffset: 1,
      description: 'เปิดให้บันทึกหลังวันที่ 30 กันยายน',
    },
  ],
  'รายเดือน': [
    { key: 'M01', label: 'ตุลาคม', unlockMonth: 11, unlockDay: 1, unlockYearOffset: 0, description: 'เปิดให้บันทึกหลัง 31 ต.ค.' },
    { key: 'M02', label: 'พฤศจิกายน', unlockMonth: 12, unlockDay: 1, unlockYearOffset: 0, description: 'เปิดให้บันทึกหลัง 30 พ.ย.' },
    { key: 'M03', label: 'ธันวาคม', unlockMonth: 1, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ธ.ค.' },
    { key: 'M04', label: 'มกราคม', unlockMonth: 2, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ม.ค.' },
    { key: 'M05', label: 'กุมภาพันธ์', unlockMonth: 3, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลังสิ้นเดือน ก.พ.' },
    { key: 'M06', label: 'มีนาคม', unlockMonth: 4, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 มี.ค.' },
    { key: 'M07', label: 'เมษายน', unlockMonth: 5, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 30 เม.ย.' },
    { key: 'M08', label: 'พฤษภาคม', unlockMonth: 6, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 พ.ค.' },
    { key: 'M09', label: 'มิถุนายน', unlockMonth: 7, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 30 มิ.ย.' },
    { key: 'M10', label: 'กรกฎาคม', unlockMonth: 8, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ก.ค.' },
    { key: 'M11', label: 'สิงหาคม', unlockMonth: 9, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 31 ส.ค.' },
    { key: 'M12', label: 'กันยายน', unlockMonth: 10, unlockDay: 1, unlockYearOffset: 1, description: 'เปิดให้บันทึกหลัง 30 ก.ย.' },
  ],
}

/**
 * Returns periods applicable for a given frequency
 */
export function getPeriodsForFrequency(frequency: string): PeriodDefinition[] {
  return FREQUENCY_PERIODS[frequency] || FREQUENCY_PERIODS['รายปี']
}

/**
 * Converts a Buddhist Era year string (e.g. "2570") to CE Start Year (e.g. 2026).
 * FY 2570 starts in Oct 2026 and ends in Sep 2027.
 */
export function getFiscalStartYearCe(fiscalYearBe: string | number): number {
  const beYear = typeof fiscalYearBe === 'string' ? parseInt(fiscalYearBe, 10) : fiscalYearBe
  return beYear - 543 - 1
}

/**
 * Check if a reporting period is unlocked given the fiscal year and current date
 */
export function checkPeriodStatus(
  frequency: string,
  periodKey: string,
  fiscalYearBe: string | number,
  currentDate = new Date()
): { isOpen: boolean; unlockDate: Date; unlockDateFormatted: string; message: string } {
  const periods = getPeriodsForFrequency(frequency)
  const period = periods.find(p => p.key === periodKey) || periods[0]

  const startYearCe = getFiscalStartYearCe(fiscalYearBe)
  const unlockYearCe = startYearCe + period.unlockYearOffset
  const unlockDate = new Date(Date.UTC(unlockYearCe, period.unlockMonth - 1, period.unlockDay, 0, 0, 0))

  const isOpen = currentDate.getTime() >= unlockDate.getTime()
  const unlockDateFormatted = `${period.unlockDay}/${period.unlockMonth}/${unlockYearCe + 543}`

  const message = isOpen
    ? 'เปิดให้บันทึกข้อมูลแล้ว'
    : `ยังไม่ถึงรอบบันทึก (เปิดให้บันทึกตั้งแต่ ${unlockDateFormatted} เป็นต้นไป)`

  return {
    isOpen,
    unlockDate,
    unlockDateFormatted,
    message,
  }
}
