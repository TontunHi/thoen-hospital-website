import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import TelegramPromptModal from '../TelegramPromptModal'

describe('TelegramPromptModal Component', () => {
  const mockOnOpenConnectModal = vi.fn()
  const mockOnVisibilityChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not render if member is already linked to Telegram', () => {
    render(
      <TelegramPromptModal
        isLinked={true}
        memberId={101}
        onOpenConnectModal={mockOnOpenConnectModal}
        onVisibilityChange={mockOnVisibilityChange}
      />
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.queryByText(/เชื่อมต่อ Telegram เพื่อรับการแจ้งเตือน/)).not.toBeInTheDocument()
  })

  it('renders modal when user is not linked after delay and calls onVisibilityChange', () => {
    render(
      <TelegramPromptModal
        isLinked={false}
        memberId={101}
        onOpenConnectModal={mockOnOpenConnectModal}
        onVisibilityChange={mockOnVisibilityChange}
      />
    )

    expect(screen.queryByText(/เชื่อมต่อ Telegram เพื่อรับการแจ้งเตือน/)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(800)
    })

    expect(screen.getByText(/เชื่อมต่อ Telegram เพื่อรับการแจ้งเตือน/)).toBeInTheDocument()
    expect(mockOnVisibilityChange).toHaveBeenCalledWith(true)
  })

  it('does NOT snooze in localStorage if closed without checking "วันนี้ไม่แสดงผลอีก"', () => {
    render(
      <TelegramPromptModal
        isLinked={false}
        memberId={101}
        onOpenConnectModal={mockOnOpenConnectModal}
        onVisibilityChange={mockOnVisibilityChange}
      />
    )

    act(() => {
      vi.advanceTimersByTime(800)
    })

    const closeBtn = screen.getByRole('button', { name: /ไว้คราวหน้า/i })
    fireEvent.click(closeBtn)

    expect(screen.queryByText(/เชื่อมต่อ Telegram เพื่อรับการแจ้งเตือน/)).not.toBeInTheDocument()
    expect(localStorage.getItem('hide_telegram_prompt_101')).toBeNull()
    expect(mockOnVisibilityChange).toHaveBeenCalledWith(false)
  })

  it('snoozes in localStorage until end of day when checkbox is checked on close', () => {
    render(
      <TelegramPromptModal
        isLinked={false}
        memberId={101}
        onOpenConnectModal={mockOnOpenConnectModal}
        onVisibilityChange={mockOnVisibilityChange}
      />
    )

    act(() => {
      vi.advanceTimersByTime(800)
    })

    const checkbox = screen.getByLabelText(/วันนี้ไม่แสดงผลอีก/i)
    fireEvent.click(checkbox)

    const closeBtn = screen.getByRole('button', { name: /ไว้คราวหน้า/i })
    fireEvent.click(closeBtn)

    expect(localStorage.getItem('hide_telegram_prompt_101')).not.toBeNull()
  })

  it('calls onOpenConnectModal when clicking connect button', () => {
    render(
      <TelegramPromptModal
        isLinked={false}
        memberId={101}
        onOpenConnectModal={mockOnOpenConnectModal}
        onVisibilityChange={mockOnVisibilityChange}
      />
    )

    act(() => {
      vi.advanceTimersByTime(800)
    })

    const connectBtn = screen.getByRole('button', { name: /เชื่อมต่อ Telegram เลย/i })
    fireEvent.click(connectBtn)

    expect(mockOnOpenConnectModal).toHaveBeenCalledTimes(1)
  })
})
