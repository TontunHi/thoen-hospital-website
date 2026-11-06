---
name: member-auth-flow
description: Passwordless Thai National ID + OTP auth for the /member hospital staff portal, required server-side session check pattern, and /member portal sidebar/submenu navigation patterns (default-collapsed with localStorage memory). Read before touching any /member route, its Server Components, API routes, or navigation layout.
---

## What this covers
1. The `/member` portal authentication: Passwordless Thai National ID + a 6-digit OTP delivered via Brevo/SMTP, implemented in `@/lib/memberAuth.ts` and `@/lib/auth/MemberAuthService.ts`.
2. Defensive Server-Side Session Verification on protected pages and APIs.
3. Sidebar & Submenu Navigation standards: Default-collapsed submenus with persistent memory (`localStorage`).

## Required pattern — pages
Every protected page under `/member` (e.g. `/member/signature`) is a Server Component that starts with:

```tsx
const session = await verifyMemberSession();
if (!session) redirect('/member/login');
```

This check must happen server-side, before any protected UI renders. Never gate protected UI purely on client-side state (e.g. hiding a component after a client fetch resolves) — a directly-pasted URL must never expose protected content even for a flash of a frame.

## Required pattern — API routes
Every API route under `/member`'s API surface independently:
1. Calls `verifyMemberSession()` and rejects if null.
2. Checks `session.role` / permissions for the specific action being performed — the fact that the UI doesn't show a button for a given role is not a security boundary. Assume the API can be called directly.

## OTP specifics
- OTP delivery goes through Brevo/SMTP — don't introduce a second delivery channel without checking `@/lib/memberAuth.ts` first for existing rate-limiting/retry logic.
- Apply rate limiting to the OTP request and verify endpoints specifically (per root AGENTS.md §2) — these are classic brute-force targets since there's no password to slow an attacker down otherwise.

## Session security
- Keep session timeouts short for this portal relative to a typical consumer app — it fronts clinical/admin actions.
- Cookies: secure, `httpOnly`, `sameSite`. CSRF protection on every state-changing request (signature submission included).

---

## Required pattern — Sidebar & Submenu Navigation (/member)

โครงสร้างและการทำงานของแถบเมนูข้าง (Sidebar) และเมนูย่อย (Submenu Groups) ในระบบ `/member`:

### 1. กฎเมนูตั้งต้น: ซ่อนเมนูย่อยไว้ก่อนเสมอ (Default Collapsed)
- **Calm & Clean by Default**: เมื่อผู้ใช้เข้าสู่หน้าระบบสมาชิก เมนูย่อยใน Sidebar ทุกกลุ่มต้องอยู่ในสถานะ **ซ่อน (Collapsed / Hidden)** ตั้งแต่ต้น
- ห้ามเปิดกางเมนูย่อยทุกกลุ่มออกมาพร้อมกันในครั้งแรก เพราะทำให้รกสายตา เกิด Cognitive Load และขัดกับหลักการ UI สะอาด สบายตาของโรงพยาบาลเถิน (`ui-style-brief`)
- ให้ผู้ใช้เป็นคนตัดสินใจคลิกเปิดดูเมนูย่อยเอง (User-driven toggle)

### 2. กฎการจำสถานะ: จดจำเมื่อผู้ใช้เคยกดเปิด/ปิด (State Persistence)
- เมื่อผู้ใช้กดคลิกขยาย (Expand) หรือย่อ (Collapse) กลุ่มเมนูใดก็ตาม ระบบต้องบันทึกสถานะการเปิด/ปิดนั้นลง `localStorage` ทันที
- เมื่อผู้ใช้ Refresh หน้า, เปลี่ยนหน้าในระบบ `/member`, หรือกลับเข้ามาใช้งานใหม่ในภายหลัง ระบบต้องดึงสถานะจาก `localStorage` มา Restore ให้กลุ่มเมนูที่เคยเปิดไว้ยังคงเปิดค้างอยู่ ไม่ดีดกลับไปซ่อนใหม่
- ใช้ Storage Key ที่ระบุเวอร์ชันและขอบเขตชัดเจน เช่น:
  `const SIDEBAR_EXPANDED_KEY = 'thoen_member_sidebar_expanded_v1'`
- ข้อมูลที่จัดเก็บใน Storage: เก็บเป็น Array ของ Group ID (เช่น `['service-requests', 'admin-tools']`) หรือ Record boolean map (`{ [groupId]: boolean }`)
- มี `try...catch` ล้อมรอบการอ่าน/เขียน `localStorage` เสมอ เพื่อป้องกันข้อผิดพลาดในกรณี Private Browsing หรือ Security Restriction

### 3. Next.js Hydration Safety (React 19 / App Router)
- **ห้าม** อ่าน `localStorage` แบบ Synchronous ตอนประกาศ `useState` โดยตรง เพราะจะทำให้เกิด **Hydration Mismatch Error** ระหว่าง Server Render และ Client Hydrate
- **แนวทางที่ถูกต้อง**:
  1. ประกาศ State ด้วยค่าเริ่มต้นเป็นค่าว่าง (เช่น `[]` หรือ `{}` หรือ Set เปล่า)
  2. โหลดสถานะจาก `localStorage` ใน `useEffect` หลัง Mount เสร็จสิ้น
  3. จัดการเรนเดอร์ Transition นุ่มนวล ไม่กระตุก

### 4. Smart Auto-Expand สำหรับ Active Route
- หากผู้ใช้เข้าสู่หน้าปลายทางโดยตรง (เช่น กดเปิดจาก URL, Bookmark, หรือแจ้งเตือนใน Inbox) ให้ตรวจสอบ `pathname` ปัจจุบัน
- หาก `pathname` อยู่ภายใต้กลุ่มเมนูใด ให้ขยาย (Auto-expand) กลุ่มเมนูนั้นโดยอัตโนมัติ เพื่อให้ผู้ใช้ทราบว่าตนเองกำลังทำงานอยู่ที่ตำแหน่งใดในระบบ
- ให้ Merge สถานะกลุ่มที่ Active นี้เข้ากับประวัติใน `localStorage` เพื่อประสบการณ์การใช้งานที่ต่อเนื่อง

### 5. Accessibility & Semantic Controls (a11y)
- ปุ่มหัวข้อกลุ่มเมนู (Group Accordion Header) ต้องเป็น `<button type="button">`
- ระบุ Attribute `aria-expanded={isExpanded}`
- ระบุ `aria-controls={subgroupId}` เชื่อมโยงกับ Submenu Container `<div id={subgroupId}>`
- แสดงไอคอนลูกศร (Chevron) ที่หมุนเปลี่ยนทิศทาง (เช่น `0deg` -> `90deg` หรือ `180deg`) ด้วย CSS transition อย่างนุ่มนวล

---

### Reference Implementation Pattern

```tsx
'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

const STORAGE_KEY = 'thoen_member_sidebar_expanded_v1'

export interface NavSubmenuItem {
  id: string
  label: string
  href: string
  badge?: string | number
}

export interface NavGroup {
  id: string
  title: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  items: NavSubmenuItem[]
}

export function useMemberSubmenuState(groups: NavGroup[]) {
  const pathname = usePathname()
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [isClientLoaded, setIsClientLoaded] = useState(false)

  // 1. ตรวจหากลุ่มเมนูที่ active ตาม pathname ปัจจุบัน
  const activeGroupId = useMemo(() => {
    return groups.find((g) =>
      g.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    )?.id
  }, [groups, pathname])

  // 2. โหลดสถานะที่เคยเปิดไว้จาก localStorage (ตั้งต้นซ่อน ถ้าไม่เคยเปิด)
  useEffect(() => {
    let saved: string[] = []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        saved = JSON.parse(raw)
      }
    } catch (err) {
      console.warn('Failed to load member sidebar state:', err)
    }

    // รวมกลุ่มที่ active ในปัจจุบันเข้ากับกลุ่มที่จำไว้
    if (activeGroupId && !saved.includes(activeGroupId)) {
      saved = [...saved, activeGroupId]
    }

    setExpandedIds(saved)
    setIsClientLoaded(true)
  }, [activeGroupId])

  // 3. ฟังก์ชันสลับการเปิด/ปิด และจำลง storage
  const toggleGroup = useCallback((groupId: string) => {
    setExpandedIds((prev) => {
      const isCurrentlyOpen = prev.includes(groupId)
      const next = isCurrentlyOpen
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (err) {
        console.warn('Failed to save member sidebar state:', err)
      }
      return next
    })
  }, [])

  return {
    expandedIds,
    toggleGroup,
    isClientLoaded,
  }
}

// ตัวอย่าง Component กลุ่มเมนูย่อย
export function MemberSidebarGroup({
  group,
  isExpanded,
  onToggle,
}: {
  group: NavGroup
  isExpanded: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const Icon = group.icon
  const subgroupId = `member-submenu-${group.id}`

  return (
    <div className="sidebarGroup">
      <button
        type="button"
        className={`sidebarGroupHeader ${isExpanded ? 'isExpanded' : ''}`}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={subgroupId}
      >
        <span className="sidebarGroupTitle">
          {Icon && <Icon size={18} className="groupIcon" />}
          <span>{group.title}</span>
        </span>
        <ChevronDown
          size={16}
          className={`chevronIcon ${isExpanded ? 'chevronExpanded' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* ซ่อนเมนูย่อยไว้ก่อน แสดงเฉพาะเมื่อกดเปิด */}
      {isExpanded && (
        <div id={subgroupId} className="sidebarSubmenuList" role="region">
          {group.items.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`sidebarSubmenuItem ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="submenuBadge">{item.badge}</span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

