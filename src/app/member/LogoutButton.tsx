'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

export default function MemberLogoutButton() {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)

    try {
      await fetch('/api/member/logout', {
        method: 'POST',
      })
      window.location.href = '/member/login'
    } catch (err) {
      console.error('Logout failed:', err)
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <>
      <button 
        onClick={() => setShowConfirm(true)} 
        className="memberLogoutBtn"
        disabled={loading}
        type="button"
      >
        {loading ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <LogOut size={16} />
        )}
        <span>{loading ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}</span>
      </button>

      <ConfirmDialog
        isOpen={showConfirm}
        title="ยืนยันการออกจากระบบ"
        description="คุณต้องการออกจากระบบเจ้าหน้าที่โรงพยาบาลเถินใช่หรือไม่?"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        type="warning"
        loading={loading}
        onConfirm={handleLogout}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}
