import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AiAssistantDock } from '../components/AiAssistantDock'
import { scrollToSection } from '../lib/scrollTo'
import { publicDiscoverLinks, publicNetworkFooterLinks, footerProvinces } from '../data/footerData'
import gsdpIntroVideoUrl from '../assets/viedo/AI_Platform_Video_Generation_Request.mp4'
import './PublicHomePage.css'

// ── Slide data ──────────────────────────────────────────────────────────────
const SLIDES = [
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
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
      </svg>
    ),
  },
  {
    cls: 'hp-s2',
    bg: 'https://archive.sdb.org/images/headers/cabeceraInterior2.jpg',
    bgPos: 'center center',
    label: 'Rector Major · Fr. Fabio Attard',
    title: <>136 nations.<br /><em>One Salesian heart.</em></>,
    lead: 'Elected on 25 March 2025, the 11th Successor of Don Bosco leads 13,750 Salesians in 92 provinces serving the poorest and most vulnerable young people worldwide.',
    placeholder: 'Try: "How did Don Bosco approach urban poverty in 19th century Turin?"',
    cta: 'Explore →',
    chips: ['Compare two encyclicals', 'Summarise the 29th General Chapter', 'Show me primary sources from 1888'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1z" />
      </svg>
    ),
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
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      </svg>
    ),
  },
]

// ── Hero Slider ──────────────────────────────────────────────────────────────
function HeroSlider() {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const timerRef = useRef(null)
  const heroRef = useRef(null)
  const overviewVideoRef = useRef(null)
  // one ref per slide for the cmd input
  const inputRefs = useRef(SLIDES.map(() => ({ current: null })))

  const heroSend = () => {
    const el = inputRefs.current[idx]?.current
    const q = (el?.value ?? '').trim()
    navigate('/login', q ? { state: { prefilledPrompt: q } } : {})
  }

  const go = useCallback((i) => {
    setIdx((prev) => {
      const next = ((i === undefined ? prev + 1 : i) + SLIDES.length) % SLIDES.length
      return next
    })
  }, [])

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => go(), 6500)
  }, [go])

  useEffect(() => {
    resetTimer()
    return () => clearInterval(timerRef.current)
  }, [resetTimer])

  useEffect(() => {
    if (!overviewOpen) return undefined
    const v = overviewVideoRef.current
    if (v) {
      v.currentTime = 0
      v.play().catch(() => {})
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

  const handleChip = (text, inputRef) => {
    if (inputRef.current) { inputRef.current.value = text; inputRef.current.focus() }
  }

  return (
    <div className="hp-hero-l" ref={heroRef} onMouseEnter={pause} onMouseLeave={resetTimer}>
      <div className="hp-slides">
        {SLIDES.map((s, k) => {
          const inputRef = inputRefs.current[k]
          return (
            <div
              key={k}
              className={`hp-slide ${s.cls}${idx === k ? ' active' : ''}`}
              style={s.bg ? {
                backgroundImage: `url(${s.bg})`,
                backgroundSize: 'cover',
                backgroundPosition: s.bgPos || 'center center',
              } : undefined}
            >
              {/* Dark overlay so text stays legible on photos */}
              <div className="hp-slide-img-overlay" />
              <div className="hp-slide-count"><b>{String(k + 1).padStart(2, '0')}</b> / {String(SLIDES.length).padStart(2, '0')}</div>
              <div>
                <div className="hp-hero-tag"><span className="hp-tag-dot" />{s.label}</div>
                <h1>{s.title}</h1>
                <p className="hp-lead">{s.lead}</p>
              </div>
              <div className="hp-cmd">
                <div className="hp-cmd-bar">
                  {s.icon}
                  <input ref={(el) => { inputRef.current = el }} placeholder={s.placeholder} />
                  <button type="button" className="hp-cmd-send" onClick={heroSend}>
                    Send
                  </button>
                  <button type="button" className="hp-cmd-go">{s.cta}</button>
                </div>
                <div className="hp-cmd-chips">
                  {s.chips.map((c, ci) => (
                    <button key={ci} className="hp-chip" onClick={() => handleChip(c, inputRef)}>{c}</button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Controls */}
      <div className="hp-slider-ctrl">
        <div className="hp-dots">
          {SLIDES.map((_, k) => (
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
    scrollToSection(id)
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

  return (
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
            <div className="hp-brand-mark">G</div>
            <div className="hp-brand-txt">
              <div className="l1">Global Salesian</div>
              <div className="l2">Digital Platform</div>
            </div>
          </div>
          <HpNavMenu />
          <div className="hp-nav-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" />
            </svg>
            <input placeholder="Search 12,847 resources…" />
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
          <HeroSlider />
        </div>

        <div className="hp-hero-sub" id="hp-section-live">
          <div className="hp-hero-r">
            {/* Rector card */}
            <div className="hp-rector">
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
          </div>

          {/* Live stack */}
          <div className="hp-live-stack">
            <div className="hp-live">
              <div className="hp-live-h">
                <span className="hp-live-lbl">Live Knowledge Base</span>
                <span className="hp-live-upd">Updated today</span>
              </div>
              <div className="hp-live-grid">
                {[
                  { v: '12,847', k: 'Resources', d: '▲ 312 / mo' },
                  { v: '136', k: 'Nations', d: '+2 since \'24' },
                  { v: '13,750', k: 'Salesians', d: 'GC29 census' },
                  { v: '5', k: 'Languages', d: 'EN·IT·ES·PT·FR' },
                ].map((c, i) => (
                  <div key={i} className="hp-live-cell">
                    <div className="v">{c.v}</div>
                    <div className="k">{c.k}</div>
                    <div className="delta">{c.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trending */}
            <div className="hp-trend">
              <div className="hp-trend-h">
                <span className="hp-trend-t">Trending searches</span>
                <span className="hp-trend-week">Past 7 days</span>
              </div>
              <div className="hp-trend-list">
                {[
                  { q: 'Preventive system in education', ct: '+42%', up: true },
                  { q: 'Strenna 2026 commentary', ct: '+28%', up: true },
                  { q: 'Youth ministry post-pandemic', ct: '+19%', up: true },
                  { q: 'Salesian Bulletin · 1877 archive', ct: '→ steady', up: false },
                ].map((t, i) => (
                  <div key={i} className="hp-trend-row">
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
                ))}
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
            <a className="hp-panel-all" onClick={() => navigate('/login')} style={{ cursor: 'pointer' }}>
              All news →
            </a>
       
          </div>
          <div className="hp-news-list">
            {[
              { d: '17', m: 'Mar', loc: 'South Asia · Mumbai', head: 'SYMLEAD strengthens youth leadership and collaboration training', tag: 'Youth Ministry' },
              { d: '15', m: 'Mar', loc: 'South Asia · Siliguri', head: 'LuvlyU launched to inspire mental wellness among peers', tag: 'Mental Health' },
              { d: '14', m: 'Mar', loc: 'South Asia · Assam', head: 'Disaster preparedness boosted in Morigaon — SAFE Initiative', tag: 'Social Development' },
              { d: '11', m: 'Mar', loc: 'Europe · Turin', head: '29th General Chapter publishes final guidelines on formation', tag: 'Formation' },
            ].map((n, i) => (
              <div key={i} className="hp-news-item">
                <div className="hp-news-date"><div className="d">{n.d}</div><div className="m">{n.m}</div></div>
                <div className="hp-news-body">
                  <div className="loc">{n.loc}</div>
                  <div className="head">{n.head}</div>
                  <span className="tag">{n.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution */}
        <div className="hp-panel" id="hp-distribution">
          <div className="hp-panel-h">
            <div>
              <div className="hp-panel-title">Where the work happens</div>
              <div className="hp-panel-sub">7,240 institutions · by type</div>
            </div>
            <button type="button" className="hp-panel-all" onClick={() => navigate('/login')}>
              Map →
            </button>
          </div>
          <div className="hp-dist">
            {[
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
            ))}
          </div>
          <div className="hp-dist-foot">
            <span><strong>South Asia pilot</strong> · 12 provinces</span>
            <a className="hp-panel-all">Full directory →</a>
          </div>
        </div>

        {/* Map */}
        <div className="hp-panel" id="hp-map-panel">
          <div className="hp-panel-h">
            <div>
              <div className="hp-panel-title">Global presence</div>
              <div className="hp-panel-sub">1,703 communities active</div>
            </div>
            <button type="button" className="hp-panel-all" onClick={() => navigate('/login')}>
              Explore map →
            </button>
          </div>
          <button type="button" className="hp-map-mini hp-map-mini--clickable" onClick={() => navigate('/login')} aria-label="Explore map — sign in to open the full map">
            <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet" className="hp-map-svg" aria-hidden>
              <defs>
                <linearGradient id="hp-map-ocean" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d8ecfc" />
                  <stop offset="100%" stopColor="#b8daf4" />
                </linearGradient>
                <filter id="hp-map-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.35" />
                </filter>
              </defs>
              <rect width="400" height="220" fill="url(#hp-map-ocean)" rx="4" />
              <g stroke="#8aa4bd" strokeWidth="0.35" opacity="0.45">
                <line x1="0" y1="55" x2="400" y2="55" strokeDasharray="3 5" />
                <line x1="0" y1="110" x2="400" y2="110" strokeDasharray="3 5" />
                <line x1="0" y1="165" x2="400" y2="165" strokeDasharray="3 5" />
                <line x1="100" y1="0" x2="100" y2="220" strokeDasharray="3 5" />
                <line x1="200" y1="0" x2="200" y2="220" strokeDasharray="3 5" />
                <line x1="300" y1="0" x2="300" y2="220" strokeDasharray="3 5" />
              </g>
              <g fill="#e8efe6" stroke="#6b8cae" strokeWidth="1.1" strokeLinejoin="round">
                <path d="M30,40 Q40,30 70,35 L95,55 L100,80 Q90,95 70,95 L50,90 L35,75 Q25,60 30,40 Z" />
                <path d="M85,105 L100,105 L105,140 L95,170 L80,165 L78,135 Z" />
                <path d="M180,40 Q195,32 215,38 L225,55 L215,68 L195,70 L180,60 Z" />
                <path d="M195,75 L225,80 L230,115 L220,150 L205,160 L185,140 L185,105 Z" />
                <path d="M230,35 Q260,28 310,38 L340,55 L335,90 L310,100 L275,95 L240,80 L228,55 Z" />
                <path d="M275,95 L290,95 L292,120 L283,128 L275,115 Z" />
                <path d="M310,140 L350,138 L355,158 L325,165 L308,155 Z" />
              </g>
              <g fontFamily="'JetBrains Mono', ui-monospace, monospace" fontWeight="600">
                <g filter="url(#hp-map-glow)">
                  <circle cx="200" cy="58" r="10" fill="#e86520" opacity="0.22" />
                  <circle cx="200" cy="58" r="5" fill="#e86520" stroke="#fff" strokeWidth="1.5" />
                  <text x="200" y="42" textAnchor="middle" fontSize="10" fill="#0a2540">Valdocco · HQ</text>
                </g>
                <g filter="url(#hp-map-glow)">
                  <circle cx="283" cy="112" r="11" fill="#2563c4" opacity="0.22" />
                  <circle cx="283" cy="112" r="5.5" fill="#2563c4" stroke="#fff" strokeWidth="1.5" />
                  <text x="283" y="132" textAnchor="middle" fontSize="10" fill="#0a2540">South Asia pilot</text>
                </g>
                <circle cx="65" cy="72" r="4" fill="#1a8a6e" stroke="#fff" strokeWidth="1.2" />
                <circle cx="92" cy="138" r="4" fill="#1a8a6e" stroke="#fff" strokeWidth="1.2" />
                <circle cx="212" cy="122" r="4" fill="#1a8a6e" stroke="#fff" strokeWidth="1.2" />
                <circle cx="322" cy="82" r="4" fill="#1a8a6e" stroke="#fff" strokeWidth="1.2" />
                <circle cx="337" cy="158" r="4" fill="#1a8a6e" stroke="#fff" strokeWidth="1.2" />
                <circle cx="55" cy="56" r="3.5" fill="#c9a227" stroke="#fff" strokeWidth="1" />
                <circle cx="182" cy="52" r="3.5" fill="#c9a227" stroke="#fff" strokeWidth="1" />
                <circle cx="242" cy="72" r="3.5" fill="#c9a227" stroke="#fff" strokeWidth="1" />
                <circle cx="202" cy="138" r="3.5" fill="#c9a227" stroke="#fff" strokeWidth="1" />
              </g>
              <text x="200" y="208" textAnchor="middle" fontFamily="'JetBrains Mono', ui-monospace, monospace" fontSize="9" fill="#3d5a78" opacity="0.85">
                Stylised overview · sign in for interactive map
              </text>
            </svg>
          </button>
          <div className="hp-map-foot">
            <div className="hp-map-legend">
              <span><span className="hp-map-dot" style={{ background: '#e86520' }} />HQ</span>
              <span><span className="hp-map-dot" style={{ background: '#2563c4' }} />Pilot</span>
              <span><span className="hp-map-dot" style={{ background: '#1a8a6e' }} />Active</span>
              <span><span className="hp-map-dot" style={{ background: '#c9a227' }} />Mission</span>
            </div>
            <span><strong style={{ color: '#0b1733' }}>92</strong> provinces</span>
          </div>
        </div>
      </section>

      {/* KNOWLEDGE GROWTH STRIP */}
      <section className="hp-growth" id="hp-section-growth">
        <div className="hp-growth-card">
          <div className="hp-growth-l">
            <h3>Corpus growing every week</h3>
            <p className="desc">Resources catalogued under MARC21 with semantic enrichment. Every addition is OWL-validated and searchable across 5 languages within 24h.</p>
          </div>
          <div className="hp-growth-chart">
            <svg viewBox="0 0 600 90" preserveAspectRatio="none">
              <defs>
                <linearGradient id="hp-grow" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#c8541b" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#c8541b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="20" x2="600" y2="20" stroke="#e8e0c8" strokeDasharray="2 4" />
              <line x1="0" y1="55" x2="600" y2="55" stroke="#e8e0c8" strokeDasharray="2 4" />
              <path d="M0,80 L40,75 L80,72 L120,68 L160,60 L200,58 L240,52 L280,48 L320,42 L360,36 L400,30 L440,26 L480,20 L520,15 L560,12 L600,8 L600,90 L0,90 Z" fill="url(#hp-grow)" />
              <path d="M0,80 L40,75 L80,72 L120,68 L160,60 L200,58 L240,52 L280,48 L320,42 L360,36 L400,30 L440,26 L480,20 L520,15 L560,12 L600,8" fill="none" stroke="#c8541b" strokeWidth="2" />
              <circle cx="0" cy="80" r="3" fill="#c8541b" />
              <circle cx="200" cy="58" r="3" fill="#c8541b" />
              <circle cx="400" cy="30" r="3" fill="#c8541b" />
              <circle cx="600" cy="8" r="4" fill="#c8541b" stroke="#fff" strokeWidth="2" />
              <text x="0" y="89" fontFamily="JetBrains Mono" fontSize="8" fill="#6b6452">Q1 '24</text>
              <text x="200" y="89" fontFamily="JetBrains Mono" fontSize="8" fill="#6b6452">Q3 '24</text>
              <text x="400" y="89" fontFamily="JetBrains Mono" fontSize="8" fill="#6b6452">Q1 '25</text>
              <text x="565" y="89" fontFamily="JetBrains Mono" fontSize="8" fill="#0b1733" fontWeight="600">Q1 '26</text>
            </svg>
          </div>
          <div className="hp-growth-r">
            <div className="hp-growth-stat"><span className="k">Total resources</span><span className="v">12,847 <small>▲ 312/mo</small></span></div>
            <div className="hp-growth-stat"><span className="k">Avg time-to-index</span><span className="v">18 hrs <small>−4h</small></span></div>
            <div className="hp-growth-stat"><span className="k">Open access ratio</span><span className="v">100% <small>full corpus</small></span></div>
            <div className="hp-growth-stat"><span className="k">Active phase</span><span className="v" style={{ color: '#c8541b' }}>Phase 2 · AI</span></div>
          </div>
        </div>
      </section>

      {/* CURATED COLLECTIONS */}
      <section className="hp-collections" id="hp-section-collections">
        <div className="hp-col-h">
          <div>
            <h2>Curated collections</h2>
            <div className="sub">Thematic knowledge paths — discover without needing an exact query</div>
          </div>
          <button type="button" className="hp-col-all" onClick={() => navigate('/login')}>
            All collections →
          </button>
        </div>
        <div className="hp-col-grid">
          {[
            { cls: 'hp-c1', tag: 'Historical', ti: 'The Legacy of Michele Rua', ct: '47 resources' },
            { cls: 'hp-c2', tag: 'Thematic', ti: 'Salesian Bulletin · Century Archive', ct: '1,200+ issues' },
            { cls: 'hp-c3', tag: 'Regional', ti: 'Social Works in Latin America', ct: '89 resources' },
            { cls: 'hp-c4', tag: 'Pedagogy', ti: 'The Preventive System Today', ct: '63 resources' },
            { cls: 'hp-c5', tag: 'Youth Ministry', ti: 'World Youth Day · Salesian Presence', ct: '38 resources' },
            { cls: 'hp-c6', tag: 'Formation', ti: 'Initial Formation · Global Standards', ct: '72 resources' },
          ].map((c, i) => (
            <button key={i} type="button" className={`hp-col-card ${c.cls}`} onClick={() => navigate('/login')}>
              <div>
                <div className="tag">{c.tag}</div>
                <div className="ti">{c.ti}</div>
              </div>
              <div className="ct">{c.ct}</div>
            </button>
          ))}
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
  )
}
