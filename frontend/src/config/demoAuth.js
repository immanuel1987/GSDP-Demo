/**
 * Wireframe demo credentials (matches HTML behaviour: validate then enter app shell).
 * Replace with real OIDC / API auth in production.
 */
export const DEMO_EMAIL = 'admin@donbosco.org'
export const DEMO_USERNAME = 'admin'
export const DEMO_PASSWORD = 'admin'

/** `login` may be the demo email or demo username (case-insensitive). */
export function isDemoLoginValid(login, password) {
  const id = String(login || '').trim().toLowerCase()
  const pw = String(password || '')
  const idOk = id === DEMO_EMAIL.toLowerCase() || id === DEMO_USERNAME.toLowerCase()
  return idOk && pw === DEMO_PASSWORD
}
