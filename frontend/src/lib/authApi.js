import { apiBase, apiFetch } from './ontologyApi'

/**
 * GET /auth/roles — Unity Catalog role rows `{ id, name }[]`.
 * @returns {Promise<{ id: number, name: string }[]>}
 */
export async function fetchAuthRoles() {
  const url = `${apiBase()}/auth/roles`
  const res = await apiFetch(url)
  if (!res.ok) {
    let detail = 'Could not load roles'
    try {
      const j = await res.json()
      if (j.detail != null) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      try {
        detail = await res.text()
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || res.statusText)
  }
  return res.json()
}

/**
 * PUT /auth/roles/{roleId}/allowed-pages — body `{ allowed_pages: string[] }`.
 * @param {number} roleId
 * @param {string[]} allowedPages
 * @param {string} [token]
 */
export async function updateRoleAllowedPages(roleId, allowedPages, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await apiFetch(`${apiBase()}/auth/roles/${roleId}/allowed-pages`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ allowed_pages: allowedPages }),
  })
  if (!res.ok) {
    let detail = 'Could not save permissions'
    try {
      const j = await res.json()
      if (j.detail != null) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      try {
        detail = await res.text()
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || res.statusText)
  }
  return res.json()
}

/**
 * DELETE /auth/roles/{roleId}/allowed-pages — clear stored override (revert to name-based defaults).
 * @param {number} roleId
 * @param {string} [token]
 */
export async function clearRoleAllowedPagesOverride(roleId, token) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await apiFetch(`${apiBase()}/auth/roles/${roleId}/allowed-pages`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    let detail = 'Could not clear permissions'
    try {
      const j = await res.json()
      if (j.detail != null) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      try {
        detail = await res.text()
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || res.statusText)
  }
  return res.json()
}

/**
 * POST /auth/login — body: { login, password } (login is email or username).
 * @returns {Promise<{ access_token: string, token_type: string, user: object }>}
 */
export async function apiLogin(login, password) {
  const url = `${apiBase()}/auth/login`
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: login.trim(), password }),
  })
  if (!res.ok) {
    let detail = 'Sign in failed'
    try {
      const j = await res.json()
      if (j.detail != null) detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail)
    } catch {
      try {
        detail = await res.text()
      } catch {
        /* ignore */
      }
    }
    throw new Error(detail || res.statusText)
  }
  return res.json()
}
