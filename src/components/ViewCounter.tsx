'use client'

import { useEffect } from 'react'

interface ViewCounterProps {
  newsId: number
}

export default function ViewCounter({ newsId }: ViewCounterProps) {
  useEffect(() => {
    // Fire-and-forget request to increment view count with IP anti-spam check
    fetch(`/api/news/${newsId}/view`, {
      method: 'POST'
    }).catch(err => console.error('Failed to log view:', err))
  }, [newsId])

  return null // Render nothing
}
