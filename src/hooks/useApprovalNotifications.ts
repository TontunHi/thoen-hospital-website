import { useState, useEffect, useRef } from 'react'
import { MemberSession } from '@/types/member'

interface UseApprovalNotificationsResult {
  pendingCount: number
  showToast: boolean
  setShowToast: (show: boolean) => void
  toastMessage: string
}

/**
 * Custom Hook for polling pending approval tickets and managing desktop/toast notifications
 */
export function useApprovalNotifications(member: MemberSession | null): UseApprovalNotificationsResult {
  const [pendingCount, setPendingCount] = useState<number>(0)
  const [showToast, setShowToast] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const prevCountRef = useRef<number>(0)

  // Polling for pending approvals count
  useEffect(() => {
    if (!member) {
      setPendingCount(0)
      prevCountRef.current = 0
      return
    }

    // Request notification permission if not yet decided
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
      }
    }

    async function fetchCount() {
      try {
        const res = await fetch(`/api/member/approvals/count?t=${Date.now()}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            const count = data.count
            setPendingCount(count)

            // Trigger notification if count has increased
            if (count > prevCountRef.current) {
              setToastMessage(`คุณมีรายการงานอนุมัติใหม่ค้างอยู่ในระบบทั้งหมด ${count} รายการ`)
              setShowToast(true)

              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted' &&
                document.hidden
              ) {
                new Notification('มีงานอนุมัติใหม่เข้ามา 👤', {
                  body: `คุณมีงานรออนุมัติค้างอยู่ในระบบทั้งหมด ${count} รายการ`,
                  icon: '/images/common/logo-website.webp',
                })
              }
            }
            prevCountRef.current = count
          }
        }
      } catch (err) {
        console.error('Failed to fetch approvals count:', err)
      }
    }

    fetchCount() // Initial fetch
    const interval = setInterval(fetchCount, 30000) // Poll every 30 seconds

    return () => clearInterval(interval)
  }, [member])

  // Toast auto-hide
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 7000)
      return () => clearTimeout(timer)
    }
  }, [showToast])

  // Document Title Badge count update
  useEffect(() => {
    if (pendingCount > 0) {
      document.title = `(${pendingCount}) งานรออนุมัติ | โรงพยาบาลเถิน`
    } else {
      document.title = 'โรงพยาบาลเถิน | Thoen Hospital ลำปาง'
    }
  }, [pendingCount])

  return {
    pendingCount,
    showToast,
    setShowToast,
    toastMessage,
  }
}
