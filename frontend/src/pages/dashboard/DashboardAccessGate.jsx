import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { effectiveAllowedPageIds } from '../../auth/permissions'
import { getSession } from '../../auth/session'

export function DashboardAccessGate() {
  const { pathname } = useLocation()
  const session = getSession()
  const allowed = effectiveAllowedPageIds(session)
  const segment = pathname.replace(/^\/dashboard\/?/, '') || 'dashboard'
  const key = segment === '' ? 'dashboard' : segment.split('/')[0]
  if (!allowed.includes(key)) {
    return <Navigate to="/dashboard" replace />
  }
  return <Outlet />
}
