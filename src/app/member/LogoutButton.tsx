'use client'

import { useState } from 'react'
import { LogOut, Loader2 } from 'lucide-react'

export default function MemberLogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    if (!confirm('ยืนยันว่าต้องการออกจากระบบใช่หรือไม่?')) return
    setLoading(true)

    try {
      await fetch('/api/member/logout', {
        method: 'POST',
      })
      window.location.href = '/member/login'
    } catch (err) {
      console.error('Logout failed:', err)
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleLogout} 
      className="memberLogoutBtn"
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={16} />
      ) : (
        <LogOut size={16} />
      )}
      <span>{loading ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}</span>
    </button>
  )
}
