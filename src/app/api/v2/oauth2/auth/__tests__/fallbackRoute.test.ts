import { describe, it, expect } from 'vitest'
import { GET as fallbackHandler } from '../route'

describe('Fallback /api/v2/oauth2/auth Handler', () => {
  it('returns status 200 HTML with client-side redirect to imauth.bora.dopa.go.th', async () => {
    const req = new Request('https://thlp.moph.go.th/api/v2/oauth2/auth?response_type=code&client_id=test&state=123')
    const res = await fallbackHandler(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/html')
    const text = await res.text()
    expect(text).toContain('https://imauth.bora.dopa.go.th/api/v2/oauth2/auth/?response_type=code&client_id=test&state=123')
    expect(text).toContain('window.location.replace')
  })
})
