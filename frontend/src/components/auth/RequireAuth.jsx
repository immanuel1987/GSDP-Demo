import { Navigate, useLocation } from 'react-router-dom'
import { getSession } from '../../auth/session'

export function RequireAuth({ children }) {
  const location = useLocation()
  const session = getSession()
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return children
}
