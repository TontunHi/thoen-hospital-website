import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TelegramLinkModal from '../TelegramLinkModal'

describe('TelegramLinkModal Component', () => {
  const mockOnClose = vi.fn()
  const mockOnLinked = vi.fn()
  const mockOnUnlinked = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render anything when isOpen is false', () => {
    const { container } = render(
      <TelegramLinkModal
        isOpen={false}
        onClose={mockOnClose}
        onLinked={mockOnLinked}
        onUnlinked={mockOnUnlinked}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('loads status and renders fallback unlinked view with connect button if auto-challenge fails', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/member/telegram' && (!options || options.method === 'GET')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: { isLinked: false }
          })
        })
      }
      if (url === '/api/member/telegram' && options?.method === 'POST') {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: false,
            error: 'ไม่สามารถสร้างลิงก์เชื่อมต่อได้'
          })
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    render(
      <TelegramLinkModal
        isOpen={true}
        onClose={mockOnClose}
        onLinked={mockOnLinked}
        onUnlinked={mockOnUnlinked}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('เชื่อมต่อบัญชี Telegram')).toBeInTheDocument()
    })
    expect(screen.getByText('สิทธิประโยชน์เมื่อเชื่อมต่อระบบ:')).toBeInTheDocument()
  })

  it('automatically generates and displays local QR code when modal opens for unlinked member', async () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/member/telegram' && (!options || options.method === 'GET')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: { isLinked: false }
          })
        })
      }
      if (url === '/api/member/telegram' && options?.method === 'POST') {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: {
              botUrl: 'https://t.me/theon_website_bot?start=challenge_token_123',
              qrCodeUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADIAQMAAACXljzdAAAABlBMVEUAAAD///+l2Z/dAAAA',
              expiresAt: new Date(Date.now() + 600000).toISOString()
            }
          })
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    render(
      <TelegramLinkModal
        isOpen={true}
        onClose={mockOnClose}
        onLinked={mockOnLinked}
        onUnlinked={mockOnUnlinked}
      />
    )

    // Automatically displays QR code without needing user to click connect button!
    await waitFor(() => {
      const qrImg = screen.getByAltText('สแกนเพื่อเชื่อมต่อ Telegram')
      expect(qrImg).toBeInTheDocument()
      expect(qrImg).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'))
    })

    expect(screen.getByText('เปิด Telegram ทันที')).toBeInTheDocument()
    expect(screen.getByText('คัดลอกลิงก์')).toBeInTheDocument()
    expect(screen.getByText('สร้าง QR Code ใหม่')).toBeInTheDocument()
    expect(screen.getByText(/รอการกด \[START\] ในแอป Telegram/)).toBeInTheDocument()
  })

  it('renders linked account information when member is already connected', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url === '/api/member/telegram') {
        return Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            data: {
              isLinked: true,
              telegramUsername: 'thoen_staff',
              firstName: 'หมอเถิน',
              telegramChatIdMasked: '123456789',
              linkedAt: '2026-10-15T10:00:00.000Z',
            }
          })
        })
      }
      return Promise.reject(new Error('Unknown url'))
    })

    render(
      <TelegramLinkModal
        isOpen={true}
        onClose={mockOnClose}
        onLinked={mockOnLinked}
        onUnlinked={mockOnUnlinked}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('เชื่อมต่อบัญชีเรียบร้อยแล้ว')).toBeInTheDocument()
    })
    expect(screen.getByText('@thoen_staff')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByText('ยกเลิกการเชื่อมต่อ')).toBeInTheDocument()
  })
})
