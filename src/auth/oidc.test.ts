import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginOrResumeOidcLogin, getOidcLoginUrl, hasPendingOidcLogin } from './oidc'

describe('OIDC helpers', () => {
  const originalEnv = import.meta.env.VITE_IDP_URL

  beforeEach(() => {
    import.meta.env.VITE_IDP_URL = `${window.location.origin}/idp`
    window.localStorage.clear()
    window.history.replaceState({}, '', '/webquiz?room=abc#lobby')
  })

  afterEach(() => {
    import.meta.env.VITE_IDP_URL = originalEnv
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('builds a login URL that preserves the full current app URL', () => {
    expect(getOidcLoginUrl(`${window.location.origin}/idp`)).toBe(
      `${window.location.origin}/idp/login?redirect=${encodeURIComponent(
        `${window.location.origin}/webquiz?room=abc#lobby`,
      )}`,
    )
  })

  it('marks a pending login when the user must be redirected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
      }),
    )

    await expect(beginOrResumeOidcLogin()).resolves.toBeNull()

    expect(hasPendingOidcLogin()).toBe(true)
  })
})
