import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { effectiveAllowedPageSet } from '../../auth/permissions'
import { getSession } from '../../auth/session'
import { ROLE_DISPLAY, ROLE_STATS } from '../../data/dashboardRoles'
import {
  PENDING_ITEMS,
  PLATFORM_KPI_STRIP,
  ROLE_ACTIVITY,
  ROLE_QUICK_ACTIONS,
} from '../../data/dashboardNav'

const DOT_BG = {
  'dot-green': 'bg-emerald-500',
  'dot-blue': 'bg-sdb-blue',
  'dot-gold': 'bg-amber-500',
  'dot-red': 'bg-red-600',
}

function formatDashDate() {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const now = new Date()
  return `Platform overview · ${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`
}

export function DashboardHome() {
  const session = getSession()
  const role = session?.role && ROLE_DISPLAY[session.role] ? session.role : 'registered'
  const baseProfile = ROLE_DISPLAY[role] || ROLE_DISPLAY.registered
  const profile = {
    name: session?.name || baseProfile.name,
    label: session?.label || baseProfile.label,
  }
  const stats = useMemo(() => {
    const rows = ROLE_STATS[role] || ROLE_STATS.registered
    if (role === 'provincial' && session?.region) {
      return rows.map((s, idx) =>
        idx === rows.length - 1 ? { ...s, val: session.region, tr: 'Assigned in directory' } : s,
      )
    }
    return rows
  }, [role, session?.region])
  const activity = ROLE_ACTIVITY[role] || ROLE_ACTIVITY.public
  const quick = ROLE_QUICK_ACTIONS[role] || ROLE_QUICK_ACTIONS.public
  const allowedSet = effectiveAllowedPageSet(session)

  const firstName = useMemo(() => {
    const parts = (profile?.name || 'User').split(/\s+/)
    return parts[parts.length - 1]?.replace(/^Fr\.|^Sr\.|^Bro\.|^Rev\./, '') || 'User'
  }, [profile])

  const provincialScope =
    session?.role === 'provincial' && session?.region ? (
      <div className="mb-4 rounded-xl border border-sdb-blue-light bg-sdb-blue-pale px-4 py-3 text-[13px] text-slate-sdb">
        <strong className="text-sdb-blue-deep">Regional scope:</strong> content and filters default to{' '}
        <strong className="text-ink">{session.region}</strong>. You can use <strong>Analytics</strong> for dashboards;
        governance, access control, and OWL admin are not available for this role.
      </div>
    ) : null

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      {provincialScope}
      <div className="relative mb-[18px] overflow-hidden rounded-xl border-l-4 border-sdb-orange bg-gradient-to-br from-sdb-blue-deep to-sdb-blue px-[26px] py-[22px] text-white">
        <div className="pointer-events-none absolute -right-[50px] -top-[50px] size-[180px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_70%)]" />
        <h2 className="relative font-serif text-xl font-bold text-white">Good morning, {firstName}</h2>
        <p className="relative mt-1 text-[13px] text-white/60">{formatDashDate()}</p>
        <div className="relative mt-2.5 inline-block rounded-full border border-sdb-orange/40 bg-sdb-orange/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sdb-orange-light">
          {profile.label}
        </div>
      </div>

      <div className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {PLATFORM_KPI_STRIP.map((s) => (
          <div
            key={s.lbl}
            className={`rounded-xl border border-border-sdb bg-white px-[18px] pb-4 pt-[17px] shadow-sm transition-shadow hover:shadow-md ${
              s.orangeTop ? 'border-t-[3px] border-t-sdb-orange' : 'border-t-[3px] border-t-sdb-blue-light'
            }`}
          >
            <div className="mb-2 flex items-start justify-between">
              <div
                className="flex size-10 items-center justify-center rounded-lg text-lg"
                style={{ background: s.bg }}
              >
                {s.icon}
              </div>
              <span className="text-xs font-semibold text-emerald-700">{s.trend}</span>
            </div>
            <div className="font-serif text-[26px] font-bold leading-none text-sdb-blue-deep">{s.val}</div>
            <div className="mt-1 text-xs text-mid">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={`${s.lbl}-${i}`}
            className={`rounded-xl border border-border-sdb bg-white px-[18px] pb-4 pt-[17px] shadow-sm transition-shadow hover:shadow-md ${
              String(s.bg).toLowerCase().includes('orange') ? 'border-t-[3px] border-t-sdb-orange' : 'border-t-[3px] border-t-sdb-blue-light'
            }`}
          >
            <div className="mb-2 flex items-start justify-between">
              <div
                className="flex size-10 items-center justify-center rounded-lg text-lg"
                style={{ background: s.bg }}
              >
                {s.icon}
              </div>
              <span className="text-xs font-semibold text-emerald-700">{s.tr}</span>
            </div>
            <div className="font-serif text-[26px] font-bold leading-none text-sdb-blue-deep">{s.val}</div>
            <div className="mt-1 text-xs text-mid">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-xl border border-border-sdb bg-white">
          <div className="flex items-center justify-between border-b border-border-sdb px-[18px] py-3.5">
            <span className="font-semibold text-sdb-blue-deep">Recent Activity</span>
            <Link
              to="/dashboard/resources"
              className="cursor-pointer text-xs font-semibold text-orange-text no-underline"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-4 p-4 text-sm text-slate-sdb">
            {activity.map((a, idx) => (
              <div key={idx} className="flex gap-3">
                <div className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_BG[a.dot] || 'bg-slate-400'}`} />
                <div>
                  <div
                    className="text-ink [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: a.html }}
                  />
                  <p className="mt-0.5 text-xs text-mid">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border-sdb bg-white">
            <div className="border-b border-border-sdb px-4 py-3 font-semibold text-sdb-blue-deep">
              Quick Actions
            </div>
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {quick.map((q) => (
                <Link
                  key={q.t}
                  to={`/dashboard/${q.page}`}
                  className="flex cursor-pointer flex-col rounded-lg border border-border-sdb bg-off-white p-3 text-left no-underline text-ink transition-colors hover:border-sdb-blue-light"
                >
                  <span className="text-lg">{q.icon}</span>
                  <span className="text-sm font-semibold">{q.t}</span>
                  <span className="text-xs text-mid">{q.s}</span>
                </Link>
              ))}
            </div>
          </div>

          {allowedSet.has('owl') ? (
            <div className="rounded-xl border border-border-sdb bg-white">
              <div className="flex items-center justify-between border-b border-border-sdb px-4 py-3">
                <span className="font-semibold text-sdb-blue-deep">Pending Items</span>
                <span className="rounded bg-sdb-orange/15 px-2 py-0.5 text-xs font-bold text-orange-text">
                  5
                </span>
              </div>
              <div className="divide-y divide-border-sdb">
                {PENDING_ITEMS.map((p) => (
                  <div key={p.title} className="flex items-start gap-3 p-4 text-sm">
                    <span className="text-lg">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink">{p.title}</div>
                      <div className="text-xs text-mid">{p.meta}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.statusClass}`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-mid">
        Signed in as <strong className="text-ink">{session?.email}</strong>
        {session?.username && session.username !== session?.email ? (
          <>
            {' '}
            · <strong className="text-ink">@{session.username}</strong>
          </>
        ) : null}
        {' '}
        · <strong className="text-ink">{session?.roleName || role}</strong>
      </p>
    </main>
  )
}
