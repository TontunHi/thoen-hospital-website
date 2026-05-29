'use client'

import { useState } from 'react'

export default function MemberLogoutButton() {
  const [loading, setLoading] = useState(false)

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
    }
  }

  return (
    <button 
      onClick={handleLogout} 
      className="memberLogoutBtn"
      disabled={loading}
    >
      {loading ? 'กำลังออกจากระบบ...' : 'ออกจากระบบ'}
    </button>
  )
}
