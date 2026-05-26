import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiAssistantDock } from '../components/AiAssistantDock'
import { scrollToSection } from '../lib/scrollTo'
import { publicDiscoverLinks, publicNetworkFooterLinks, footerProvinces } from '../data/footerData'
import {
  buildDistributionFromOntologyRows,
  buildHeroSlidesFromOntologyRows,
  buildPublicHomeStats,
  buildRecentPdfResourcesFromOntologyRows,
  buildTrendingFromOntologyRows,
  fetchOntologyRows,
  fetchOntologySummary,
  formatHomeStatCount,
  formatOntologyFreshness,
  ragAssistantUrl,
} from '../lib/ontologyApi'
import gsdpIntroVideoUrl from '../assets/viedo/AI_Platform_Video_Generation_Request.mp4'
import { applyHeroSlideImages } from '../data/homeStaticImages'
import { ResourceDetailModal } from './dashboard/dashboardViews'
import './PublicHomePage.css'

/**
 * Public section ids → post-login path. Must stay in sync with `POST_LOGIN_DASHBOARD_PATHS` in `auth/loginSession.js`.
 */
const HOME_SECTION_TO_DASHBOARD = {
  'hp-section-growth': '/dashboard/resources',
  'hp-section-collections': '/dashboard/collections',
  'hp-news-panel': '/dashboard/resources',
  'hp-section-band': '/dashboard/events',
  'hp-foot-network': '/dashboard/networks',
  'hp-distribution': '/dashboard/institutions',
  'hp-map-panel': '/dashboard/institutions',
  'hp-section-live': '/dashboard/resources',
  'hp-section-hero': '/dashboard',
  'hp-foot-about': '/dashboard',
  'hp-foot-southasia': '/dashboard/resources',
}

function navigateLoginNext(navigate, nextPath) {
  navigate('/login', { state: { next: nextPath } })
}

/** Hero from API rows; static archive headers when a slide has no usable photo. */
function buildPublicHomeHeroSlides(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const built = buildHeroSlidesFromOntologyRows(rows, { maxSlides: 6 })
  return built.length ? applyHeroSlideImages(built, { preferStaticTheme: true }) : null
}

/** Recent resources strip: PDF documents only, newest first. */
function buildPublicHomeRecentPdfResources(rows) {
  return buildRecentPdfResourcesFromOntologyRows(rows, { limit: 4 })
}

/** Image-only slides when the catalog API is unavailable (no static copy). */
const FALLBACK_HERO_SLIDES = applyHeroSlideImages(
  [
    { cls: 'hp-s1', key: 'clear-1' },
    { cls: 'hp-s2', key: 'clear-2' },
    { cls: 'hp-s3', key: 'clear-3' },
    { cls: 'hp-s1', key: 'clear-4' },
    { cls: 'hp-s2', key: 'clear-5' },
    { cls: 'hp-s3', key: 'clear-6' },
  ],
  { preferStaticTheme: true },
)

function HeroSlidePhoto({ slide, eager }) {
  const imgSrc = slide?.bg
  const imgPos = slide?.bgPos || 'center center'
  return (
    <>
      <img
        className="hp-slide-photo"
        src={imgSrc}
        alt={slide?.imageAlt || ''}
        width={1920}
        height={820}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'auto'}
        style={{ objectPosition: imgPos }}
      />
    </>
  )
}

// ── Hero Slider ──────────────────────────────────────────────────────────────
function HeroSlider({ slides: slidesProp, loading }) {
  const slidesForRender = applyHeroSlideImages(
    slidesProp?.length ? slidesProp : FALLBACK_HERO_SLIDES,
    { preferStaticTheme: true },
  )
  const slideCount = slidesForRender.length

  const [idx, setIdx] = useState(0)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const timerRef = useRef(null)
  const heroRef = useRef(null)
  const overviewVideoRef = useRef(null)

  const go = useCallback(
    (i) => {
      setIdx((prev) => {
        if (!slideCount) return 0
        const next = ((i === undefined ? prev + 1 : i) + slideCount) % slideCount
        return next
      })
    },
    [slideCount],
  )

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current)
    if (slideCount < 2) return
    timerRef.current = setInterval(() => go(), 5000)
  }, [go, slideCount])

  useEffect(() => {
    if (slideCount < 2) {
      clearInterval(timerRef.current)
      return undefined
    }
    resetTimer()
    return () => clearInterval(timerRef.current)
  }, [resetTimer, slideCount])

  useEffect(() => {
    if (!loading) return
    setIdx(0)
  }, [loading])

  useEffect(() => {
    if (!overviewOpen) return undefined
    const v = overviewVideoRef.current
    if (v) {
      v.currentTime = 0
      v.play().catch(() => { })
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOverviewOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      v?.pause()
    }
  }, [overviewOpen])

  const pause = () => clearInterval(timerRef.current)

  return (
    <div
      className={`hp-hero-l${loading ? ' hp-hero-loading' : ''}`}
      ref={heroRef}
      onMouseEnter={pause}
      onMouseLeave={resetTimer}
      aria-busy={loading || undefined}
    >
      <div className="hp-slides">
        {slidesForRender.map((s, k) => {
          const isActive = idx === k
          return (
            <div
              key={s.key ?? `slide-${k}`}
              className={`hp-slide ${s.cls}${isActive ? ' active' : ''} hp-slide--has-photo`}
              aria-hidden={!isActive}
            >
              <HeroSlidePhoto slide={s} eager={k === 0} />
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div className="hp-slider-ctrl">
        <div className="hp-dots">
          {slidesForRender.map((_, k) => (
            <button key={k} className={`hp-dot-btn${idx === k ? ' active' : ''}`}
              aria-label={`Slide ${k + 1}`}
              onClick={() => { go(k); resetTimer() }} />
          ))}
        </div>
        <div className="hp-arrows">
          <button className="hp-arr" aria-label="Previous" onClick={() => { go(idx - 1); resetTimer() }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button className="hp-arr" aria-label="Next" onClick={() => { go(idx + 1); resetTimer() }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <button
        type="button"
        className="hp-hero-overview-btn"
        onClick={() => setOverviewOpen(true)}
      >
        <span className="hp-hero-overview-btn-ic" aria-hidden>
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        Watch overview
      </button>

      {overviewOpen && (
        <div
          className="hp-overview-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hp-overview-modal-title"
          onClick={() => setOverviewOpen(false)}
        >
          <div className="hp-overview-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="hp-overview-modal-head">
              <h2 id="hp-overview-modal-title" className="hp-overview-modal-title">Platform overview</h2>
              <button
                type="button"
                className="hp-overview-modal-x"
                aria-label="Close video"
                onClick={() => setOverviewOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="hp-overview-modal-video-wrap">
              <video
                ref={overviewVideoRef}
                className="hp-overview-modal-video"
                controls
                playsInline
                preload="metadata"
                src={gsdpIntroVideoUrl}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Public home header nav — dropdown lists aligned with main site Header.jsx */
function HpNavMenu() {
  const navigate = useNavigate()
  const [pinned, setPinned] = useState(null)
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  const leaveT = useRef(null)

  const clearLeave = () => {
    if (leaveT.current) {
      window.clearTimeout(leaveT.current)
      leaveT.current = null
    }
  }
  const closeAll = useCallback(() => {
    setPinned(null)
    setHover(null)
    if (leaveT.current) {
      window.clearTimeout(leaveT.current)
      leaveT.current = null
    }
  }, [])

  const show = (key) => pinned === key || hover === key
  const onEnter = (key) => {
    clearLeave()
    setHover(key)
  }
  const onLeave = () => {
    clearLeave()
    leaveT.current = window.setTimeout(() => setHover(null), 180)
  }
  const toggle = (key) => setPinned((p) => (p === key ? null : key))
  const go = (item) => {
    closeAll()
    const id = typeof item === 'string' ? item : item.id
    if (typeof item === 'object' && item.scrollOnly) {
      scrollToSection(id)
      return
    }
    const next = HOME_SECTION_TO_DASHBOARD[id]
    if (next) navigateLoginNext(navigate, next)
    else scrollToSection(id)
  }

  useEffect(() => {
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) closeAll()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') closeAll()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [closeAll])

  useEffect(() => () => clearLeave(), [])

  const dd = (key, label, sections) => (
    <div
      key={key}
      className="hp-nav-dd"
      onMouseEnter={() => onEnter(key)}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        className={`hp-menu-link${show(key) ? ' is-active-dd' : ''}`}
        aria-expanded={show(key)}
        aria-haspopup="true"
        onClick={() => toggle(key)}
      >
        {label}
        <span className={`hp-menu-chev${show(key) ? ' open' : ''}`}>▾</span>
      </button>
      <div
        className={`hp-nav-dd-wrap${show(key) ? ' is-open' : ''}${key === 'about' ? ' hp-nav-dd-wrap--about' : ''}`}
      >
        <div className="hp-nav-dd-panel" role="menu">
          {sections.map((block, bi) => (
            <div
              key={block.title ?? `block-${bi}`}
              className={`hp-nav-dd-block${block.align === 'center' ? ' hp-nav-dd-block--center' : ''}`}
            >
              {block.title ? (
                <div className="hp-nav-dd-h" role="presentation">
                  {block.title}
                </div>
              ) : null}
              {block.items.map((item) =>
                item.href ? (
                  <a
                    key={item.href}
                    href={item.href}
                    className="hp-nav-dd-item hp-nav-dd-item--external"
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    onClick={closeAll}
                  >
                    <span className="hp-nav-dd-item-label">
                      {item.label}
                      {item.badge ? <span className="hp-nav-dd-badge">{item.badge}</span> : null}
                    </span>
                    <span className="hp-nav-dd-ext" aria-hidden>
                      ↗
                    </span>
                  </a>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="hp-nav-dd-item"
                    onClick={() => go(item)}
                  >
                    {item.label}
                  </button>
                ),
              )}
              {bi < sections.length - 1 ? <div className="hp-nav-dd-sep" role="separator" /> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <nav className="hp-menu" ref={wrapRef}>
      <button type="button" className="hp-menu-link hp-menu-link-home active" onClick={() => { closeAll(); scrollToSection('hp-section-hero') }}>
        Home
      </button>
      {dd('discover', 'Discover', [
        {
          title: 'Knowledge',
          items: [
            { label: 'Resources', id: 'hp-section-growth' },
            { label: 'Collections', id: 'hp-section-collections' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'Field news', id: 'hp-news-panel' },
            { label: 'Events & stories', id: 'hp-section-band' },
            { label: 'Networks', id: 'hp-foot-network' },
          ],
        },
      ])}
      {dd('pastoral', 'Pastoral Works', [
        {
          title: 'Institutions',
          items: [
            { label: 'Where the work happens', id: 'hp-distribution' },
            { label: 'Global map & presence', id: 'hp-map-panel' },
            { label: 'Live knowledge base', id: 'hp-section-live' },
          ],
        },
      ])}
      {dd('knowledge', 'Knowledge', [
        {
          title: 'Corpus',
          items: [
            { label: 'Growth & indexing', id: 'hp-section-growth' },
            { label: 'Curated collections', id: 'hp-section-collections' },
            { label: 'Search & hero', id: 'hp-section-hero' },
          ],
        },
      ])}
      {dd('about', 'About', [
        {
          title: 'On this page',
          align: 'left',
          items: [
            { label: 'About the Platform', id: 'hp-foot-about', scrollOnly: true },
            { label: 'South Asia pilot', id: 'hp-foot-southasia', scrollOnly: true },
          ],
        },
        {
          title: 'Official websites',
          align: 'center',
          items: publicDiscoverLinks.map((l) => ({
            label: l.label,
            href: l.href,
            badge: l.badge,
          })),
        },
        {
          title: 'Congregation',
          align: 'center',
          items: [
            { label: 'Salesians of Don Bosco', href: 'https://www.sdb.org' },
            { label: 'Don Bosco South Asia', href: 'https://www.donboscosouthasia.org' },
          ],
        },
      ])}
    </nav>
  )
}

// ── Animated bar ─────────────────────────────────────────────────────────────
function DistBar({ pct, cls }) {
  const [w, setW] = useState('0%')
  useEffect(() => { const t = setTimeout(() => setW(pct), 300); return () => clearTimeout(t) }, [pct])
  return <div className="hp-dist-bar"><div className={`hp-dist-fill ${cls}`} style={{ width: w }} /></div>
}

// ── Main component ────────────────────────────────────────────────────────────
export function PublicHomePage() {
  const navigate = useNavigate()
  const [selectedResource, setSelectedResource] = useState(null)
  const [ontologyBlock, setOntologyBlock] = useState(null)
  const [ontologySummary, setOntologySummary] = useState(null)
  const [homeFetchDone, setHomeFetchDone] = useState(false)

  useEffect(() => {
    let cancelled = false
      ; (async () => {
        try {
          const [ont, sum] = await Promise.all([
            fetchOntologyRows({ limit: 80, offset: 0 }),
            fetchOntologySummary().catch(() => null),
          ])
          if (cancelled) return
          setOntologyBlock(ont && typeof ont === 'object' ? ont : null)
          setOntologySummary(sum && typeof sum === 'object' ? sum : null)
        } catch {
          if (!cancelled) {
            setOntologyBlock(null)
            setOntologySummary(null)
          }
        } finally {
          if (!cancelled) setHomeFetchDone(true)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [])

  const homeRows = ontologyBlock?.data
  const catalogTotal =
    homeFetchDone && typeof ontologyBlock?.total === 'number'
      ? ontologyBlock.total
      : homeFetchDone && typeof ontologySummary?.total_rows === 'number'
        ? ontologySummary.total_rows
        : 0
  const catalogTotalLabel = formatHomeStatCount(catalogTotal, !homeFetchDone)

  const homeStats = useMemo(() => {
    if (!homeFetchDone) return null
    return buildPublicHomeStats(homeRows, {
      catalogTotal,
      summary: ontologySummary,
    })
  }, [homeFetchDone, homeRows, catalogTotal, ontologySummary])

  const distributionRows = useMemo(() => {
    if (!homeFetchDone) return []
    return buildDistributionFromOntologyRows(homeRows, { limit: 6 })
  }, [homeFetchDone, homeRows])

  const distributionTotal = useMemo(() => {
    if (!distributionRows.length) return 0
    return distributionRows.reduce((sum, r) => sum + (Number(r.num) || 0), 0)
  }, [distributionRows])

  const heroSlides = useMemo(() => {
    if (!homeFetchDone) return null
    if (!ontologyBlock || !Array.isArray(homeRows) || homeRows.length === 0) return null
    return buildPublicHomeHeroSlides(homeRows)
  }, [homeFetchDone, ontologyBlock, homeRows])

  const recentPdfResources = useMemo(() => {
    if (!homeFetchDone) return []
    return buildPublicHomeRecentPdfResources(Array.isArray(homeRows) ? homeRows : [])
  }, [homeFetchDone, homeRows])

  /** No news API yet — counts stay at zero (not inferred from catalog rows). */
  const newsStoryCount = 0
  const newsNationCount = 0

  const trendingItems = useMemo(() => {
    if (!homeFetchDone || !Array.isArray(homeRows) || homeRows.length === 0) return []
    const t = buildTrendingFromOntologyRows(homeRows, { limit: 4 })
    return t.map((row, i) => ({ ...row, key: `tr-${i}-${row.q}` }))
  }, [homeFetchDone, homeRows])

  const liveStatCells = useMemo(() => {
    const s = homeStats
    return [
      {
        v: formatHomeStatCount(s?.resources ?? 0, !homeFetchDone),
        k: 'Resources',
        d: formatHomeStatCount(s?.resources ?? 0, false),
      },
      {
        v: formatHomeStatCount(s?.nations ?? 0, !homeFetchDone),
        k: 'Nations',
        d: formatHomeStatCount(s?.nations ?? 0, false),
        world: true,
      },
      {
        v: formatHomeStatCount(s?.knowledgeAreas ?? 0, !homeFetchDone),
        k: 'Knowledge areas',
        d: formatHomeStatCount(s?.knowledgeAreas ?? 0, false),
      },
      {
        v: formatHomeStatCount(s?.languages ?? 0, !homeFetchDone),
        k: 'Languages',
        d: formatHomeStatCount(s?.languages ?? 0, false),
      },
    ]
  }, [homeStats, homeFetchDone])

  const liveUpdated = formatOntologyFreshness(ontologySummary)

  return (
    <>
      <div className="hp-root">

        {/* UTILITY BAR */}
        <div className="hp-util">
          <div className="hp-util-row">
            <div className="hp-util-l">
              <span><b>Open Knowledge</b></span>
              <span>South Asia Pilot</span>
              <span>Strenna 2026</span>
              <span>
                {formatHomeStatCount(homeStats?.nations ?? 0, !homeFetchDone)} nations ·{' '}
                {formatHomeStatCount(homeStats?.resources ?? 0, !homeFetchDone)} resources
              </span>
            </div>
            <div className="hp-util-r">
              <a className="on">EN</a><a>IT</a><a>ES</a><a>PT</a><a>FR</a>
            </div>
          </div>
        </div>

        {/* HEADER */}
        <header className="hp-header">
          <div className="hp-nav">
            <div className="hp-brand" onClick={() => navigate('/')}>
              <div className="hp-brand-tile">
                <div className="hp-brand-tile-mark" aria-hidden>
                  G
                </div>
                <div className="hp-brand-tile-body">
                  <div className="hp-brand-tile-title">Global Salesian</div>
                  <div className="hp-brand-tile-sub">Digital Platform</div>
                </div>
              </div>
            </div>
            <HpNavMenu />
            <div
              className="hp-nav-search"
              role="button"
              tabIndex={0}
              title="Open Knowledge Assistant (semantic search)"
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
              </svg>
              <input
                readOnly
                placeholder={`Search ${catalogTotalLabel} resources…`}
                tabIndex={-1}
              />
              <span className="hp-kbd">⌘K</span>
            </div>
            <div className="hp-nav-cta">
              <button className="hp-btn" onClick={() => navigate('/login')}>Login</button>
              <button className="hp-btn hp-btn-primary" onClick={() => navigate('/login')}>Enter Platform</button>
            </div>
          </div>
        </header>

        {/* HERO: full-width slider band, then sidebar row */}
        <section className="hp-hero-section" id="hp-section-hero">
          <div className="hp-hero-slider-bleed">
            <HeroSlider
              key={heroSlides?.length ? 'hero-ontology' : 'hero-fallback'}
              loading={!homeFetchDone}
              slides={heroSlides ?? undefined}
            />
          </div>

          <div className="hp-hero-sub" id="hp-section-live">
            <div className="hp-hero-r">
              <div className="hp-live-stack">
                <div className="hp-live">
                  <div className="hp-live-h">
                    <span className="hp-live-lbl">Live Knowledge Base</span>
                    <span className="hp-live-upd">
                      {liveUpdated ? `Index · ${liveUpdated}` : homeFetchDone ? 'Index · 0' : '…'}
                    </span>
                  </div>
                  <div className="hp-live-grid">
                    {!homeFetchDone ? (
                      [0, 1, 2, 3].map((i) => (
                        <div key={i} className="hp-live-cell hp-live-cell--skeleton" aria-busy="true">
                          <div className="v hp-skel-line hp-skel-on-light hp-skel-line--stat" />
                          <div className="k hp-skel-line hp-skel-on-light hp-skel-line--stat-sm" />
                          <div className="delta hp-skel-line hp-skel-on-light hp-skel-line--stat-xs" />
                        </div>
                      ))
                    ) : (
                      liveStatCells.map((c, i) => (
                        <div key={i} className={`hp-live-cell${c.world ? ' hp-live-cell--world' : ''}`}>
                          <div className="v">{c.v}</div>
                          <div className="k">{c.k}</div>
                          <div className="delta">{c.d}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Trending */}
                <div className="hp-trend">
                  <div className="hp-trend-h">
                    <span className="hp-trend-t">Trending searches</span>
                    <span className="hp-trend-week">Past 7 days</span>
                  </div>
                  <div className="hp-trend-list">
                    {!homeFetchDone ? (
                      <div className="hp-data-loading" aria-busy="true">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className="hp-trend-row hp-skel-row">
                            <span className="hp-trend-rk hp-skel-pill" />
                            <span className="hp-trend-thumb hp-skel-block" />
                            <span className="hp-skel-line" />
                            <span className="hp-trend-ct hp-skel-pill hp-skel-pill--sm" />
                          </div>
                        ))}
                      </div>
                    ) : trendingItems.length === 0 ? (
                      <p className="hp-empty-hint">0 trending topics in the current catalog sample.</p>
                    ) : (
                      trendingItems.map((t, i) => (
                        <div
                          key={t.key ?? i}
                          className="hp-trend-row"
                          role="button"
                          tabIndex={0}
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigateLoginNext(navigate, '/dashboard/resources')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              navigateLoginNext(navigate, '/dashboard/resources')
                            }
                          }}
                        >
                          <span className="hp-trend-rk">{String(i + 1).padStart(2, '0')}</span>
                          {t.thumb ? (
                            <img
                              className="hp-trend-thumb"
                              src={t.thumb}
                              alt=""
                              width={40}
                              height={40}
                              loading="lazy"
                              style={{ objectPosition: t.thumbPos || 'center center' }}
                            />
                          ) : (
                            <span className="hp-trend-thumb hp-trend-thumb--empty" aria-hidden />
                          )}
                          <span className="hp-trend-q">{t.q}</span>
                          <span className={`hp-trend-ct${t.up ? '' : ' dn'}`}>
                            {t.up && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="m6 15 6-6 6 6" />
                              </svg>
                            )}
                            {t.ct}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-COLUMN BAND */}
        <section className="hp-band" id="hp-section-band">
          {/* News */}
          <div className="hp-panel" id="hp-news-panel">
            <div className="hp-panel-h">
              <div>
                <div className="hp-panel-title">Latest from the field</div>
                <div className="hp-panel-sub">
                  {formatHomeStatCount(newsStoryCount, !homeFetchDone)} stories ·{' '}
                  {formatHomeStatCount(newsNationCount, !homeFetchDone)} nations
                </div>
              </div>
              <a
                className="hp-panel-all"
                onClick={() => navigateLoginNext(navigate, '/dashboard/resources')}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigateLoginNext(navigate, '/dashboard/resources')
                  }
                }}
              >
                All news →
              </a>

            </div>
            <div className="hp-news-list">
              {!homeFetchDone ? (
                <div className="hp-data-loading" aria-busy="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="hp-news-item hp-skel-news">
                      <div className="hp-news-date hp-skel-block" />
                      <div className="hp-news-body">
                        <div className="hp-skel-line hp-skel-line--sm" />
                        <div className="hp-skel-line" />
                        <span className="tag hp-skel-pill hp-skel-pill--tag" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="hp-empty-hint">0 news stories — news feed not connected yet.</p>
              )}
            </div>
          </div>

          {/* Distribution */}
          <div className="hp-panel" id="hp-distribution">
            <div className="hp-panel-h">
              <div>
                <div className="hp-panel-title">Where the work happens</div>
                <div className="hp-panel-sub">
                  {formatHomeStatCount(distributionTotal, !homeFetchDone)} items · by type
                </div>
              </div>
              <button type="button" className="hp-panel-all" onClick={() => navigateLoginNext(navigate, '/dashboard/institutions')}>
                Map →
              </button>
            </div>
            <div className="hp-dist">
              {!homeFetchDone ? (
                <div className="hp-data-loading hp-dist--skeleton" aria-busy="true">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="hp-dist-row">
                      <div className="hp-dist-lbl hp-skel-line hp-skel-on-light hp-skel-line--dist-lbl" />
                      <div className="hp-dist-bar-skel" />
                      <div className="hp-dist-num hp-skel-line hp-skel-on-light hp-skel-line--dist-num" />
                    </div>
                  ))}
                </div>
              ) : distributionRows.length === 0 ? (
                <p className="hp-empty-hint">0 items to show by type.</p>
              ) : (
                distributionRows.map((r, i) => (
                  <div key={`${r.lbl}-${i}`} className="hp-dist-row">
                    <div className="hp-dist-lbl">{r.lbl}</div>
                    <DistBar pct={r.pct} cls={r.cls} />
                    <div className="hp-dist-num">{formatHomeStatCount(r.num, false)}</div>
                  </div>
                ))
              )}
            </div>
            <div className="hp-dist-foot">
              <div className="hp-dist-foot-l">
                <strong>Corpus breakdown</strong>
                <span className="hp-dist-sep">/</span>
                <span>{formatHomeStatCount(distributionRows.length, !homeFetchDone)} types</span>
              </div>
              <button type="button" className="hp-panel-all" onClick={() => navigateLoginNext(navigate, '/dashboard/institutions')}>
                Full directory →
              </button>
            </div>
          </div>

          {/* Map */}
          <div className="hp-panel" id="hp-map-panel">
            <div className="hp-panel-h">
              <div>
                <div className="hp-panel-title">Global presence</div>
                <div className="hp-panel-sub">
                  {formatHomeStatCount(homeStats?.nations ?? 0, !homeFetchDone)} countries in index
                </div>
              </div>
              <button type="button" className="hp-panel-all" onClick={() => navigateLoginNext(navigate, '/dashboard/institutions')}>
                Explore map →
              </button>
            </div>
            <button type="button" className="hp-map-mini hp-map-mini--clickable" onClick={() => navigateLoginNext(navigate, '/dashboard/institutions')} aria-label="Explore map — login to open the full interactive map">
              <div className="hp-map-canvas">
                <img
                  src="/assets/world_map.jpg"
                  alt="World map — global Salesian presence"
                  className="hp-map-real"
                  width={960}
                  height={480}
                  loading="lazy"
                />
                <div className="hp-map-markers" aria-hidden>
                  <span className="hp-map-pin hp-map-pin--hq" title="HQ" />
                  <span className="hp-map-pin hp-map-pin--pilot" title="South Asia pilot" />
                  <span className="hp-map-pin hp-map-pin--active" title="Active" />
                  <span className="hp-map-pin hp-map-pin--mission" title="Mission" />
                </div>
              </div>
            </button>
            <div className="hp-map-foot">
              <div className="hp-map-legend">
                <span><span className="hp-map-dot" style={{ background: '#e67e22' }} />HQ</span>
                <span><span className="hp-map-dot" style={{ background: '#1f6eb8' }} />Pilot</span>
                <span><span className="hp-map-dot" style={{ background: '#1a8a6e' }} />Active</span>
                <span><span className="hp-map-dot" style={{ background: '#c9a227' }} />Mission</span>
              </div>
              <span>
                <strong style={{ color: '#0b1733' }}>
                  {formatHomeStatCount(homeStats?.publicationTypes ?? 0, !homeFetchDone)}
                </strong>{' '}
                publication types
              </span>
            </div>
          </div>
        </section>



        {/* RECENT RESOURCES */}
        <section className="hp-resources" id="hp-section-resources">
          <div className="hp-res-h">
            <div>
              <h2>Recent resources</h2>
              <div className="sub">
                {formatHomeStatCount(recentPdfResources.length, !homeFetchDone)} PDF documents in sample
              </div>
            </div>
            <button type="button" className="hp-col-all" onClick={() => navigateLoginNext(navigate, '/dashboard/resources')}>
              See more →
            </button>
          </div>
          <div className={`hp-res-grid${!homeFetchDone ? ' hp-data-loading' : ''}`} aria-busy={!homeFetchDone || undefined}>
            {!homeFetchDone ? (
              [0, 1, 2, 3].map((i) => (
                <div key={i} className="hp-res-card hp-col-card--skeleton">
                  <div className="hp-skel-line hp-skel-line--sm" />
                  <div className="hp-skel-line" />
                  <div className="hp-skel-line hp-skel-line--xs" />
                </div>
              ))
            ) : recentPdfResources.length > 0 ? (
              recentPdfResources.map((r, i) => (
                <div key={r.id} className="hp-res-card" onClick={() => setSelectedResource(r)}>
                  {r.thumb ? (
                    <img
                      className="hp-res-thumb"
                      src={r.thumb}
                      alt=""
                      width={320}
                      height={120}
                      loading={i < 2 ? 'eager' : 'lazy'}
                      style={{ objectPosition: r.thumbPos || 'center center' }}
                    />
                  ) : (
                    <div className="hp-res-thumb hp-res-thumb--empty" aria-hidden />
                  )}
                  <div className="hp-res-card-body">
                    <div className="ti">{r.title}</div>
                    <div className="ct">
                      {r.author && r.author !== '—'
                        ? r.author
                        : r.publisher && r.publisher !== '—'
                          ? r.publisher
                          : '—'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="hp-res-card hp-res-card--empty" style={{ gridColumn: '1 / -1' }}>
                0 PDF resources in the current catalog sample.
              </div>
            )}
          </div>
        </section>



        {/* FOOTER */}
        <section className="hp-foot" id="hp-section-foot">
          <div className="hp-foot-card">
            <div className="hp-foot-about" id="hp-foot-about">
              <h4>About the Platform</h4>
              <p>
                Open-access knowledge platform of the Salesians of Don Bosco. Indexed corpus:{' '}
                {formatHomeStatCount(homeStats?.resources ?? 0, !homeFetchDone)} resources across{' '}
                {formatHomeStatCount(homeStats?.languages ?? 0, !homeFetchDone)} languages.
              </p>
              <div className="hp-foot-stay">
                <input placeholder="Your email — get monthly updates" />
                <button>Subscribe</button>
              </div>
            </div>
            <div className="hp-foot-col">
              <h4>Discover</h4>
              <ul>
                {publicDiscoverLinks.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                      {l.badge ? <span className="badge">{l.badge}</span> : null}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hp-foot-col" id="hp-foot-southasia">
              <h4>South Asia · 12 Provinces</h4>
              <ul>
                {footerProvinces.map((p) => (
                  <li key={p.href}>
                    <a href={p.href} target="_blank" rel="noopener noreferrer">
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="hp-foot-col" id="hp-foot-network">
              <h4>Network</h4>
              <ul>
                {publicNetworkFooterLinks.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* COPYRIGHT */}
        <div className="hp-copy">
          <div className="l">
            <span>© 2026 Salesians of Don Bosco · All public resources are open access</span>
          </div>
          <div className="l">
            <a>Privacy</a><a>Terms</a><a>Accessibility</a>
            <a onClick={() => navigate('/login')}>Login</a>
          </div>
        </div>

        <AiAssistantDock variant="public" />
      </div>
      <ResourceDetailModal resource={selectedResource} onClose={() => setSelectedResource(null)} />
    </>
  )
}