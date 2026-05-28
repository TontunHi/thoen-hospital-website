'use client'

import { useState } from 'react'

export default function LogoutButton() {
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)

    try {
      await fetch('/api/salary/logout', {
        method: 'POST',
      })
      // Force reload to completely clear router state and redirect
      window.location.href = '/salary/login'
    } catch (err) {
      console.error('Logout failed:', err)
      setLoading(false)
    }
  }

  return (
    <button 
      onClick={handleLogout} 
      className="btn btn-outline btn-sm salaryLogoutBtn"
      disabled={loading}
    >
      {loading ? 'กำลังออก...' : '🚪 ออกจากระบบ'}
    </button>
  )
}
