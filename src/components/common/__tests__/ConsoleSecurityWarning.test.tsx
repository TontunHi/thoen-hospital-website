import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConsoleSecurityWarning, {
  CONSOLE_WARNING_SHOWN_KEY,
} from '@/components/common/ConsoleSecurityWarning'

describe('ConsoleSecurityWarning', () => {
  beforeEach(() => {
    delete (globalThis as Record<symbol, boolean>)[CONSOLE_WARNING_SHOWN_KEY]
  })

  it('renders nothing to the DOM and logs Self-XSS warning once', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { container, rerender } = render(<ConsoleSecurityWarning />)
    rerender(<ConsoleSecurityWarning />)

    expect(container).toBeEmptyDOMElement()
    expect(logSpy).toHaveBeenCalledTimes(2)
    expect(logSpy.mock.calls[0]?.[0]).toContain('หยุดก่อน!')
    expect(logSpy.mock.calls[1]?.[0]).toContain('Self-XSS')
  })

  it('does not log again across subsequent mounts in the same window', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const first = render(<ConsoleSecurityWarning />)
    first.unmount()
    render(<ConsoleSecurityWarning />)

    expect(logSpy).toHaveBeenCalledTimes(2)
  })
})
