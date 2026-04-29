import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SdbGlobeLogo } from '../branding/SdbGlobeLogo'
import { scrollToSection } from '../../lib/scrollTo'

const topLinks = [
  { label: 'ANS News', id: 'resources-pub' },
  { label: 'GC 29', id: 'council-pub' },
  { label: 'Provinces', id: 'provinces-pub' },
  { label: 'Salesian Family', id: 'networks-strip' },
]

const langs = ['EN', 'IT', 'ES', 'FR', 'PT']

/* pt-1 on wrapper bridges the gap so hover isn’t lost between trigger and panel */
const dropWrap = 'absolute left-0 top-full z-[200] min-w-[220px] pt-1'
const dropPanel =
  'rounded-xl border border-border-sdb bg-white py-1.5 pt-1 shadow-[0_8px_32px_rgba(0,57,117,0.12)] transition-opacity duration-150'

function navGo(id, closeAll) {
  closeAll()
  scrollToSection(id)
}

export function Header() {
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState(null)
  const [discHover, setDiscHover] = useState(false)
  const [abHover, setAbHover] = useState(false)
  const discoverRef = useRef(null)
  const aboutRef = useRef(null)
  const discLeaveTimer = useRef(null)
  const abLeaveTimer = useRef(null)

  const clearDiscTimer = () => {
    if (discLeaveTimer.current) {
      window.clearTimeout(discLeaveTimer.current)
      discLeaveTimer.current = null
    }
  }
  const clearAbTimer = () => {
    if (abLeaveTimer.current) {
      window.clearTimeout(abLeaveTimer.current)
      abLeaveTimer.current = null
    }
  }

  const closeAll = () => {
    setOpenMenu(null)
    setDiscHover(false)
    setAbHover(false)
    clearDiscTimer()
    clearAbTimer()
  }

  const discoverPinned = openMenu === 'discover'
  const aboutPinned = openMenu === 'about'
  const showDiscover = discoverPinned || discHover
  const showAbout = aboutPinned || abHover

  useEffect(() => {
    if (!openMenu && !discHover && !abHover) return undefined

    const onDocMouseDown = (e) => {
      if (discoverRef.current?.contains(e.target)) return
      if (aboutRef.current?.contains(e.target)) return
      closeAll()
    }

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeAll()
    }

    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openMenu, discHover, abHover])

  useEffect(
    () => () => {
      clearDiscTimer()
      clearAbTimer()
    },
    [],
  )

  const dropClass = (visible) =>
    `${dropPanel} ${visible ? 'pointer-events-auto visible opacity-100' : 'pointer-events-none invisible opacity-0'}`

  const dropWrapClass = (visible) =>
    `${dropWrap} ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`

  return (
    <header className="sticky top-0 z-[100]">
      <div className="flex h-10 items-center gap-5 overflow-x-auto border-b border-white/10 bg-sdb-blue-deep px-4 text-xs text-white/85 sm:px-8 lg:px-14">
        {topLinks.map(({ label, id }) => (
          <button
            key={label}
            type="button"
            className="shrink-0 cursor-pointer whitespace-nowrap transition-colors hover:text-white"
            onClick={() => scrollToSection(id)}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          {langs.map((code) => (
            <button
              key={code}
              type="button"
              className="cursor-pointer rounded border border-white/25 px-2.5 py-1 font-sans text-xs text-white/85 transition-colors hover:border-sdb-orange hover:bg-sdb-orange/15 hover:text-white"
            >
              {code}
            </button>
          ))}
        </div>
      </div>

      <nav className="flex h-[68px] items-center gap-0 border-b-[3px] border-sdb-orange bg-white px-4 shadow-[0_2px_12px_rgba(0,57,117,0.08)] sm:px-8 lg:px-14">
        <Link
          to="/"
          onClick={(e) => {
            if (location.pathname === '/') {
              e.preventDefault()
              closeAll()
              scrollToSection('hero')
            }
          }}
          className="flex shrink-0 items-center gap-2.5 no-underline"
        >
          <SdbGlobeLogo size={36} />
          <div className="hidden min-[380px]:block">
            <strong className="font-serif text-[13px] leading-tight tracking-wide text-sdb-blue-deep">
              Global Salesian Digital Platform
            </strong>
            <span className="block text-[9px] font-normal uppercase tracking-widest text-mid">
              Open knowledge · South Asia pilot
            </span>
          </div>
        </Link>

        {/* No overflow-x-auto here: it clips absolutely positioned Discover/About dropdowns */}
        <div className="ml-2 mr-auto flex min-w-0 max-w-[min(100%,calc(100vw-200px))] flex-1 flex-nowrap items-center gap-0 sm:ml-4 xl:ml-10">
          <button
            type="button"
            className="flex h-[68px] shrink-0 items-center gap-1 border-b-[3px] border-sdb-orange -mb-[3px] px-4 text-sm font-semibold tracking-wide text-sdb-blue-deep"
            onClick={() => {
              closeAll()
              scrollToSection('hero')
            }}
          >
            Home
          </button>

          <div
            ref={discoverRef}
            className="relative shrink-0"
            onMouseEnter={() => {
              clearDiscTimer()
              setDiscHover(true)
            }}
            onMouseLeave={() => {
              clearDiscTimer()
              discLeaveTimer.current = window.setTimeout(() => setDiscHover(false), 180)
            }}
          >
            <button
              type="button"
              aria-expanded={showDiscover}
              aria-haspopup="true"
              className={`flex h-[68px] cursor-pointer items-center gap-1 border-b-[3px] -mb-[3px] px-4 text-sm font-semibold tracking-wide transition-colors ${
                showDiscover
                  ? 'border-sdb-orange text-sdb-blue-deep'
                  : 'border-transparent text-slate-sdb hover:border-sdb-blue-light hover:text-sdb-blue'
              }`}
              onClick={() => setOpenMenu((m) => (m === 'discover' ? null : 'discover'))}
            >
              Discover{' '}
              <span
                className={`text-[10px] text-mid transition-transform ${showDiscover ? 'rotate-180' : ''}`}
              >
                ▾
              </span>
            </button>
            <div className={dropWrapClass(showDiscover)}>
              <div className={dropClass(showDiscover)} role="menu">
                <div className="px-[18px] pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-mid">
                  Knowledge
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer px-[18px] py-2 text-left text-[13px] font-medium text-slate-sdb hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={() => navGo('resources-pub', closeAll)}
                >
                  Resources
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer px-[18px] py-2 text-left text-[13px] font-medium text-slate-sdb hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={() => navGo('coll-pub', closeAll)}
                >
                  Collections
                </button>
                <div className="my-1 h-px bg-[#eaf0f8]" role="separator" />
                <div className="px-[18px] pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-mid">
                  Community
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer px-[18px] py-2 text-left text-[13px] font-medium text-slate-sdb hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={() => navGo('events-pub', closeAll)}
                >
                  Events
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer px-[18px] py-2 text-left text-[13px] font-medium text-slate-sdb hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={() => navGo('networks-strip', closeAll)}
                >
                  Networks
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="flex h-[68px] shrink-0 items-center gap-1 border-b-[3px] border-transparent -mb-[3px] px-4 text-sm font-semibold tracking-wide text-slate-sdb transition-colors hover:border-sdb-blue-light hover:text-sdb-blue"
            onClick={() => {
              closeAll()
              scrollToSection('institutions-pub')
            }}
          >
            Pastoral Works
          </button>

          <div
            ref={aboutRef}
            className="relative shrink-0"
            onMouseEnter={() => {
              clearAbTimer()
              setAbHover(true)
            }}
            onMouseLeave={() => {
              clearAbTimer()
              abLeaveTimer.current = window.setTimeout(() => setAbHover(false), 180)
            }}
          >
            <button
              type="button"
              aria-expanded={showAbout}
              aria-haspopup="true"
              className={`flex h-[68px] cursor-pointer items-center gap-1 border-b-[3px] -mb-[3px] px-4 text-sm font-semibold tracking-wide transition-colors ${
                showAbout
                  ? 'border-sdb-orange text-sdb-blue-deep'
                  : 'border-transparent text-slate-sdb hover:border-sdb-blue-light hover:text-sdb-blue'
              }`}
              onClick={() => setOpenMenu((m) => (m === 'about' ? null : 'about'))}
            >
              About{' '}
              <span className={`text-[10px] text-mid transition-transform ${showAbout ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>
            <div className={dropWrapClass(showAbout)}>
              <div className={dropClass(showAbout)} role="menu">
                <div className="px-[18px] pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-mid">
                  Platform
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer px-[18px] py-2 text-left text-[13px] font-medium text-slate-sdb hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={() => navGo('tech-pub', closeAll)}
                >
                  Technology
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer px-[18px] py-2 text-left text-[13px] font-medium text-slate-sdb hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={() => navGo('about-pub', closeAll)}
                >
                  About Us
                </button>
                <div className="my-1 h-px bg-[#eaf0f8]" role="separator" />
                <div className="px-[18px] pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-mid">
                  Congregation
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full cursor-pointer px-[18px] py-2 text-left text-[13px] font-medium text-slate-sdb hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={() => navGo('council-pub', closeAll)}
                >
                  Organization
                </button>
                <div className="my-1 h-px bg-[#eaf0f8]" role="separator" />
                <div className="px-[18px] pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-mid">
                  External
                </div>
                <a
                  href="https://www.sdb.org"
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  className="block px-[18px] py-2 text-[13px] font-medium text-slate-sdb no-underline hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={closeAll}
                >
                  SDB.org ↗
                </a>
                <a
                  href="https://www.donboscosouthasia.org"
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  className="block px-[18px] py-2 text-[13px] font-medium text-slate-sdb no-underline hover:bg-sdb-blue-pale hover:text-sdb-blue-deep"
                  onClick={closeAll}
                >
                  South Asia ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <Link
            to="/login"
            className="cursor-pointer rounded-lg border border-sdb-blue bg-transparent px-4 py-2 text-center font-sans text-[13px] font-semibold text-sdb-blue no-underline transition-colors hover:bg-sdb-blue-pale max-sm:px-3 max-sm:text-xs"
          >
            Sign In
          </Link>
          <Link
            to="/login"
            className="cursor-pointer rounded-lg border-none bg-sdb-orange px-4 py-2 text-center font-sans text-[13px] font-semibold text-white no-underline transition-[filter] hover:brightness-110 max-sm:px-3 max-sm:text-xs"
          >
            Enter Platform →
          </Link>
        </div>
      </nav>
    </header>
  )
}
