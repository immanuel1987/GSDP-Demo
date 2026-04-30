import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { effectiveAllowedPageSet } from '../../auth/permissions'
import { getSession } from '../../auth/session'
import { ROLE_DISPLAY, ROLE_STATS } from '../../data/dashboardRoles'
import { PENDING_ITEMS, PLATFORM_KPI_STRIP, ROLE_QUICK_ACTIONS } from '../../data/dashboardNav'
import {
  buildDashboardActivityFromOntologyRows,
  buildDashboardSpotlightSlides,
  fetchOntologyRows,
  fetchOntologySummary,
  formatOntologyFreshness,
} from '../../lib/ontologyApi'

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

function dashSlideBg(s) {
  if (s.bg) {
    return {
      backgroundImage: `url(${s.bg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
    }
  }
  if (s.coverCss) {
    return {
      background: s.coverCss,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
    }
  }
  return { background: 'linear-gradient(135deg,#003559,#004a99)' }
}

function DashboardSpotlightSkeleton() {
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl border border-border-sdb bg-sdb-blue-deep text-white shadow-md"
      aria-busy="true"
      aria-label="Loading spotlight"
    >
      <div className="absolute inset-0 bg-sdb-blue-deep/90" aria-hidden />
      <div className="relative flex min-h-[200px] flex-col justify-end gap-3 p-6 sm:min-h-[220px]">
        <div className="mb-2 h-6 w-36 animate-pulse rounded-full bg-white/20" />
        <div className="h-8 w-full max-w-lg animate-pulse rounded-lg bg-white/15" />
        <div className="h-3.5 w-full max-w-xl animate-pulse rounded bg-white/10" />
        <div className="h-3.5 w-full max-w-md animate-pulse rounded bg-white/10" />
        <p className="mt-2 text-[12px] text-white/55">Loading highlights…</p>
      </div>
    </div>
  )
}

/** Placeholder tiles while ontology summary / role stats are not ready — avoids flashing static wireframe numbers. */
function DashboardKpiCardSkeleton({ orangeTop }) {
  return (
    <div
      className={`rounded-xl border border-border-sdb bg-white px-[18px] pb-4 pt-[17px] shadow-sm ${
        orangeTop ? 'border-t-[3px] border-t-sdb-orange' : 'border-t-[3px] border-t-sdb-blue-light'
      }`}
      aria-busy="true"
    >
      <div className="mb-2 flex items-start justify-between">
        <div className="size-10 shrink-0 animate-pulse rounded-lg bg-slate-200" aria-hidden />
        <div className="h-4 w-16 shrink-0 animate-pulse rounded bg-slate-100" aria-hidden />
      </div>
      <div className="h-[30px] max-w-[7.5rem] animate-pulse rounded-md bg-slate-200" aria-hidden />
      <div className="mt-2 h-3 max-w-[9rem] animate-pulse rounded bg-slate-100" aria-hidden />
    </div>
  )
}

/** Shown while library rows load — avoids flashing static ROLE_ACTIVITY wireframes. */
function DashboardActivitySkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Loading recent activity">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-200" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-full max-w-[min(100%,28rem)] animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function DashboardSpotlightSlider({ slides }) {
  const len = slides.length
  const [idx, setIdx] = useState(0)
  const timerRef = useRef(null)

  const go = useCallback(
    (i) => {
      setIdx((prev) => {
        if (!len) return 0
        return ((i === undefined ? prev + 1 : i) + len) % len
      })
    },
    [len],
  )

  const resetTimer = useCallback(() => {
    window.clearInterval(timerRef.current)
    if (len > 1) timerRef.current = window.setInterval(() => go(), 6500)
  }, [go, len])

  useEffect(() => {
    resetTimer()
    return () => window.clearInterval(timerRef.current)
  }, [resetTimer])

  const pause = () => window.clearInterval(timerRef.current)
  const s = slides[idx]

  if (!len || !s) return null

  return (
    <div
      className="relative mb-6 overflow-hidden rounded-xl border border-border-sdb bg-sdb-blue-deep text-white shadow-md"
      onMouseEnter={pause}
      onMouseLeave={resetTimer}
    >
      <div className="absolute inset-0 bg-sdb-blue-deep/55" aria-hidden />
      <div className="absolute inset-0 opacity-90" style={dashSlideBg(s)} aria-hidden />
      <div className="relative flex min-h-[200px] flex-col justify-end gap-3 p-6 sm:min-h-[220px] sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90">
            <span className="size-1.5 rounded-full bg-sdb-orange" aria-hidden />
            {s.label}
          </div>
          <h3 className="font-serif text-xl font-bold leading-tight text-white sm:text-2xl">{s.title}</h3>
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-white/85">{s.lead}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {s.docUrl ? (
            <a
              href={s.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white px-4 py-2 text-center text-sm font-semibold text-sdb-blue-deep no-underline shadow-sm hover:bg-sdb-blue-pale"
            >
              Open attachment ↗
            </a>
          ) : null}
          <Link
            to="/dashboard/resources"
            className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-center text-sm font-semibold text-white no-underline backdrop-blur-sm hover:bg-white/20"
          >
            Resource library →
          </Link>
        </div>
      </div>
      {len > 1 ? (
        <div className="relative flex items-center justify-between gap-3 border-t border-white/15 bg-black/30 px-4 py-2.5">
          <div className="flex gap-1.5">
            {slides.map((sl, k) => (
              <button
                key={sl.key ?? k}
                type="button"
                aria-label={`Slide ${k + 1}`}
                className={`h-2 rounded-full transition-all ${idx === k ? 'w-7 bg-sdb-orange' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                onClick={() => {
                  setIdx(k)
                  resetTimer()
                }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Previous spotlight"
              className="flex size-8 items-center justify-center rounded-lg border border-white/25 bg-black/20 text-white hover:bg-black/35"
              onClick={() => {
                go(idx - 1)
                resetTimer()
              }}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next spotlight"
              className="flex size-8 items-center justify-center rounded-lg border border-white/25 bg-black/20 text-white hover:bg-black/35"
              onClick={() => {
                go(idx + 1)
                resetTimer()
              }}
            >
              ›
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DashboardHome() {
  const session = getSession()
  const role = session?.role && ROLE_DISPLAY[session.role] ? session.role : 'registered'
  const profile = useMemo(() => {
    const base = ROLE_DISPLAY[role] || ROLE_DISPLAY.registered
    return {
      name: session?.name || base.name,
      label: session?.label || base.label,
    }
  }, [role, session?.name, session?.label])

  const [ontologyRows, setOntologyRows] = useState([])
  const [ontologySummary, setOntologySummary] = useState(null)
  const [ontologyLoaded, setOntologyLoaded] = useState(false)

  const stats = useMemo(() => {
    const rows = (ROLE_STATS[role] || ROLE_STATS.registered).map((s) => ({ ...s }))
    if (ontologySummary && typeof ontologySummary.total_rows === 'number') {
      const t = ontologySummary.total_rows.toLocaleString()
      const liveLbl = new Set([
        'Total resources',
        'Resources available',
        'Resources in scope',
        'Resources curated',
        'Open resources',
      ])
      for (let i = 0; i < rows.length; i++) {
        if (liveLbl.has(rows[i].lbl)) {
          rows[i] = { ...rows[i], val: t, tr: 'Live index' }
        }
      }
    }
    if (role === 'provincial' && session?.region) {
      return rows.map((s, idx) =>
        idx === rows.length - 1 ? { ...s, val: session.region, tr: 'Your region' } : s,
      )
    }
    return rows
  }, [role, session?.region, ontologySummary])
  const quick = ROLE_QUICK_ACTIONS[role] || ROLE_QUICK_ACTIONS.public
  const allowedSet = effectiveAllowedPageSet(session)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [ont, sum] = await Promise.all([
          fetchOntologyRows({ limit: 24, offset: 0 }),
          fetchOntologySummary().catch(() => null),
        ])
        if (cancelled) return
        setOntologyRows(Array.isArray(ont?.data) ? ont.data : [])
        setOntologySummary(sum && typeof sum === 'object' ? sum : null)
      } catch {
        if (!cancelled) {
          setOntologyRows([])
          setOntologySummary(null)
        }
      } finally {
        if (!cancelled) setOntologyLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const spotlightSlides = useMemo(() => {
    if (!ontologyRows.length) return []
    return buildDashboardSpotlightSlides(ontologyRows, { maxSlides: 6 })
  }, [ontologyRows])

  const dynamicActivity = useMemo(() => {
    if (!ontologyRows.length) return []
    return buildDashboardActivityFromOntologyRows(ontologyRows, { limit: 8 })
  }, [ontologyRows])

  const platformKpis = useMemo(() => {
    const strip = PLATFORM_KPI_STRIP.map((x) => ({ ...x }))
    if (ontologySummary && typeof ontologySummary.total_rows === 'number') {
      strip[0] = {
        ...strip[0],
        val: ontologySummary.total_rows.toLocaleString(),
        trend: 'Live',
        lbl: 'Total resources',
      }
    }
    if (ontologySummary && typeof ontologySummary.distinct_knowledge_areas === 'number') {
      strip[1] = {
        ...strip[1],
        val: String(ontologySummary.distinct_knowledge_areas),
        trend: 'Topics',
        lbl: 'Knowledge areas',
      }
    }
    if (ontologySummary && typeof ontologySummary.distinct_publication_types === 'number') {
      strip[2] = {
        ...strip[2],
        val: String(ontologySummary.distinct_publication_types),
        trend: 'Formats',
        lbl: 'Publication types',
      }
    }
    return strip
  }, [ontologySummary])

  const ingestLabel = formatOntologyFreshness(ontologySummary)

  const firstName = useMemo(() => {
    const parts = (profile?.name || 'User').split(/\s+/)
    return parts[parts.length - 1]?.replace(/^Fr\.|^Sr\.|^Bro\.|^Rev\./, '') || 'User'
  }, [profile])

  const provincialScope =
    session?.role === 'provincial' && session?.region ? (
      <div className="mb-4 rounded-xl border border-sdb-blue-light bg-sdb-blue-pale px-4 py-3 text-[13px] text-slate-sdb">
        <strong className="text-sdb-blue-deep">Regional scope:</strong> content and filters default to{' '}
        <strong className="text-ink">{session.region}</strong>. Use <strong>Analytics</strong> for read-only dashboards.
        Governance, access control, and knowledge-sync tools are reserved for other roles.
      </div>
    ) : null

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      {provincialScope}
      <div className="relative mb-[18px] overflow-hidden rounded-xl border-l-4 border-sdb-orange bg-gradient-to-br from-sdb-blue-deep to-sdb-blue px-[26px] py-[22px] text-white">
        <div className="pointer-events-none absolute -right-[50px] -top-[50px] size-[180px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_70%)]" />
        <h2 className="relative font-serif text-xl font-bold text-white">Good morning, {firstName}</h2>
        <p className="relative mt-1 text-[13px] text-white/60">{formatDashDate()}</p>
        {ingestLabel ? (
          <p className="relative mt-1 text-[12px] text-white/50">Library last updated: {ingestLabel}</p>
        ) : null}
        <div className="relative mt-2.5 inline-block rounded-full border border-sdb-orange/40 bg-sdb-orange/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-sdb-orange-light">
          {profile.label}
        </div>
      </div>

      {!ontologyLoaded ? (
        <DashboardSpotlightSkeleton />
      ) : spotlightSlides.length > 0 ? (
        <DashboardSpotlightSlider slides={spotlightSlides} />
      ) : null}

      <div className="mb-4 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-busy={!ontologyLoaded || undefined}>
        {!ontologyLoaded
          ? PLATFORM_KPI_STRIP.map((s, i) => <DashboardKpiCardSkeleton key={`plat-skel-${i}`} orangeTop={!!s.orangeTop} />)
          : platformKpis.map((s) => (
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

      <div className="mb-6 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4" aria-busy={!ontologyLoaded || undefined}>
        {!ontologyLoaded
          ? stats.map((s, i) => (
              <DashboardKpiCardSkeleton
                key={`role-skel-${i}`}
                orangeTop={String(s.bg).toLowerCase().includes('orange')}
              />
            ))
          : stats.map((s, i) => (
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
            <span className="font-semibold text-sdb-blue-deep">Recent library activity</span>
            <Link
              to="/dashboard/resources"
              className="cursor-pointer text-xs font-semibold text-orange-text no-underline"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-4 p-4 text-sm text-slate-sdb">
            {!ontologyLoaded ? (
              <DashboardActivitySkeleton />
            ) : dynamicActivity.length ? (
              dynamicActivity.map((a) => (
                <div key={a.key} className="flex gap-3">
                  <div className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_BG[a.dot] || 'bg-slate-400'}`} />
                  <div>
                    <div className="text-ink">
                      <strong className="font-semibold">{a.title}</strong>
                      {a.publisher ? <span className="text-mid"> · {a.publisher}</span> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-mid">{a.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-mid">
                No recent items in this sample. Open the{' '}
                <Link to="/dashboard/resources" className="font-semibold text-orange-text no-underline">
                  resource library
                </Link>{' '}
                to browse the full collection.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border-sdb bg-white">
            <div className="border-b border-border-sdb px-4 py-3 font-semibold text-sdb-blue-deep">Quick Actions</div>
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {quick.map((q) => (
                <Link
                  key={q.t}
                  to={`/dashboard/${q.page}`}
                  className="flex cursor-pointer flex-col rounded-lg border border-border-sdb bg-off-white p-3 text-left text-ink no-underline transition-colors hover:border-sdb-blue-light"
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
                <span className="rounded bg-sdb-orange/15 px-2 py-0.5 text-xs font-bold text-orange-text">5</span>
              </div>
              <div className="divide-y divide-border-sdb">
                {PENDING_ITEMS.map((p) => (
                  <div key={p.title} className="flex items-start gap-3 p-4 text-sm">
                    <span className="text-lg">{p.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-ink">{p.title}</div>
                      <div className="text-xs text-mid">{p.meta}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${p.statusClass}`}>
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
        {session?.roleName ? (
          <>
            {' '}
            · <strong className="text-ink">{session.roleName}</strong>
          </>
        ) : null}
      </p>
    </main>
  )
}
