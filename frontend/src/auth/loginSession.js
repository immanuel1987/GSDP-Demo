/**
 * Map a Unity Catalog role **display name** → dashboard RBAC key (`ROLE_PAGES` in `dashboardNav.js`).
 */
export function dashboardRoleKeyFromRoleName(roleName) {
  const raw = String(roleName ?? '')
    .trim()
    .toLowerCase()
  if (!raw) return 'registered'
  if (raw.includes('rector') && raw.includes('major')) return 'rector_major'
  if (raw.includes('provincial')) return 'provincial'
  const roleTitle = String(roleName ?? '').trim()
  if (/\bviewer\b/i.test(roleTitle)) return 'viewer'
  if (raw === 'admin' || raw.includes('administrator')) return 'admin'
  if (raw.includes('editor')) return 'editor'
  if (raw.includes('liaison')) return 'liaison'
  return 'registered'
}

/** Map logged-in user payload → dashboard RBAC key. */
export function dashboardRoleKeyFromApiUser(user) {
  return dashboardRoleKeyFromRoleName(user?.roles?.[0]?.name)
}

export function initialsFromUser(user) {
  const u = String(user?.username ?? '').trim()
  if (u.length >= 2) return u.slice(0, 2).toUpperCase()
  if (u.length === 1) return u.toUpperCase()
  const em = String(user?.email ?? '').trim()
  if (em.includes('@')) return em.charAt(0).toUpperCase()
  return '?'
}

/** First screen after sign-in: provincials land on the library (region scope in session). */
export function postLoginPath(roleKey) {
  if (roleKey === 'provincial') return '/dashboard/resources'
  return '/dashboard'
}

/**
 * @param {{ access_token: string, token_type?: string, user: { id: number, username: string, email: string, region: string, roles: { id: number, name: string }[] } }} data
 */
export function buildSessionFromLoginResponse(data) {
  const user = data.user
  const roleKey = dashboardRoleKeyFromApiUser(user)
  const email = String(user.email ?? '').trim()
  const username = String(user.username ?? '').trim()
  const region = String(user.region ?? '').trim()
  const roleLabel = String(user.roles?.[0]?.name ?? '').trim()

  let label = ''
  if (roleKey === 'rector_major') {
    label = roleLabel ? `🌐 ${roleLabel}` : '🌐 Rector Major'
  } else if (roleKey === 'provincial') {
    label = roleLabel ? `📍 ${roleLabel}` : '📍 Provincial'
    if (region) label = `${label} · ${region}`
  } else if (roleKey === 'viewer') {
    label = roleLabel ? `👁 ${roleLabel}` : '👁 Viewer'
  } else if (roleLabel) {
    label = `🎓 ${roleLabel}`
  } else {
    label = '🎓 Registered User'
  }

  const allowedPages = Array.isArray(user.allowed_pages) ? user.allowed_pages : []

  return {
    email,
    username,
    region,
    roleName: roleLabel,
    role: roleKey,
    name: username || email,
    label,
    av: initialsFromUser(user),
    token: data.access_token,
    allowedPages,
  }
}
