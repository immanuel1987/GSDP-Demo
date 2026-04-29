const KEY = 'gsdp_auth'


export function getSession() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.email || !data?.role) return null
    return data
  } catch {
    return null
  }
}

export function setSession(payload) {
  sessionStorage.setItem(KEY, JSON.stringify(payload))
}

export function clearSession() {
  sessionStorage.removeItem(KEY)
}
