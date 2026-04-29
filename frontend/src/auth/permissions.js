import { ROLE_DISPLAY } from '../data/dashboardRoles'
import { ROLE_EXTRA_ROUTES, ROLE_PAGES } from '../data/dashboardNav'

/**
 * Ordered list of dashboard segment keys the session may open.
 * Uses `allowedPages` from login when present; otherwise ROLE_PAGES + extras for the mapped role.
 */
export function effectiveAllowedPageIds(session) {
  if (session && Array.isArray(session.allowedPages) && session.allowedPages.length > 0) {
    return session.allowedPages
  }
  const role = session?.role && ROLE_DISPLAY[session.role] ? session.role : 'registered'
  const base = ROLE_PAGES[role] || ROLE_PAGES.registered
  const extra = ROLE_EXTRA_ROUTES[role] || []
  return [...base, ...extra]
}

export function effectiveAllowedPageSet(session) {
  return new Set(effectiveAllowedPageIds(session))
}
