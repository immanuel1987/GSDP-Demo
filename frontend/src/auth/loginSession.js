import { ROLE_DISPLAY } from '../data/dashboardRoles'

/** Hide warehouse-style role titles from the UI. */
function looksTechnicalRoleName(s) {
  const t = String(s || '').trim().toLowerCase()
  if (!t) return true
  if (t.length > 44) return true
  return /ontology|catalog|databricks|bronze|unity|final_table|gold layer|silver layer|warehouse|uc[_\s-]/i.test(t)
}

/** Prefer a short display name after sign-in (not raw table or system strings). */
function displayNameFromUser(user) {
  const email = String(user?.email ?? '').trim()
  const username = String(user?.username ?? '').trim()
  if (username && !username.includes('@')) return username
  if (email.includes('@')) {
    const local = email.split('@')[0]
    const nice = local.replace(/[._]+/g, ' ').trim()
    if (nice.length >= 2) return nice.charAt(0).toUpperCase() + nice.slice(1)
  }
  return email || username || 'Member'
}

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

/** Allowed in-app targets from public site `navigate('/login', { state: { next } })` (no open redirects). */
const POST_LOGIN_DASHBOARD_PATHS = new Set([
  '/dashboard',
  '/dashboard/resources',
  '/dashboard/collections',
  '/dashboard/institutions',
  '/dashboard/networks',
  '/dashboard/events',
  '/dashboard/persons',
  '/dashboard/ai',
  '/dashboard/owl',
  '/dashboard/analytics',
  '/dashboard/governance',
  '/dashboard/access',
])

/**
 * @param {unknown} next
 * @returns {string | null} Normalized path or null if not allowed
 */
export function sanitizePostLoginNext(next) {
  const s = typeof next === 'string' ? next.trim() : ''
  if (!s.startsWith('/')) return null
  let path = s.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/dashboard'
  if (path === '/dashboard') return '/dashboard'
  if (!path.startsWith('/dashboard/')) return null
  if (POST_LOGIN_DASHBOARD_PATHS.has(path)) return path
  return null
}

/**
 * Where to send the user after a successful sign-in (or if already signed in on /login).
 * Prefilled AI prompt wins over `next`. Unknown `next` falls back to {@link postLoginPath}.
 * @param {unknown} state - `location.state` from react-router
 * @param {string} roleKey
 * @returns {{ path: string, state?: { prefilledPrompt: string } }}
 */
export function getPostLoginTarget(state, roleKey) {
  const st = state && typeof state === 'object' ? state : {}
  const prompt = typeof st.prefilledPrompt === 'string' ? st.prefilledPrompt.trim() : ''
  if (prompt) {
    return { path: '/dashboard/ai', state: { prefilledPrompt: prompt } }
  }
  const next = sanitizePostLoginNext(st.next)
  if (next) {
    return { path: next }
  }
  return { path: postLoginPath(roleKey) }
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
  const generic = (ROLE_DISPLAY[roleKey] || ROLE_DISPLAY.registered).label
  const safeRoleFragment = roleLabel && !looksTechnicalRoleName(roleLabel) ? roleLabel : ''

  let label = ''
  if (roleKey === 'rector_major') {
    label = safeRoleFragment ? `🌐 ${safeRoleFragment}` : generic
  } else if (roleKey === 'provincial') {
    label = safeRoleFragment ? `📍 ${safeRoleFragment}` : '📍 Provincial'
    if (region) label = `${label} · ${region}`
  } else if (roleKey === 'viewer') {
    label = safeRoleFragment ? `👁 ${safeRoleFragment}` : generic
  } else if (safeRoleFragment) {
    label = `🎓 ${safeRoleFragment}`
  } else {
    label = generic
  }

  const allowedPages = Array.isArray(user.allowed_pages) ? user.allowed_pages : []

  return {
    email,
    username,
    region,
    roleName: looksTechnicalRoleName(roleLabel) ? '' : roleLabel,
    role: roleKey,
    name: displayNameFromUser(user),
    label,
    av: initialsFromUser(user),
    token: data.access_token,
    allowedPages,
  }
}
