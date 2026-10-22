import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SmartCardBridgeHub } from '../smartCardBridgeHub'

describe('SmartCardBridgeHub', () => {
  let hub: SmartCardBridgeHub

  beforeEach(() => {
    hub = new SmartCardBridgeHub('test-bridge-secret-2026')
  })

  it('rejects all tokens when secret is not configured (fail-closed)', () => {
    const unconfiguredHub = new SmartCardBridgeHub('')
    expect(unconfiguredHub.verifyToken('any-token')).toBe(false)
    expect(unconfiguredHub.verifyToken('')).toBe(false)
  })

  it('validates bridge secret token correctly', () => {
    expect(hub.verifyToken('test-bridge-secret-2026')).toBe(true)
    expect(hub.verifyToken('wrong-secret')).toBe(false)
    expect(hub.verifyToken('')).toBe(false)
    expect(hub.verifyToken(null)).toBe(false)
  })

  it('handles card_read push and broadcasts to subscribers', () => {
    const subscriber = vi.fn()
    const unsubscribe = hub.subscribe('1', subscriber)

    // First call is initial status on connect
    expect(subscriber).toHaveBeenCalledWith('status', expect.objectContaining({ online: false }))

    subscriber.mockClear()

    const mockCard = {
      cid: '1234567890123',
      fullNameTh: 'นาย สมชาย ใจดี',
      gender: 'ชาย',
    }

    const pushResult = hub.handlePush({
      station: '1',
      action: 'card_read',
      reader: 'USB Card Reader',
      cardPresent: true,
      card: mockCard,
    })

    expect(pushResult.success).toBe(true)
    expect(subscriber).toHaveBeenCalledWith('card', mockCard)
    expect(subscriber).toHaveBeenCalledWith(
      'status',
      expect.objectContaining({ online: true, reader: 'USB Card Reader', cardPresent: true })
    )

    unsubscribe()
  })

  it('handles card_removed push', () => {
    const subscriber = vi.fn()
    hub.subscribe('2', subscriber)
    subscriber.mockClear()

    hub.handlePush({
      station: '2',
      action: 'card_removed',
      reader: 'Reader 2',
      cardPresent: false,
    })

    expect(subscriber).toHaveBeenCalledWith('card_removed', { station: '2' })
    expect(subscriber).toHaveBeenCalledWith(
      'status',
      expect.objectContaining({ online: true, cardPresent: false })
    )
  })
})
