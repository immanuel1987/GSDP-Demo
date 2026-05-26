import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { clearSession, getSession } from '../../auth/session'
import { ROLE_DISPLAY } from '../../data/dashboardRoles'
import { effectiveAllowedPageSet } from '../../auth/permissions'
import { DASHBOARD_PAGE_TITLES } from '../../data/dashboardNav'
import { SdbGlobeLogo } from '../../components/branding/SdbGlobeLogo'
import { AiAssistantDock } from '../../components/AiAssistantDock'
import { ragAssistantUrl } from '../../lib/ontologyApi'

const DISCOVER_NAV = [
  { page: 'dashboard', to: '/dashboard', end: true, icon: '📊', label: 'Dashboard' },
  {
    page: 'resources',
    to: '/dashboard/resources',
    icon: '📚',
    label: 'Resources',
  },
  {
    page: 'collections',
    to: '/dashboard/collections',
    icon: '🗂',
    label: 'Collections',
  },
  { page: 'institutions', to: '/dashboard/institutions', icon: '🏛', label: 'Pastoral Works' },
  { page: 'networks', to: '/dashboard/networks', icon: '🔗', label: 'Networks' },
  {
    page: 'events',
    to: '/dashboard/events',
    icon: '📅',
    label: 'Events',
  },
  {
    page: 'persons',
    to: '/dashboard/persons',
    icon: '👥',
    label: 'Persons',
  },
  { page: 'ai', to: '/dashboard/ai', icon: '✦', label: 'AI Assistant' },
]

const OWL_NAV = {
  page: 'owl',
  to: '/dashboard/owl',
  icon: '🦉',
  label: 'Knowledge sync',
}

const ADMIN_NAV = [
  { page: 'analytics', to: '/dashboard/analytics', icon: '📈', label: 'Analytics' },
  { page: 'governance', to: '/dashboard/governance', icon: '⚖️', label: 'Governance' },
  { page: 'access', to: '/dashboard/access', icon: '🧩', label: 'Access Control' },
]

function navLinkClass(isActive) {
  return [
    'flex cursor-pointer items-center gap-2.5 border-l-[3px] px-5 py-[10px] text-[14px] font-medium no-underline transition-colors lg:text-[13px] lg:py-[9px]',
    isActive
      ? 'border-sdb-orange bg-[rgba(0,74,153,0.38)] text-white'
      : 'border-transparent text-white/50 hover:bg-white/[0.04] hover:text-white/[0.85]',
  ].join(' ')
}

function NavBadge({ variant, children }) {
  if (variant === 'blue') {
    return (
      <span className="ml-auto rounded-full bg-sdb-blue-pale px-[7px] py-0.5 text-[10px] font-bold text-sdb-blue-deep">
        {children}
      </span>
    )
  }
  return (
    <span className="ml-auto rounded-full bg-sdb-orange px-[7px] py-0.5 text-[10px] font-bold text-white">{children}</span>
  )
}

function TopContextLink({ segment, allowed }) {
  if (segment === 'dashboard' && allowed.includes('governance')) {
    return (
      <Link
        to="/dashboard/governance"
        className="hidden items-center rounded-lg bg-sdb-orange px-3 py-1.5 text-xs font-semibold text-white no-underline sm:inline-flex"
      >
        ⚖️ Governance
      </Link>
    )
  }
  if (segment === 'analytics' && allowed.includes('analytics')) {
    return (
      <span className="hidden rounded-lg bg-sdb-blue px-3 py-1.5 text-xs font-semibold text-white sm:inline-block">
        📈 Analytics
      </span>
    )
  }
  if (segment === 'networks' && allowed.includes('networks')) {
    return (
      <Link
        to="/dashboard/networks"
        className="hidden rounded-lg border border-border-sdb bg-off-white px-3 py-1.5 text-xs font-semibold text-slate-sdb no-underline sm:inline-flex"
      >
        🔗 Networks
      </Link>
    )
  }
  return null
}

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  const role = session?.role && ROLE_DISPLAY[session.role] ? session.role : 'registered'
  const baseProfile = ROLE_DISPLAY[role] || ROLE_DISPLAY.registered
  const profile = {
    name: session?.name || baseProfile.name,
    label: session?.label || baseProfile.label,
    av: session?.av || baseProfile.av,
  }
  const allowedSet = effectiveAllowedPageSet(session)
  const showOntologySection = allowedSet.has('owl')
  const adminNavVisible = ADMIN_NAV.filter((n) => allowedSet.has(n.page))
  const showAdministrationSection = adminNavVisible.length > 0

  const segment = useMemo(() => {
    const p = location.pathname.replace(/^\/dashboard\/?/, '') || 'dashboard'
    return p.split('/')[0] || 'dashboard'
  }, [location.pathname])

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = () => setMobileNavOpen(false)

  const pageTitle = DASHBOARD_PAGE_TITLES[segment] || 'Dashboard'

  function signOut() {
    clearSession()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-off-white text-ink">
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-sdb-blue-deep/45 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        id="dashboard-sidebar"
        className={[
          'flex min-w-0 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-sdb-blue-deep text-white',
          'fixed inset-y-0 left-0 z-50 w-[min(280px,88vw)] max-w-[280px] transition-transform duration-200 ease-out lg:static lg:z-auto lg:w-[256px] lg:min-w-[256px] lg:max-w-none lg:translate-x-0',
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.08] px-5 pb-3.5 pt-[18px]">
          <SdbGlobeLogo size={32} />
          <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-2">
            <strong className="block font-serif text-[13px] leading-tight text-white lg:text-xs">Global Salesian</strong>
            <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-white/45 lg:text-[9px]">
              Digital Platform
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-5 py-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sdb-orange text-[13px] font-bold text-white lg:size-8 lg:text-xs">
            {profile.av}
          </div>
          <div className="min-w-0">
            <strong className="block truncate text-[13px] text-white lg:text-xs">{profile.name}</strong>
            <span className="block truncate text-[11px] font-bold uppercase tracking-[0.07em] text-sdb-orange-light lg:text-[10px]">
              {profile.label.split(/\s+/).slice(1).join(' ') || profile.label}
            </span>
          </div>
        </div>
        <div className="px-5 pb-1.5 pt-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.22] lg:text-[9px]">
          Discover
        </div>
        {DISCOVER_NAV.filter((n) => allowedSet.has(n.page)).map((item) => (
          <NavLink
            key={item.page}
            to={item.to}
            end={item.end}
            title={item.navTitle}
            className={({ isActive }) => navLinkClass(isActive)}
            onClick={closeMobileNav}
          >
            <span className="w-[18px] shrink-0 text-center text-sm">{item.icon}</span>
            {item.label}
            {item.badge ? <NavBadge variant={item.badgeVariant}>{item.badge}</NavBadge> : null}
          </NavLink>
        ))}

        {showOntologySection ? (
          <>
            <div
              id="ontology-sec"
              className="px-5 pb-1.5 pt-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.22] lg:text-[9px]"
            >
              Data pipeline
            </div>
            {allowedSet.has('owl') ? (
              <NavLink
                id="owl-nav"
                to={OWL_NAV.to}
                className={({ isActive }) => navLinkClass(isActive)}
                onClick={closeMobileNav}
              >
                <span className="w-[18px] shrink-0 text-center text-sm">{OWL_NAV.icon}</span>
                {OWL_NAV.label}
              </NavLink>
            ) : null}
          </>
        ) : null}

        {showAdministrationSection ? (
          <>
            <div
              id="admin-sec"
              className="px-5 pb-1.5 pt-3.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/[0.22] lg:text-[9px]"
            >
              Administration
            </div>
            {adminNavVisible.map((item) => (
              <NavLink
                key={item.page}
                id={
                  item.page === 'analytics'
                    ? 'analytics-nav'
                    : item.page === 'governance'
                      ? 'governance-nav'
                      : item.page === 'access'
                        ? 'access-nav'
                        : undefined
                }
                to={item.to}
                className={({ isActive }) => navLinkClass(isActive)}
                onClick={closeMobileNav}
              >
                <span className="w-[18px] shrink-0 text-center text-sm">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        ) : null}

        <div className="mt-auto border-t border-white/[0.07] px-5 py-3.5">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full cursor-pointer items-center gap-2 border-none bg-transparent py-2 text-left text-sm text-white/30 transition-colors hover:text-white/70 lg:py-1.5 lg:text-xs"
          >
            ← Log out
          </button>
        </div>
      </aside>

      <div className="main-area flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b-2 border-sdb-orange bg-white px-4 py-2 sm:gap-3.5 sm:px-6 sm:py-0">
          <button
            type="button"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-sdb bg-off-white text-lg leading-none text-sdb-blue-deep lg:hidden"
            aria-expanded={mobileNavOpen}
            aria-controls="dashboard-sidebar"
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            {mobileNavOpen ? '✕' : '☰'}
          </button>
          <h1 className="min-w-0 flex-1 font-serif text-lg font-bold leading-tight text-sdb-blue-deep sm:text-base">
            {pageTitle}
          </h1>
          <div
            role="button"
            tabIndex={0}
            title="Open Knowledge Assistant (semantic search)"
            className="relative hidden max-w-[360px] flex-1 cursor-pointer items-center gap-2 rounded border border-border-sdb bg-off-white py-1.5 pl-3 pr-3 transition-colors focus-within:border-sdb-blue md:flex"
            onClick={() => {
              window.location.assign(ragAssistantUrl())
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                window.location.assign(ragAssistantUrl())
              }
            }}
          >
            <span className="text-sm text-mid">🔍</span>
            <input
              type="search"
              readOnly
              placeholder="Search across all modules…"
              className="pointer-events-none min-w-0 flex-1 border-none bg-transparent text-[13px] text-ink outline-none"
              tabIndex={-1}
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="relative flex size-[34px] items-center justify-center rounded border border-border-sdb bg-white text-[15px]"
              title="Notifications"
            >
              🔔
              <span className="absolute right-1.5 top-1.5 size-[7px] rounded-full border border-white bg-sdb-orange" />
            </button>
            <TopContextLink segment={segment} allowed={Array.from(allowedSet)} />
            <Link
              to="/"
              className="rounded-lg border border-border-sdb px-3 py-1.5 text-xs font-semibold text-slate-sdb no-underline hover:bg-sdb-blue-pale"
            >
              Public site
            </Link>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Outlet />
        </div>
      </div>
      {allowedSet.has('ai') ? <AiAssistantDock /> : null}
    </div>
  )
}
