'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface UsePollingOptions {
  enabled?: boolean
  immediate?: boolean
}

/**
 * Shared hook for polling APIs with Page Visibility API integration (S1).
 * Automatically pauses polling when tab is hidden to save bandwidth/database load,
 * and immediately refreshes when user returns to the tab.
 */
export function usePolling(
  callback: () => Promise<void> | void,
  intervalMs: number = 15000,
  options: UsePollingOptions = {}
) {
  const { enabled = true, immediate = true } = options
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const savedCallback = useRef(callback)

  // Keep latest callback reference
  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  const execute = useCallback(async () => {
    try {
      await savedCallback.current()
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Polling error:', err)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    if (immediate) {
      execute()
    }

    let timerId: NodeJS.Timeout | null = null

    const startTimer = () => {
      if (timerId) clearInterval(timerId)
      timerId = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          execute()
        }
      }, intervalMs)
    }

    startTimer()

    // Listen to Page Visibility changes (Page Visibility API)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerId) {
          clearInterval(timerId)
          timerId = null
        }
      } else {
        // Tab became visible again: immediate refresh and restart interval
        execute()
        startTimer()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (timerId) clearInterval(timerId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [enabled, intervalMs, immediate, execute])

  return {
    lastUpdated,
    refresh: execute,
  }
}
