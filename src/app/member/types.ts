export type ServiceCategory = 'all' | 'favorites' | 'daily' | 'system' | 'admin'

export interface MemberPortalServiceItem {
  id: string
  title: string
  description: string
  href: string
  icon: string // Material Symbol name, e.g. 'inbox', 'build'
  category: 'daily' | 'system' | 'admin'
  tag?: string
  keywords: string[]
  isHero?: boolean
  actionText?: string
  badge?: {
    text: string
    variant: 'alert' | 'ok' | 'neutral' | 'highlight'
    pulse?: boolean
  }
}
