'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  SkipForward,
  Repeat,
  Check,
  Loader2,
  PictureInPicture2,
  RectangleHorizontal,
  Keyboard,
  Sparkles,
  X,
} from 'lucide-react'

export interface NextMediaPreview {
  title: string
  slug: string
  thumbnailUrl?: string | null
  categoryName?: string | null
}

export interface HospitalVideoPlayerProps {
  mediaId: number
  title: string
  streamUrl: string
  posterUrl?: string | null
  allowDownload: boolean
  downloadUrl?: string | null
  isTheaterMode: boolean
  onToggleTheaterMode: () => void
  nextItem?: NextMediaPreview | null
  onNavigateNext?: (slug: string) => void
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const totalSec = Math.floor(seconds)
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

type BezelKind = 'play' | 'pause' | 'volume' | 'mute' | 'speed'

export default function HospitalVideoPlayer({
  mediaId,
  title,
  streamUrl,
  posterUrl,
  allowDownload,
  isTheaterMode,
  onToggleTheaterMode,
  nextItem,
  onNavigateNext,
}: HospitalVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bezelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipRippleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedSecRef = useRef<number>(0)

  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isEnded, setIsEnded] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [bufferedEnd, setBufferedEnd] = useState(0)
  const [showRemainingTime, setShowRemainingTime] = useState(false)

  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [isLooping, setIsLooping] = useState(false)
  const [ambientMode, setAmbientMode] = useState(true)
  const [autoplayNext, setAutoplayNext] = useState(true)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPipActive, setIsPipActive] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [showNextPreview, setShowNextPreview] = useState(false)

  // Scrubbing & Timeline hover state
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [hoverPercent, setHoverPercent] = useState<number | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)

  // Visual feedback overlays (YouTube bezel & skip ripples)
  const [bezelFeedback, setBezelFeedback] = useState<{ kind: BezelKind; label?: string; id: number } | null>(null)
  const [skipRipple, setSkipRipple] = useState<{ side: 'left' | 'right'; seconds: number; id: number } | null>(null)
  const [resumeBannerTime, setResumeBannerTime] = useState<number | null>(null)
  const [upNextCountdown, setUpNextCountdown] = useState<number | null>(null)

  const progressStorageKey = `thoen_media_progress_${mediaId}`

  const triggerBezel = useCallback((kind: BezelKind, label?: string) => {
    if (bezelTimerRef.current) clearTimeout(bezelTimerRef.current)
    setBezelFeedback({ kind, label, id: Date.now() })
    bezelTimerRef.current = setTimeout(() => {
      setBezelFeedback(null)
    }, 650)
  }, [])

  const triggerSkipRipple = useCallback((side: 'left' | 'right', seconds: number) => {
    if (skipRippleTimerRef.current) clearTimeout(skipRippleTimerRef.current)
    setSkipRipple({ side, seconds, id: Date.now() })
    skipRippleTimerRef.current = setTimeout(() => {
      setSkipRipple(null)
    }, 700)
  }, [])

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current)
    setControlsVisible(true)
    hideControlsTimerRef.current = setTimeout(() => {
      const video = videoRef.current
      if (video && !video.paused && !video.ended && !settingsOpen && !isScrubbing) {
        setControlsVisible(false)
      }
    }, 2800)
  }, [settingsOpen, isScrubbing])

  // Restore user preferences (volume, mute, autoplay, ambient)
  useEffect(() => {
    try {
      const savedVol = localStorage.getItem('thoen_player_volume')
      const savedMuted = localStorage.getItem('thoen_player_muted')
      const savedAutoplay = localStorage.getItem('thoen_player_autoplay')
      const savedAmbient = localStorage.getItem('thoen_player_ambient')

      const v = videoRef.current
      if (savedVol !== null) {
        const parsed = Math.max(0, Math.min(1, parseFloat(savedVol)))
        if (Number.isFinite(parsed)) {
          setVolume(parsed)
          if (v) v.volume = parsed
        }
      }
      if (savedMuted !== null) {
        const muted = savedMuted === 'true'
        setIsMuted(muted)
        if (v) v.muted = muted
      }
      if (savedAutoplay !== null) {
        setAutoplayNext(savedAutoplay === 'true')
      }
      if (savedAmbient !== null) {
        setAmbientMode(savedAmbient === 'true')
      }
    } catch {
      // Ignore storage access errors
    }
  }, [])

  // Fullscreen & PiP listeners
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    const video = videoRef.current
    const handleEnterPip = () => setIsPipActive(true)
    const handleLeavePip = () => setIsPipActive(false)

    document.addEventListener('fullscreenchange', handleFsChange)
    if (video) {
      video.addEventListener('enterpictureinpicture', handleEnterPip)
      video.addEventListener('leavepictureinpicture', handleLeavePip)
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange)
      if (video) {
        video.removeEventListener('enterpictureinpicture', handleEnterPip)
        video.removeEventListener('leavepictureinpicture', handleLeavePip)
      }
    }
  }, [])

  // Close settings menu on outside click
  useEffect(() => {
    if (!settingsOpen) return
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target?.closest('.ytSettingsWrapper')) {
        setSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleDocClick)
    return () => document.removeEventListener('mousedown', handleDocClick)
  }, [settingsOpen])

  // Autoplay next countdown when video ends
  useEffect(() => {
    if (!isEnded || isLooping || !nextItem || !autoplayNext || !onNavigateNext) {
      setUpNextCountdown(null)
      return
    }
    setUpNextCountdown(5)
    const interval = setInterval(() => {
      setUpNextCountdown((prev) => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(interval)
          onNavigateNext(nextItem.slug)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isEnded, isLooping, nextItem, autoplayNext, onNavigateNext])

  const updateBuffered = useCallback(() => {
    const v = videoRef.current
    if (!v || !v.buffered || v.buffered.length === 0) return
    try {
      const curr = v.currentTime
      let end = 0
      for (let i = 0; i < v.buffered.length; i++) {
        if (v.buffered.start(i) <= curr && v.buffered.end(i) >= curr) {
          end = v.buffered.end(i)
          break
        }
      }
      if (end === 0) {
        end = v.buffered.end(v.buffered.length - 1)
      }
      setBufferedEnd(end)
    } catch {
      // Ignore range index errors
    }
  }, [])

  const togglePlay = useCallback(
    (showBezel = true) => {
      const v = videoRef.current
      if (!v) return
      setUpNextCountdown(null)

      if (v.paused || v.ended) {
        if (v.ended) {
          v.currentTime = 0
          setIsEnded(false)
        }
        v.play()
          .then(() => {
            setIsPlaying(true)
            setHasStarted(true)
            if (showBezel) triggerBezel('play')
            scheduleHideControls()
          })
          .catch(() => {
            setIsPlaying(false)
          })
      } else {
        v.pause()
        setIsPlaying(false)
        setControlsVisible(true)
        if (showBezel) triggerBezel('pause')
      }
    },
    [scheduleHideControls, triggerBezel]
  )

  const seekTo = useCallback(
    (targetSec: number) => {
      const v = videoRef.current
      if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return
      const clamped = Math.max(0, Math.min(v.duration, targetSec))
      v.currentTime = clamped
      setCurrentTime(clamped)
      setIsEnded(false)
      setUpNextCountdown(null)
    },
    []
  )

  const skipSeconds = useCallback(
    (deltaSec: number) => {
      const v = videoRef.current
      if (!v) return
      seekTo(v.currentTime + deltaSec)
      triggerSkipRipple(deltaSec < 0 ? 'left' : 'right', Math.abs(deltaSec))
      scheduleHideControls()
    },
    [seekTo, triggerSkipRipple, scheduleHideControls]
  )

  const changeVolume = useCallback(
    (newVol: number, showBezel = false) => {
      const v = videoRef.current
      const clamped = Math.max(0, Math.min(1, newVol))
      setVolume(clamped)
      const shouldMute = clamped === 0
      setIsMuted(shouldMute)
      if (v) {
        v.volume = clamped
        v.muted = shouldMute
      }
      try {
        localStorage.setItem('thoen_player_volume', String(clamped))
        localStorage.setItem('thoen_player_muted', String(shouldMute))
      } catch {
        // Ignore storage errors
      }
      if (showBezel) {
        triggerBezel(shouldMute ? 'mute' : 'volume', `${Math.round(clamped * 100)}%`)
      }
    },
    [triggerBezel]
  )

  const toggleMute = useCallback(
    (showBezel = true) => {
      const v = videoRef.current
      if (!v) return
      const nextMuted = !isMuted
      setIsMuted(nextMuted)
      v.muted = nextMuted
      if (!nextMuted && volume === 0) {
        setVolume(0.6)
        v.volume = 0.6
      }
      try {
        localStorage.setItem('thoen_player_muted', String(nextMuted))
      } catch {
        // Ignore
      }
      if (showBezel) {
        triggerBezel(nextMuted ? 'mute' : 'volume', nextMuted ? 'ปิดเสียง' : `${Math.round((volume || 0.6) * 100)}%`)
      }
    },
    [isMuted, volume, triggerBezel]
  )

  const changeSpeed = useCallback(
    (speed: number) => {
      const v = videoRef.current
      setPlaybackSpeed(speed)
      if (v) {
        v.playbackRate = speed
      }
      triggerBezel('speed', `${speed}x`)
    },
    [triggerBezel]
  )

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current
    if (!el) return
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // Fallback for iOS Safari native video fullscreen
      const v = videoRef.current as any
      if (v?.webkitEnterFullscreen) {
        v.webkitEnterFullscreen()
      }
    }
  }, [])

  const togglePip = useCallback(async () => {
    const v = videoRef.current as any
    if (!v) return
    try {
      if (document.pictureInPictureElement) {
        await (document as any).exitPictureInPicture()
      } else if (v.requestPictureInPicture) {
        await v.requestPictureInPicture()
      }
    } catch {
      // Ignore if PiP not supported by browser
    }
  }, [])

  // Pointer scrubbing on timeline bar
  const calculateTimelinePosition = useCallback(
    (clientX: number) => {
      const bar = timelineRef.current
      if (!bar || duration <= 0) return null
      const rect = bar.getBoundingClientRect()
      if (rect.width <= 0) return null
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return {
        percent: ratio * 100,
        time: ratio * duration,
      }
    },
    [duration]
  )

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pos = calculateTimelinePosition(e.clientX)
    if (!pos) return
    setHoverPercent(pos.percent)
    setHoverTime(pos.time)
    if (isScrubbing) {
      seekTo(pos.time)
    }
  }

  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pos = calculateTimelinePosition(e.clientX)
    if (!pos) return
    setIsScrubbing(true)
    seekTo(pos.time)

    const handleWindowMove = (ev: PointerEvent) => {
      const movePos = calculateTimelinePosition(ev.clientX)
      if (movePos) {
        setHoverPercent(movePos.percent)
        setHoverTime(movePos.time)
        seekTo(movePos.time)
      }
    }
    const handleWindowUp = () => {
      setIsScrubbing(false)
      window.removeEventListener('pointermove', handleWindowMove)
      window.removeEventListener('pointerup', handleWindowUp)
    }
    window.addEventListener('pointermove', handleWindowMove)
    window.addEventListener('pointerup', handleWindowUp)
  }

  // Stage single-click (Play/Pause) vs double-click (Left: -10s, Right: +10s, Center: Fullscreen)
  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / Math.max(1, rect.width)

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      if (relX < 0.32) {
        skipSeconds(-10)
      } else if (relX > 0.68) {
        skipSeconds(10)
      } else {
        toggleFullscreen()
      }
      return
    }

    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      togglePlay(true)
    }, 210)
  }

  // YouTube Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return
      }

      const key = e.key.toLowerCase()

      if (key === ' ' || key === 'k') {
        e.preventDefault()
        togglePlay(true)
      } else if (key === 'j') {
        e.preventDefault()
        skipSeconds(-10)
      } else if (key === 'l') {
        e.preventDefault()
        skipSeconds(10)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        skipSeconds(-5)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        skipSeconds(5)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        changeVolume((isMuted ? 0 : volume) + 0.05, true)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        changeVolume((isMuted ? 0 : volume) - 0.05, true)
      } else if (key === 'm') {
        e.preventDefault()
        toggleMute(true)
      } else if (key === 'f') {
        e.preventDefault()
        toggleFullscreen()
      } else if (key === 't') {
        e.preventDefault()
        onToggleTheaterMode()
      } else if (key === 'i') {
        e.preventDefault()
        togglePip()
      } else if (e.key === '>' || (e.shiftKey && e.key === '.')) {
        e.preventDefault()
        const idx = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
        if (idx >= 0 && idx < PLAYBACK_SPEEDS.length - 1) {
          changeSpeed(PLAYBACK_SPEEDS[idx + 1])
        }
      } else if (e.key === '<' || (e.shiftKey && e.key === ',')) {
        e.preventDefault()
        const idx = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
        if (idx > 0) {
          changeSpeed(PLAYBACK_SPEEDS[idx - 1])
        }
      } else if (e.key === '?') {
        e.preventDefault()
        setShortcutsOpen((prev) => !prev)
      } else if (/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        const digit = parseInt(e.key, 10)
        if (duration > 0) {
          seekTo((digit / 10) * duration)
          scheduleHideControls()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    togglePlay,
    skipSeconds,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    onToggleTheaterMode,
    togglePip,
    changeSpeed,
    playbackSpeed,
    isMuted,
    volume,
    duration,
    seekTo,
    scheduleHideControls,
  ])

  const playedPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0

  return (
    <div
      ref={containerRef}
      className={`ytPlayerContainer ${ambientMode ? 'ambientEnabled' : ''} ${
        !controlsVisible && isPlaying ? 'cursorHidden' : ''
      } ${isFullscreen ? 'isFullscreen' : ''}`}
      onMouseMove={scheduleHideControls}
      onMouseLeave={() => {
        if (isPlaying && !settingsOpen && !isScrubbing) {
          setControlsVisible(false)
        }
      }}
      onContextMenu={!allowDownload ? (e) => e.preventDefault() : undefined}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={streamUrl}
        poster={posterUrl || undefined}
        playsInline
        preload="metadata"
        loop={isLooping}
        controlsList={allowDownload ? undefined : 'nodownload'}
        className="ytVideoElement"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          setDuration(v.duration || 0)
          v.volume = volume
          v.muted = isMuted
          v.playbackRate = playbackSpeed

          // Check saved progress (> 10s and < 95% of duration)
          try {
            const savedSec = parseFloat(localStorage.getItem(progressStorageKey) || '0')
            if (Number.isFinite(savedSec) && savedSec > 10 && v.duration && savedSec < v.duration * 0.95) {
              v.currentTime = savedSec
              setCurrentTime(savedSec)
              setResumeBannerTime(savedSec)
              setTimeout(() => setResumeBannerTime(null), 6500)
            }
          } catch {
            // Ignore
          }
        }}
        onTimeUpdate={(e) => {
          const curr = e.currentTarget.currentTime
          setCurrentTime(curr)
          updateBuffered()

          // Persist playback progress every 4 seconds
          if (Math.abs(curr - lastSavedSecRef.current) >= 4) {
            lastSavedSecRef.current = curr
            try {
              localStorage.setItem(progressStorageKey, String(Math.floor(curr)))
            } catch {
              // Ignore
            }
          }
        }}
        onProgress={updateBuffered}
        onPlay={() => {
          setIsPlaying(true)
          setHasStarted(true)
          setIsEnded(false)
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onPlaying={() => setIsBuffering(false)}
        onEnded={() => {
          setIsPlaying(false)
          setIsEnded(true)
          setControlsVisible(true)
          try {
            localStorage.removeItem(progressStorageKey)
          } catch {
            // Ignore
          }
        }}
      >
        เบราว์เซอร์ของคุณไม่รองรับการเล่นวิดีโอ HTML5
      </video>

      {/* Clickable Stage Overlay */}
      <div className="ytStageClickArea" onClick={handleStageClick} aria-label={title}>
        {/* Top Gradient Title Bar in Fullscreen or Paused */}
        <div className={`ytTopBar ${controlsVisible || !isPlaying ? 'visible' : ''}`}>
          <div className="ytTopTitle">{title}</div>
          {resumeBannerTime !== null && (
            <div className="ytResumePill" onClick={(e) => e.stopPropagation()}>
              <span>เล่นต่อจาก {formatVideoTime(resumeBannerTime)}</span>
              <button
                type="button"
                className="ytResumeResetBtn"
                onClick={() => {
                  seekTo(0)
                  setResumeBannerTime(null)
                }}
              >
                เริ่มตั้งแต่ต้น
              </button>
            </div>
          )}
        </div>

        {/* Initial Big Play Button Overlay */}
        {!hasStarted && !isPlaying && (
          <button
            type="button"
            className="ytHeroPlayButton"
            aria-label="เริ่มเล่นวิดีโอ"
            onClick={(e) => {
              e.stopPropagation()
              togglePlay(false)
            }}
          >
            <Play size={34} fill="#ffffff" strokeWidth={1.5} style={{ marginLeft: 3 }} />
          </button>
        )}

        {/* Buffering Spinner */}
        {isBuffering && isPlaying && (
          <div className="ytBufferingSpinner" aria-label="กำลังโหลดวิดีโอ">
            <Loader2 size={44} className="ytSpinIcon" />
          </div>
        )}

        {/* Center Bezel Action Pulse (Play/Pause/Volume/Speed) */}
        {bezelFeedback && (
          <div key={bezelFeedback.id} className="ytBezelWrapper" aria-hidden="true">
            <div className="ytBezelCircle">
              {bezelFeedback.kind === 'play' && <Play size={28} fill="#ffffff" style={{ marginLeft: 2 }} />}
              {bezelFeedback.kind === 'pause' && <Pause size={28} fill="#ffffff" />}
              {bezelFeedback.kind === 'mute' && <VolumeX size={28} />}
              {bezelFeedback.kind === 'volume' && <Volume2 size={28} />}
              {bezelFeedback.kind === 'speed' && <Sparkles size={24} />}
            </div>
            {bezelFeedback.label && <div className="ytBezelLabel">{bezelFeedback.label}</div>}
          </div>
        )}

        {/* Double-Click Left/Right Skip Ripple (-10s / +10s) */}
        {skipRipple && (
          <div
            key={skipRipple.id}
            className={`ytSkipRipple ${skipRipple.side === 'left' ? 'left' : 'right'}`}
            aria-hidden="true"
          >
            <div className="ytSkipRippleContent">
              {skipRipple.side === 'left' ? <RotateCcw size={26} /> : <RotateCw size={26} />}
              <span>{skipRipple.seconds} วินาที</span>
            </div>
          </div>
        )}

        {/* Up Next End Screen Overlay */}
        {isEnded && !isLooping && nextItem && onNavigateNext && (
          <div className="ytEndScreenOverlay" onClick={(e) => e.stopPropagation()}>
            <div className="ytEndScreenCard">
              <div className="ytEndScreenLabel">
                {upNextCountdown !== null
                  ? `กำลังเล่นวิดีโอถัดไปใน ${upNextCountdown} วินาที...`
                  : 'วิดีโอถัดไป'}
              </div>
              <div className="ytEndScreenBody">
                {nextItem.thumbnailUrl && (
                  <img src={nextItem.thumbnailUrl} alt="" className="ytEndScreenThumb" />
                )}
                <div className="ytEndScreenInfo">
                  <div className="ytEndScreenTitle">{nextItem.title}</div>
                  {nextItem.categoryName && (
                    <div className="ytEndScreenCategory">{nextItem.categoryName}</div>
                  )}
                </div>
              </div>
              <div className="ytEndScreenActions">
                <button
                  type="button"
                  className="ytEndBtn ytEndBtnSecondary"
                  onClick={() => {
                    setUpNextCountdown(null)
                    togglePlay(false)
                  }}
                >
                  <RotateCcw size={15} />
                  <span>เล่นซ้ำ</span>
                </button>
                {upNextCountdown !== null && (
                  <button
                    type="button"
                    className="ytEndBtn ytEndBtnSecondary"
                    onClick={() => setUpNextCountdown(null)}
                  >
                    <span>ยกเลิก</span>
                  </button>
                )}
                <button
                  type="button"
                  className="ytEndBtn ytEndBtnPrimary"
                  onClick={() => onNavigateNext(nextItem.slug)}
                >
                  <Play size={15} fill="#ffffff" />
                  <span>เล่นทันที</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom YouTube Controls Overlay */}
      <div
        className={`ytControlsBottom ${controlsVisible || !isPlaying || settingsOpen ? 'visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubbing Timeline Bar */}
        <div
          ref={timelineRef}
          className={`ytTimelineContainer ${isScrubbing ? 'scrubbing' : ''}`}
          role="slider"
          aria-label="แถบเวลาวิดีโอ"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          onPointerMove={handleTimelinePointerMove}
          onPointerLeave={() => {
            if (!isScrubbing) {
              setHoverPercent(null)
              setHoverTime(null)
            }
          }}
          onPointerDown={handleTimelinePointerDown}
        >
          {/* Floating Timestamp Preview on Hover */}
          {hoverPercent !== null && hoverTime !== null && duration > 0 && (
            <div
              className="ytTimelineTooltip"
              style={{
                left: `${Math.max(4, Math.min(96, hoverPercent))}%`,
              }}
            >
              {formatVideoTime(hoverTime)}
            </div>
          )}

          <div className="ytTimelineTrack">
            {/* Buffered Bar */}
            <div className="ytTimelineBuffered" style={{ width: `${bufferedPercent}%` }} />
            {/* Hover Ghost Bar */}
            {hoverPercent !== null && (
              <div className="ytTimelineHover" style={{ width: `${hoverPercent}%` }} />
            )}
            {/* Active Played Bar */}
            <div className="ytTimelinePlayed" style={{ width: `${playedPercent}%` }}>
              <span className="ytTimelineThumb" />
            </div>
          </div>
        </div>

        {/* Control Buttons Row */}
        <div className="ytControlsRow">
          {/* Left Group */}
          <div className="ytControlsLeft">
            <button
              type="button"
              className="ytCtrlBtn"
              onClick={() => togglePlay(false)}
              title={isEnded ? 'เล่นอีกครั้ง' : isPlaying ? 'หยุดชั่วคราว (k)' : 'เล่น (k)'}
              aria-label={isEnded ? 'เล่นอีกครั้ง' : isPlaying ? 'หยุดชั่วคราว' : 'เล่น'}
            >
              {isEnded ? (
                <RotateCcw size={20} />
              ) : isPlaying ? (
                <Pause size={21} fill="#ffffff" />
              ) : (
                <Play size={21} fill="#ffffff" />
              )}
            </button>

            <button
              type="button"
              className="ytCtrlBtn"
              onClick={() => skipSeconds(-10)}
              title="ย้อนกลับ 10 วินาที (j)"
              aria-label="ย้อนกลับ 10 วินาที"
            >
              <RotateCcw size={18} />
            </button>

            <button
              type="button"
              className="ytCtrlBtn"
              onClick={() => skipSeconds(10)}
              title="เดินหน้า 10 วินาที (l)"
              aria-label="เดินหน้า 10 วินาที"
            >
              <RotateCw size={18} />
            </button>

            {nextItem && onNavigateNext && (
              <div
                className="ytNextBtnWrapper"
                onMouseEnter={() => setShowNextPreview(true)}
                onMouseLeave={() => setShowNextPreview(false)}
              >
                <button
                  type="button"
                  className="ytCtrlBtn"
                  onClick={() => onNavigateNext(nextItem.slug)}
                  aria-label={`วิดีโอถัดไป: ${nextItem.title}`}
                >
                  <SkipForward size={19} fill="#ffffff" />
                </button>
                {showNextPreview && (
                  <div className="ytNextHoverCard">
                    <div className="ytNextHoverLabel">ถัดไป</div>
                    <div className="ytNextHoverTitle">{nextItem.title}</div>
                  </div>
                )}
              </div>
            )}

            {/* Volume Control with Expanding Slider */}
            <div className="ytVolumeGroup">
              <button
                type="button"
                className="ytCtrlBtn"
                onClick={() => toggleMute(false)}
                title={isMuted ? 'เปิดเสียง (m)' : 'ปิดเสียง (m)'}
                aria-label={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={20} />
                ) : volume < 0.5 ? (
                  <Volume1 size={20} />
                ) : (
                  <Volume2 size={20} />
                )}
              </button>
              <div className="ytVolumeSliderWrap">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => changeVolume(parseFloat(e.target.value), false)}
                  className="ytVolumeSlider"
                  aria-label="ระดับเสียง"
                />
              </div>
            </div>

            {/* Time Display */}
            <button
              type="button"
              className="ytTimeDisplay"
              onClick={() => setShowRemainingTime((prev) => !prev)}
              title="คลิกเพื่อสลับเวลาที่ผ่านไป / เวลาที่เหลือ"
            >
              <span>
                {showRemainingTime && duration > 0
                  ? `-${formatVideoTime(Math.max(0, duration - currentTime))}`
                  : formatVideoTime(currentTime)}
              </span>
              <span className="ytTimeSep">/</span>
              <span>{formatVideoTime(duration)}</span>
            </button>
          </div>

          {/* Right Group */}
          <div className="ytControlsRight">
            {/* Autoplay Next Switch */}
            {nextItem && (
              <button
                type="button"
                className={`ytAutoplayToggle ${autoplayNext ? 'on' : ''}`}
                onClick={() => {
                  const nextVal = !autoplayNext
                  setAutoplayNext(nextVal)
                  try {
                    localStorage.setItem('thoen_player_autoplay', String(nextVal))
                  } catch {
                    // Ignore
                  }
                }}
                title={`เล่นถัดไปอัตโนมัติ: ${autoplayNext ? 'เปิด' : 'ปิด'}`}
                aria-label="เล่นวิดีโอถัดไปอัตโนมัติ"
              >
                <span className="ytAutoplayTrack">
                  <span className="ytAutoplayThumb">
                    {autoplayNext ? <Play size={9} fill="#0f172a" /> : <Pause size={9} />}
                  </span>
                </span>
              </button>
            )}

            {/* Settings Popup Menu */}
            <div className="ytSettingsWrapper">
              <button
                type="button"
                className={`ytCtrlBtn ytSettingsBtn ${settingsOpen ? 'active' : ''}`}
                onClick={() => setSettingsOpen((prev) => !prev)}
                title="การตั้งค่า"
                aria-label="การตั้งค่าตัวเล่นวิดีโอ"
              >
                <Settings size={19} />
                {playbackSpeed !== 1 && (
                  <span className="ytSpeedBadge">{playbackSpeed}x</span>
                )}
              </button>

              {settingsOpen && (
                <div className="ytSettingsMenu" role="menu" aria-label="เมนูตั้งค่าวิดีโอ">
                  <div className="ytSettingsSection">
                    <div className="ytSettingsHeader">ความเร็วในการเล่น</div>
                    <div className="ytSpeedGrid">
                      {PLAYBACK_SPEEDS.map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          className={`ytSpeedChoice ${playbackSpeed === spd ? 'active' : ''}`}
                          onClick={() => changeSpeed(spd)}
                        >
                          {spd === 1 ? 'ปกติ' : `${spd}x`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ytSettingsDivider" />

                  <button
                    type="button"
                    className="ytSettingsMenuItem"
                    onClick={() => setIsLooping((prev) => !prev)}
                  >
                    <div className="ytSettingsItemLabel">
                      <Repeat size={15} />
                      <span>เล่นวนซ้ำ (Loop)</span>
                    </div>
                    <span className={`ytSettingsState ${isLooping ? 'on' : ''}`}>
                      {isLooping ? (
                        <>
                          <Check size={14} /> เปิด
                        </>
                      ) : (
                        'ปิด'
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="ytSettingsMenuItem"
                    onClick={() => {
                      onToggleTheaterMode()
                    }}
                  >
                    <div className="ytSettingsItemLabel">
                      <Sparkles size={15} />
                      <span>โหมดโรงภาพยนตร์ (พื้นหลังมืด)</span>
                    </div>
                    <span className={`ytSettingsState ${isTheaterMode ? 'on' : ''}`}>
                      {isTheaterMode ? (
                        <>
                          <Check size={14} /> เปิด
                        </>
                      ) : (
                        'ปิด'
                      )}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="ytSettingsMenuItem"
                    onClick={() => {
                      setSettingsOpen(false)
                      setShortcutsOpen(true)
                    }}
                  >
                    <div className="ytSettingsItemLabel">
                      <Keyboard size={15} />
                      <span>ปุ่มลัดแป้นพิมพ์</span>
                    </div>
                    <span className="ytSettingsState">?</span>
                  </button>
                </div>
              )}
            </div>

            {/* Picture in Picture */}
            <button
              type="button"
              className={`ytCtrlBtn ${isPipActive ? 'active' : ''}`}
              onClick={togglePip}
              title="เล่นภาพซ้อนภาพ (i)"
              aria-label="เล่นภาพซ้อนภาพ"
            >
              <PictureInPicture2 size={19} />
            </button>

            {/* Theater Mode */}
            {!isFullscreen && (
              <button
                type="button"
                className={`ytCtrlBtn ${isTheaterMode ? 'active' : ''}`}
                onClick={onToggleTheaterMode}
                title={isTheaterMode ? 'มุมมองเริ่มต้น (t)' : 'โหมดโรงภาพยนตร์ (t)'}
                aria-label="สลับโหมดโรงภาพยนตร์"
              >
                <RectangleHorizontal size={20} />
              </button>
            )}

            {/* Fullscreen */}
            <button
              type="button"
              className="ytCtrlBtn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'ออกจากเต็มหน้าจอ (f)' : 'เต็มหน้าจอ (f)'}
              aria-label={isFullscreen ? 'ออกจากเต็มหน้าจอ' : 'เต็มหน้าจอ'}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {shortcutsOpen && (
        <div
          className="ytShortcutsOverlay"
          onClick={() => setShortcutsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="ปุ่มลัดแป้นพิมพ์"
        >
          <div className="ytShortcutsCard" onClick={(e) => e.stopPropagation()}>
            <div className="ytShortcutsHeader">
              <div className="ytShortcutsTitle">
                <Keyboard size={18} />
                <span>ปุ่มลัดแป้นพิมพ์ (เหมือน YouTube)</span>
              </div>
              <button
                type="button"
                className="ytShortcutsClose"
                onClick={() => setShortcutsOpen(false)}
                aria-label="ปิดหน้าต่างปุ่มลัด"
              >
                <X size={18} />
              </button>
            </div>
            <div className="ytShortcutsGrid">
              <div className="ytShortcutRow">
                <span>เล่น / หยุดชั่วคราว</span>
                <kbd>Space</kbd> หรือ <kbd>K</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>ย้อนกลับ / เดินหน้า 10 วินาที</span>
                <kbd>J</kbd> / <kbd>L</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>ย้อนกลับ / เดินหน้า 5 วินาที</span>
                <kbd>←</kbd> / <kbd>→</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>เพิ่ม / ลดระดับเสียง</span>
                <kbd>↑</kbd> / <kbd>↓</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>ปิด / เปิดเสียง</span>
                <kbd>M</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>เต็มหน้าจอ</span>
                <kbd>F</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>โหมดโรงภาพยนตร์</span>
                <kbd>T</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>ภาพซ้อนภาพ (Miniplayer)</span>
                <kbd>I</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>ลด / เพิ่มความเร็ว</span>
                <kbd>&lt;</kbd> / <kbd>&gt;</kbd>
              </div>
              <div className="ytShortcutRow">
                <span>ข้ามไปยังช่วง 0% - 90%</span>
                <kbd>0</kbd> - <kbd>9</kbd>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
