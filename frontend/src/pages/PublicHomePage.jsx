import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiAssistantDock } from '../components/AiAssistantDock'
import { scrollToSection } from '../lib/scrollTo'
import { publicDiscoverLinks, publicNetworkFooterLinks, footerProvinces } from '../data/footerData'
import {
  buildCollectionCardsFromOntologyRows,
  buildHeroSlidesFromOntologyRows,
  buildNewsItemsFromOntologyRows,
  buildRecentPdfResourcesFromOntologyRows,
  buildTrendingFromOntologyRows,
  fetchOntologyRows,
  fetchOntologySummary,
  formatOntologyFreshness,
  ragAssistantUrl,
} from '../lib/ontologyApi'
import gsdpIntroVideoUrl from '../assets/viedo/AI_Platform_Video_Generation_Request.mp4'
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

/** Hero slider data only — independent of recent-resource card selection. */
function buildPublicHomeHeroSlides(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const built = buildHeroSlidesFromOntologyRows(rows, { maxSlides: 6 })
  return built.length ? built : null
}

/** Recent resources strip: PDF documents only, newest first. */
function buildPublicHomeRecentPdfResources(rows) {
  return buildRecentPdfResourcesFromOntologyRows(rows, { limit: 4 })
}

// ── Fallback slide data (when API is empty or unreachable) ─────────────────
const FALLBACK_HERO_SLIDES = [
  {
    cls: 'hp-s1',
    bg: 'https://archive.sdb.org/images/headers/cabeceraInterior3.jpg',
    bgPos: 'center 30%',
    label: 'Welcome · Strenna 2026 · "Do Whatever He Tells You"',
    title: <>Don Bosco's mission,<br /><em>alive in every search.</em></>,
    lead: 'The Salesian intellectual and pastoral heritage — open, searchable, and connected. 12,847 resources across 136 nations, 261 schools, and 174 youth-at-risk centres.',
    placeholder: 'Search the corpus or ask in natural language…',
    cta: 'Search →',
    chips: ['Preventive System in Latin America 1950–1970', 'Youth at Risk · South Asia', 'Don Bosco educator method'],
  },
  {
    cls: 'hp-s2',
    bg: 'https://archive.sdb.org/images/headers/cabeceraInterior2.jpg',
    bgPos: 'center center',
    label: 'Rector Major · Fr. Fabio Attard',
    title: (
      <>
        <span className="hp-hero-worldline">
          <span className="hp-hero-world-n">136 nations</span>.
        </span>
        <br />
        <em>One Salesian heart.</em>
      </>
    ),
    lead: 'Elected on 25 March 2025, the 11th Successor of Don Bosco leads 13,750 Salesians in 92 provinces serving the poorest and most vulnerable young people worldwide.',
    placeholder: 'Try: "How did Don Bosco approach urban poverty in 19th century Turin?"',
    cta: 'Explore →',
    chips: ['Compare two encyclicals', 'Summarise the 29th General Chapter', 'Show me primary sources from 1888'],
  },
  {
    cls: 'hp-s3',
    bg: 'https://archive.sdb.org/images/headers/cabeceraInterior5.jpg',
    bgPos: 'center 32%',
    label: 'South Asia Pilot · 12 Provinces · 192 Hostels',
    title: <>Built in Bengaluru.<br /><em>Scaling to 92 provinces.</em></>,
    lead: 'Coordinated by the Don Bosco South Asia digital team and developed under the GC29 mandate. Now serving 261 schools and 174 youth-at-risk centres across India, Sri Lanka, Bangladesh, and Nepal.',
    placeholder: 'Explore South Asia institutions, programmes, and stories…',
    cta: 'Explore →',
    chips: ['Bangalore Province', 'Sri Lanka Vice-Province', 'Tribal mission archives · Northeast'],
  },
]

const FALLBACK_NEWS = [
  { key: 'n1', d: '17', m: 'Mar', loc: 'South Asia · Mumbai', head: 'SYMLEAD strengthens youth leadership and collaboration training', tag: 'Youth Ministry' },
  { key: 'n2', d: '15', m: 'Mar', loc: 'South Asia · Siliguri', head: 'LuvlyU launched to inspire mental wellness among peers', tag: 'Mental Health' },
  { key: 'n3', d: '14', m: 'Mar', loc: 'South Asia · Assam', head: 'Disaster preparedness boosted in Morigaon — SAFE Initiative', tag: 'Social Development' },
  { key: 'n4', d: '11', m: 'Mar', loc: 'Europe · Turin', head: '29th General Chapter publishes final guidelines on formation', tag: 'Formation' },
  { key: 'n5', d: '08', m: 'Mar', loc: 'South Asia · Chennai', head: 'Don Bosco Theological Centre hosts provincial study week', tag: 'General Salesian Resource' },
]

const FALLBACK_TRENDING = [
  { key: 't1', q: 'Preventive system in education', ct: '+42%', up: true },
  { key: 't2', q: 'Strenna 2026 commentary', ct: '+28%', up: true },
  { key: 't3', q: 'Youth ministry post-pandemic', ct: '+19%', up: true },
  { key: 't4', q: 'Salesian Bulletin · 1877 archive', ct: '→ steady', up: false },
]

const FALLBACK_COLLECTIONS = [
  { key: 'c1', cls: 'hp-c1', tag: 'Historical', ti: 'The Legacy of Michele Rua', ct: '47 resources' },
  { key: 'c2', cls: 'hp-c2', tag: 'Thematic', ti: 'Salesian Bulletin · Century Archive', ct: '1,200+ issues' },
  { key: 'c3', cls: 'hp-c3', tag: 'Regional', ti: 'Social Works in Latin America', ct: '89 resources' },
  { key: 'c4', cls: 'hp-c4', tag: 'Pedagogy', ti: 'The Preventive System Today', ct: '63 resources' },
  { key: 'c5', cls: 'hp-c5', tag: 'Youth Ministry', ti: 'World Youth Day · Salesian Presence', ct: '38 resources' },
  { key: 'c6', cls: 'hp-c6', tag: 'Formation', ti: 'Initial Formation · Global Standards', ct: '72 resources' },
]

function slideBackgroundStyle(s) {
  if (s.bg) {
    return {
      backgroundImage: `url(${s.bg})`,
      backgroundSize: 'cover',
      backgroundPosition: s.bgPos || 'center center',
    }
  }
  if (s.coverCss) {
    return {
      background: s.coverCss,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
    }
  }
  return undefined
}

// ── Hero Slider ──────────────────────────────────────────────────────────────
function HeroSlider({ slides: slidesProp, loading }) {
  const slidesForRender = slidesProp?.length ? slidesProp : FALLBACK_HERO_SLIDES
  const slideCount = loading ? 1 : slidesForRender.length

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
    if (loading || slideCount < 2) return
    timerRef.current = setInterval(() => go(), 5000)
  }, [go, loading, slideCount])

  useEffect(() => {
    if (loading || slideCount < 2) {
      clearInterval(timerRef.current)
      return undefined
    }
    resetTimer()
    return () => clearInterval(timerRef.current)
  }, [resetTimer, loading, slideCount])

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

  if (loading) {
    return (
      <div className="hp-hero-l hp-hero-loading" aria-busy="true" aria-label="Loading featured catalog">
        <div className="hp-slides">
          <div
            className="hp-slide hp-s1 active"
            style={{ background: 'linear-gradient(135deg,#003559 0%,#004a99 55%,#1f6eb8 100%)' }}
          >
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hp-hero-l" ref={heroRef} onMouseEnter={pause} onMouseLeave={resetTimer}>
      <div className="hp-slides">
        {slidesForRender.map((s, k) => {
          const bgStyle = slideBackgroundStyle(s)
          return (
            <div
              key={s.key ?? k}
              className={`hp-slide ${s.cls}${idx === k ? ' active' : ''}`}
              style={bgStyle}
            >
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
  const go = (id) => {
    closeAll()
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
      <div className={`hp-nav-dd-wrap${show(key) ? ' is-open' : ''}`}>
        <div className="hp-nav-dd-panel" role="menu">
          {sections.map((block, bi) => (
            <div key={block.title ?? `block-${bi}`}>
              {block.title && <div className="hp-nav-dd-h" role="presentation">{block.title}</div>}
              {block.items.map((item) =>
                item.href ? (
                  <a
                    key={item.href}
                    href={item.href}
                    className="hp-nav-dd-item"
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    onClick={closeAll}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    className="hp-nav-dd-item"
                    onClick={() => go(item.id)}
                  >
                    {item.label}
                  </button>
                ),
              )}
              {bi < sections.length - 1 && <div className="hp-nav-dd-sep" role="separator" />}
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
          items: [
            { label: 'About the platform', id: 'hp-foot-about' },
            { label: 'South Asia pilot', id: 'hp-foot-southasia' },
          ],
        },
        {
          title: 'Official websites',
          items: publicDiscoverLinks.map((l) => ({
            label: l.badge ? `${l.label} · ${l.badge}` : l.label,
            href: l.href,
          })),
        },
        {
          title: 'Congregation',
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
            fetchOntologyRows({ limit: 32, offset: 0 }),
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
    typeof ontologyBlock?.total === 'number'
      ? ontologyBlock.total
      : typeof ontologySummary?.total_rows === 'number'
        ? ontologySummary.total_rows
        : null
  const catalogTotalLabel =
    !homeFetchDone
      ? '…'
      : catalogTotal != null && Number.isFinite(catalogTotal)
        ? catalogTotal.toLocaleString()
        : '—'

  const heroSlides = useMemo(() => buildPublicHomeHeroSlides(homeRows), [homeRows])

  const recentPdfResources = useMemo(() => {
    if (!homeFetchDone) return []
    return buildPublicHomeRecentPdfResources(Array.isArray(homeRows) ? homeRows : [])
  }, [homeFetchDone, homeRows])

  const newsItems = useMemo(() => {
    if (!homeFetchDone) return []
    if (!Array.isArray(homeRows) || homeRows.length === 0) return FALLBACK_NEWS
    const n = buildNewsItemsFromOntologyRows(homeRows, { skip: 8, limit: 5 })
    return n.length ? n : FALLBACK_NEWS
  }, [homeFetchDone, homeRows])

  const trendingItems = useMemo(() => {
    if (!homeFetchDone) return []
    if (!Array.isArray(homeRows) || homeRows.length === 0) return FALLBACK_TRENDING
    const t = buildTrendingFromOntologyRows(homeRows, { limit: 4 })
    if (!t.length) return FALLBACK_TRENDING
    return t.map((row, i) => ({ ...row, key: `tr-${i}-${row.q}` }))
  }, [homeFetchDone, homeRows])

  const collectionCards = useMemo(() => {
    if (!homeFetchDone) return []
    if (!Array.isArray(homeRows) || homeRows.length === 0) return FALLBACK_COLLECTIONS
    const c = buildCollectionCardsFromOntologyRows(homeRows, { limit: 6 })
    return c.length ? c : FALLBACK_COLLECTIONS
  }, [homeFetchDone, homeRows])

  const liveUpdated = formatOntologyFreshness(ontologySummary)

  return (
    <>
      <div className="hp-root">

        {/* UTILITY BAR */}
        <div className="hp-util">
          <div className="hp-util-row">
            <div className="hp-util-l">
              <span><b>OPEN KNOWLEDGE</b></span>
              <span>South Asia Pilot</span>
              <span>Strenna 2026</span>
              <span>136 nations · 1,703 houses</span>
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
              <button className="hp-btn" onClick={() => navigate('/login')}>Sign in</button>
              <button className="hp-btn hp-btn-primary" onClick={() => navigate('/login')}>Enter Platform</button>
            </div>
          </div>
        </header>

        {/* HERO: full-width slider band, then sidebar row */}
        <section className="hp-hero-section" id="hp-section-hero">
          <div className="hp-hero-slider-bleed">
            <HeroSlider
              key={!homeFetchDone ? 'hero-loading' : heroSlides?.length ? 'hero-ontology' : 'hero-fallback'}
              loading={!homeFetchDone}
              slides={homeFetchDone ? (heroSlides ?? undefined) : undefined}
            />
          </div>

          <div className="hp-hero-sub" id="hp-section-live">
            <div className="hp-hero-r">
              {/* Rector card */}
              <div className="hp-rector">
                {!homeFetchDone ? (
                  <>
                    <div className="hp-rector-av hp-rector-av--skeleton" aria-hidden />
                    <div className="hp-rector-info hp-data-loading" aria-busy="true">
                      <div className="hp-skel-line hp-skel-on-light hp-skel-line--sm" />
                      <div className="hp-skel-line hp-skel-on-light hp-skel-line--title" />
                      <div className="hp-skel-line hp-skel-on-light hp-skel-line--xs" />
                    </div>
                    <div className="hp-rector-actions hp-data-loading" aria-hidden>
                      <div className="hp-skel-line hp-skel-on-light hp-skel-line--action" />
                      <div className="hp-skel-line hp-skel-on-light hp-skel-line--action hp-skel-line--action-narrow" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="hp-rector-av">FA</div>
                    <div className="hp-rector-info">
                      <div className="role">Rector Major · 11th Successor</div>
                      <h3>Fr. Fabio Attard</h3>
                      <div className="since">Since 25 Mar 2025 · Term 2025–2031</div>
                    </div>
                    <div className="hp-rector-actions">
                      <a>Biography ↗</a>
                      <a>Chapter docs ↗</a>
                    </div>
                  </>
                )}
              </div>

              {/* Live stack */}
              <div className="hp-live-stack">
                <div className="hp-live">
                  <div className="hp-live-h">
                    <span className="hp-live-lbl">Live Knowledge Base</span>
                    <span className="hp-live-upd">{liveUpdated ? `Index · ${liveUpdated}` : 'Updated today'}</span>
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
                      [
                        { v: catalogTotalLabel, k: 'Resources', d: 'Catalogued in ontology' },
                        { v: '136', k: 'Nations', d: "+2 since '24", world: true },
                        { v: '13,750', k: 'Salesians', d: 'GC29 census' },
                        { v: '5', k: 'Languages', d: 'EN·IT·ES·PT·FR' },
                      ].map((c, i) => (
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
                            <span className="hp-skel-line" />
                            <span className="hp-trend-ct hp-skel-pill hp-skel-pill--sm" />
                          </div>
                        ))}
                      </div>
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
                <div className="hp-panel-sub">News agency · 136 nations</div>
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
                newsItems.map((n, i) => (
                  <div
                    key={n.key ?? i}
                    className="hp-news-item"
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
                    <div className="hp-news-date"><div className="d">{n.d}</div><div className="m">{n.m}</div></div>
                    <div className="hp-news-body">
                      <div className="loc">{n.loc}</div>
                      <div className="head">{n.head}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Distribution */}
          <div className="hp-panel" id="hp-distribution">
            <div className="hp-panel-h">
              <div>
                <div className="hp-panel-title">Where the work happens</div>
                <div className="hp-panel-sub">7,240 institutions · by type</div>
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
              ) : (
                [
                  { lbl: 'DB Schools', pct: '78%', cls: 'a', num: '261' },
                  { lbl: 'Parishes', pct: '52%', cls: 'b', num: '174' },
                  { lbl: 'Youth-at-Risk', pct: '52%', cls: 'c', num: '174' },
                  { lbl: 'Technical Inst.', pct: '41%', cls: 'd', num: '138' },
                  { lbl: 'Formation', pct: '17%', cls: 'e', num: '57' },
                  { lbl: 'Colleges', pct: '15%', cls: 'a', num: '51' },
                ].map((r, i) => (
                  <div key={i} className="hp-dist-row">
                    <div className="hp-dist-lbl">{r.lbl}</div>
                    <DistBar pct={r.pct} cls={r.cls} />
                    <div className="hp-dist-num">{r.num}</div>
                  </div>
                ))
              )}
            </div>
            <div className="hp-dist-foot">
              <div className="hp-dist-foot-l">
                <strong>SOUTH ASIA PILOT</strong>
                <span className="hp-dist-sep">/</span>
                <span>12 PROVINCES</span>
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
                <div className="hp-panel-sub">1,703 communities active</div>
              </div>
              <button type="button" className="hp-panel-all" onClick={() => navigateLoginNext(navigate, '/dashboard/institutions')}>
                Explore map →
              </button>
            </div>
            <button type="button" className="hp-map-mini hp-map-mini--clickable" onClick={() => navigateLoginNext(navigate, '/dashboard/institutions')} aria-label="Explore map — sign in to open the full map">
              <img src="/assets/south_asia_map.png" alt="South Asia Pilot Map" className="hp-map-real" />
              <div className="hp-map-overlay">
                <div className="hp-map-overlay-text">Live Satellite Overview · sign in for interactive map</div>
              </div>
            </button>
            <div className="hp-map-foot">
              <div className="hp-map-legend">
                <span><span className="hp-map-dot" style={{ background: '#e67e22' }} />HQ</span>
                <span><span className="hp-map-dot" style={{ background: '#1f6eb8' }} />Pilot</span>
                <span><span className="hp-map-dot" style={{ background: '#1a8a6e' }} />Active</span>
                <span><span className="hp-map-dot" style={{ background: '#c9a227' }} />Mission</span>
              </div>
              <span><strong style={{ color: '#0b1733' }}>92</strong> provinces</span>
            </div>
          </div>
        </section>



        {/* RECENT RESOURCES */}
        <section className="hp-resources" id="hp-section-resources">
          <div className="hp-res-h">
            <div>
              <h2>Recent resources</h2>
              <div className="sub">Latest PDF documents catalogued on the platform</div>
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
              recentPdfResources.map((r) => (
                <div key={r.id} className="hp-res-card" onClick={() => setSelectedResource(r)}>
                  <div className="ti">{r.title}</div>
                  <div className="ct">
                    {r.author && r.author !== '—' ? r.author :
                      r.publisher ? r.publisher :
                        'Don Bosco South Asia'}
                  </div>
                </div>
              ))
            ) : (
              <div className="hp-res-card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#5a7aa0' }}>
                No PDF resources available at the moment.
              </div>
            )}
          </div>
        </section>



        {/* FOOTER */}
        <section className="hp-foot" id="hp-section-foot">
          <div className="hp-foot-card">
            <div className="hp-foot-about" id="hp-foot-about">
              <h4>About the Platform</h4>
              <p>Open-access knowledge platform of the Salesians of Don Bosco. Built for scholars, educators, ministers, and the curious — semantic AI search across 5 languages.</p>
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
            <a onClick={() => navigate('/login')}>Sign in</a>
          </div>
        </div>

        <AiAssistantDock variant="public" />
      </div>
      <ResourceDetailModal resource={selectedResource} onClose={() => setSelectedResource(null)} />
    </>
  )
}