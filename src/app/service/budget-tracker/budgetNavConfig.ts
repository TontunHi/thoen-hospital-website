import {
  Building2,
  BarChart3,
  Activity,
  Layers,
  LucideIcon,
} from 'lucide-react'

export interface BudgetNavItem {
  id: string
  title: string
  shortTitle: string
  description?: string
  href: string
  icon: LucideIcon
  badge?: {
    text: string
    variant?: 'primary' | 'success' | 'warning' | 'info' | 'default'
  }
  isReady?: boolean
  keywords?: string[]
}

export interface BudgetNavGroup {
  id: string
  groupTitle: string
  items: BudgetNavItem[]
}

export const BUDGET_NAV_GROUPS: BudgetNavGroup[] = [
  {
    id: 'nhso',
    groupTitle: 'งบ สปสช. & ชดเชยบริการ',
    items: [
      {
        id: 'rh1',
        title: 'ผลงานชดเชย เขต 1 (MIS HOS เขต 1)',
        shortTitle: 'MIS HOS เขต 1',
        description: 'ข้อมูลรายกองทุนย่อย ชดเชย อปท. ฟอกไต อวัยวะเทียม',
        href: '/service/budget-tracker/rh1',
        icon: Building2,
        badge: { text: 'เขต 1', variant: 'primary' },
        keywords: ['rh1', 'เขต 1', 'ชดเชย', 'mishos', 'กองทุนย่อย'],
      },
      {
        id: 'smt',
        title: 'ติดตามงบ สปสช. (SMT Dashboard)',
        shortTitle: 'SMT Dashboard',
        description: 'สถานะการเบิกจ่ายและแนวโน้มการโอนเงิน สปสช.',
        href: '/service/budget-tracker/smt',
        icon: BarChart3,
        keywords: ['smt', 'สปสช', 'dashboard', 'เบิกจ่าย', 'trend'],
      },
      {
        id: 'mishos',
        title: 'MIS HOS สปสช. (ส่วนกลาง)',
        shortTitle: 'MIS HOS ส่วนกลาง',
        description: 'รายงานวิเคราะห์ภาพรวมส่วนกลาง สปสช.',
        href: '/service/budget-tracker/mishos',
        icon: Activity,
        keywords: ['mishos', 'ส่วนกลาง', 'วิเคราะห์'],
      },
    ],
  },
  {
    id: 'planfin',
    groupTitle: 'แผนเงินบำรุง & งบลงทุน',
    items: [
      {
        id: 'planfin',
        title: 'แผนเงินบำรุง (Planfin)',
        shortTitle: 'Planfin',
        description: 'ระบบติดตามแผนเงินบำรุงและงบลงทุน รพ.เถิน',
        href: '/service/budget-tracker/planfin',
        icon: Layers,
        badge: { text: 'เร็วๆ นี้', variant: 'default' },
        keywords: ['planfin', 'เงินบำรุง', 'งบลงทุน'],
      },
    ],
  },
]
