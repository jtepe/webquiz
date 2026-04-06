const PENDING_OIDC_KEY = 'webquiz.pendingOidcLogin'

type IdpUser = {
  displayName?: string
  name?: string
  username?: string
  email?: string
}

function getIdpUrl() {
  return import.meta.env.VITE_IDP_URL?.trim() ?? ''
}

function getRedirectTarget() {
  return window.location.href
}

export function getOidcLoginUrl(idpUrl: string, redirectTarget = getRedirectTarget()) {
  const redirect = encodeURIComponent(redirectTarget)
  return `${idpUrl}/login?redirect=${redirect}`
}

export function hasPendingOidcLogin() {
  return window.localStorage.getItem(PENDING_OIDC_KEY) === '1'
}

export async function beginOrResumeOidcLogin() {
  const idpUrl = getIdpUrl()
  if (!idpUrl) {
    throw new Error('VITE_IDP_URL is not configured.')
  }

  const response = await fetch(`${idpUrl}/me`, {
    credentials: 'include',
  })

  if (response.status === 401) {
    window.localStorage.setItem(PENDING_OIDC_KEY, '1')
    window.location.assign(getOidcLoginUrl(idpUrl))
    return null
  }

  if (!response.ok) {
    throw new Error(`OIDC user lookup failed with HTTP ${response.status}.`)
  }

  const user = (await response.json()) as IdpUser
  const displayName = user.displayName ?? user.name ?? user.username ?? user.email

  if (!displayName) {
    throw new Error('OIDC user details did not include a usable display name.')
  }

  window.localStorage.removeItem(PENDING_OIDC_KEY)
  return { displayName }
}
