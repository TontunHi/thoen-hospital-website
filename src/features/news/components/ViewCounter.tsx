'use client'

import { useEffect } from 'react'

interface ViewCounterProps {
  newsId: number
}

export default function ViewCounter({ newsId }: ViewCounterProps) {
  useEffect(() => {
    try {
      const STORAGE_KEY = 'thoen_viewed_news_ids'
      const now = Date.now()
      const dayInMs = 24 * 60 * 60 * 1000 // 24 hours

      // Get existing viewed history from local storage
      const historyStr = localStorage.getItem(STORAGE_KEY)
      let history: Record<string, number> = {}

      if (historyStr) {
        try {
          history = JSON.parse(historyStr)
        } catch {
          history = {}
        }
      }

      const lastViewedTime = history[newsId.toString()]

      // If already viewed in the last 24 hours, don't increment view count
      if (lastViewedTime && now - lastViewedTime < dayInMs) {
        return
      }

      // Record new view in database
      fetch(`/api/news/${newsId}/view`, {
        method: 'POST'
      })
      .then((res) => {
        if (res.ok) {
          // Update view history in localStorage
          history[newsId.toString()] = now
          localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
        }
      })
      .catch(err => console.error('Failed to log view:', err))

    } catch (e) {
      console.error('Anti-spam view counter error:', e)
    }
  }, [newsId])

  return <span aria-live="polite" style={{ display: 'none' }}></span>
}
