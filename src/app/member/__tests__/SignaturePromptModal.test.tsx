import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import SignaturePromptModal from '../SignaturePromptModal'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('SignaturePromptModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    sessionStorage.clear()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not render if member already has a signature', () => {
    render(
      <SignaturePromptModal
        hasSignature={true}
        memberId={101}
        isSubdistrict={false}
      />
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.queryByText(/ลงทะเบียนลายเซ็นดิจิทัลของคุณ/)).not.toBeInTheDocument()
  })

  it('does not render for subdistrict (รพ.สต.) members', () => {
    render(
      <SignaturePromptModal
        hasSignature={false}
        memberId={101}
        isSubdistrict={true}
      />
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.queryByText(/ลงทะเบียนลายเซ็นดิจิทัลของคุณ/)).not.toBeInTheDocument()
  })

  it('renders modal when user has no signature after delay', () => {
    render(
      <SignaturePromptModal
        hasSignature={false}
        memberId={101}
        isSubdistrict={false}
        isTelegramPromptOpen={false}
      />
    )

    expect(screen.queryByText(/ลงทะเบียนลายเซ็นดิจิทัลของคุณ/)).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(screen.getByText(/ลงทะเบียนลายเซ็นดิจิทัลของคุณ/)).toBeInTheDocument()
    expect(screen.getByText(/ลงทะเบียนลายเซ็นตอนนี้/)).toBeInTheDocument()
  })

  it('waits while telegram prompt is open, and opens after telegram prompt closes', () => {
    const { rerender } = render(
      <SignaturePromptModal
        hasSignature={false}
        memberId={101}
        isSubdistrict={false}
        isTelegramPromptOpen={true}
      />
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    // Should not be visible while telegram prompt is open
    expect(screen.queryByText(/ลงทะเบียนลายเซ็นดิจิทัลของคุณ/)).not.toBeInTheDocument()

    // Telegram prompt closes
    rerender(
      <SignaturePromptModal
        hasSignature={false}
        memberId={101}
        isSubdistrict={false}
        isTelegramPromptOpen={false}
      />
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // Now it should be visible
    expect(screen.getByText(/ลงทะเบียนลายเซ็นดิจิทัลของคุณ/)).toBeInTheDocument()
  })

  it('navigates to /member/signature when clicking connect button', () => {
    render(
      <SignaturePromptModal
        hasSignature={false}
        memberId={101}
        isSubdistrict={false}
        isTelegramPromptOpen={false}
      />
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const actionBtn = screen.getByRole('button', { name: /ลงทะเบียนลายเซ็นตอนนี้/i })
    fireEvent.click(actionBtn)

    expect(mockPush).toHaveBeenCalledWith('/member/signature')
  })

  it('does NOT snooze in localStorage if closed without checking "วันนี้ไม่แสดงผลอีก"', () => {
    render(
      <SignaturePromptModal
        hasSignature={false}
        memberId={101}
        isSubdistrict={false}
        isTelegramPromptOpen={false}
      />
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const closeBtn = screen.getByRole('button', { name: /ไว้คราวหน้า/i })
    fireEvent.click(closeBtn)

    expect(screen.queryByText(/ลงทะเบียนลายเซ็นดิจิทัลของคุณ/)).not.toBeInTheDocument()
    expect(localStorage.getItem('hide_signature_prompt_101')).toBeNull()
  })

  it('snoozes for the day when checkbox is checked on close', () => {
    render(
      <SignaturePromptModal
        hasSignature={false}
        memberId={101}
        isSubdistrict={false}
        isTelegramPromptOpen={false}
      />
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const checkbox = screen.getByLabelText(/วันนี้ไม่แสดงผลอีก/i)
    fireEvent.click(checkbox)

    const closeBtn = screen.getByRole('button', { name: /ไว้คราวหน้า/i })
    fireEvent.click(closeBtn)

    expect(localStorage.getItem('hide_signature_prompt_101')).not.toBeNull()
  })
})
