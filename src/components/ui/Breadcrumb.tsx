import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  variant?: 'default' | 'light'
  className?: string
}

export default function Breadcrumb({ items, variant = 'default', className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`breadcrumb-nav ${variant === 'light' ? 'breadcrumb-nav--light' : ''} ${className}`.trim()}>
      <div className="breadcrumb-item">
        <Link href="/" className="breadcrumb-link" aria-label="หน้าแรก">
          <Home size={16} />
        </Link>
      </div>

      {items.map((item, index) => {
        const isLast = index === items.length - 1

        return (
          <div key={`${item.label}-${index}`} className="breadcrumb-item">
            <ChevronRight size={14} className="breadcrumb-separator" aria-hidden="true" />
            {isLast || !item.href ? (
              <span className="breadcrumb-current" aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="breadcrumb-link">
                {item.label}
              </Link>
            )}
          </div>
        )
      })}
    </nav>
  )
}
