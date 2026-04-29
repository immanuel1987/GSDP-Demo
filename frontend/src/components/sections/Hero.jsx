import { useCallback, useEffect, useState } from 'react'
import { scrollToSection } from '../../lib/scrollTo'

const BG = {
  a: 'https://archive.sdb.org/images/headers/cabeceraInterior3.jpg',
  b: 'https://www.donboscosouthasia.org/websites/donboscosouthasia.org/themes/default/homelayout/img/education.jpg',
  c: 'https://www.donboscosouthasia.org/websites/donboscosouthasia.org/themes/default/homelayout/img/youth_focus.jpg',
}

const slides = [
  {
    key: 'a',
    bg: BG.a,
    bgPos: 'center 30%',
    eyebrow: 'Welcome to the Global Salesian Digital Platform',
    title: (
      <>
        Don Bosco&apos;s mission,
        <br />
        <em className="font-normal not-italic text-peach-accent">alive in every search</em>
      </>
    ),
    sub: '12,000+ resources across 136 nations. 261 schools. 138 technical institutes. 174 Young-at-Risk centres. The knowledge of the Salesian Family — open, searchable, and alive.',
    primary: { label: 'Browse Resources', scroll: 'resources-pub' },
    secondary: { label: '✦ Ask the AI Assistant', action: 'ai' },
  },
  {
    key: 'b',
    bg: BG.b,
    bgPos: 'center center',
    eyebrow: 'Rector Major · Fr. Fabio Attard',
    title: (
      <>
        136 nations.
        <br />
        <em className="font-normal not-italic text-peach-accent">One Salesian heart.</em>
      </>
    ),
    sub: 'Elected on 25 March 2025, the 11th Successor of Don Bosco leads 13,750 Salesians in 92 provinces serving the poorest and most vulnerable young people worldwide.',
    primary: { label: 'Meet the General Council', scroll: 'council-pub' },
    secondary: { label: '29th General Chapter →', action: 'gc29' },
  },
  {
    key: 'c',
    bg: BG.c,
    bgPos: 'center top',
    eyebrow: 'Strenna 2026 · Do Whatever He Tells You',
    title: (
      <>
        Journeying together
        <br />
        <em className="font-normal not-italic text-peach-accent">with the young</em>
      </>
    ),
    sub: 'From Guwahati to Colombo, from Mumbai to Kathmandu — Salesians walk beside the poorest youth every day. Explore the mission, the methods, and the people behind it.',
    primary: { label: 'Explore Collections', scroll: 'coll-pub' },
    secondary: { label: 'Sign in for full access', action: 'signin' },
  },
]

export function Hero({ onAiAssistant, onSignIn, onToast }) {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused) return undefined
    const t = setInterval(() => {
      setActive((i) => (i + 1) % slides.length)
    }, 7000)
    return () => clearInterval(t)
  }, [paused])

  const runSecondary = useCallback(
    (action) => {
      if (action === 'ai') onAiAssistant?.()
      else if (action === 'signin') onSignIn?.()
      else if (action === 'gc29') onToast?.('Opening: 29th General Chapter documents')
    },
    [onAiAssistant, onSignIn, onToast],
  )

  return (
    <section id="hero" className="relative h-[420px] overflow-hidden sm:h-[480px] lg:h-[560px]">
      {slides.map((slide, i) => (
        <div
          key={slide.key}
          className={`absolute inset-0 flex items-end transition-opacity duration-[900ms] ease-out ${
            i === active ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={i !== active}
        >
          <div
            className="absolute inset-0 bg-cover bg-center after:absolute after:inset-0 after:bg-gradient-to-t after:from-[rgba(0,30,80,0.92)] after:via-[rgba(0,30,80,0.55)] after:via-45% after:to-[rgba(0,30,80,0.25)]"
            style={{
              backgroundImage: `url(${slide.bg})`,
              backgroundPosition: slide.bgPos,
            }}
          />
          <div className="pointer-events-none absolute -top-[60px] right-[8%] size-[280px] rounded-full border border-white/[0.06] bg-[radial-gradient(circle,rgba(34,114,195,0.2),transparent_70%)] sm:right-[120px] sm:size-[420px] after:absolute after:inset-[30px] after:rounded-full after:border after:border-white/[0.05]" />
          <div className="relative z-[2] w-full px-4 pb-24 pt-10 sm:px-8 lg:px-14 lg:pb-28 lg:pt-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sdb-orange/40 bg-sdb-orange/20 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-peach-accent">
              {slide.eyebrow}
            </div>
            <h1 className="mb-3.5 max-w-[640px] font-serif text-3xl font-black leading-snug text-white sm:text-4xl lg:text-[38px]">
              {slide.title}
            </h1>
            <p className="mb-7 max-w-[520px] text-[15px] leading-relaxed text-white/80">{slide.sub}</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => scrollToSection(slide.primary.scroll)}
                className="cursor-pointer rounded-lg border-none bg-sdb-orange px-7 py-3.5 font-sans text-sm font-bold text-white transition-[filter] hover:brightness-110"
              >
                {slide.primary.label}
              </button>
              <button
                type="button"
                onClick={() => runSecondary(slide.secondary.action)}
                className="cursor-pointer rounded-lg border border-white/30 bg-white/10 px-7 py-3.5 font-sans text-sm font-semibold text-white transition-colors hover:bg-white/[0.18]"
              >
                {slide.secondary.label}
              </button>
            </div>
          </div>
        </div>
      ))}

      <div
        className="absolute bottom-5 left-4 z-10 flex gap-2 sm:left-8 lg:left-14"
        role="group"
        aria-label="Carousel navigation"
      >
        {slides.map((_, i) => (
          <button
            key={slides[i].key}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setActive(i)}
            className={`h-1 cursor-pointer rounded-sm border-none p-0 transition-all ${
              i === active ? 'w-11 bg-sdb-orange' : 'w-7 bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
        <button
          type="button"
          aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
          title="Pause/resume"
          onClick={() => setPaused((p) => !p)}
          className="ml-1.5 inline-flex size-[26px] cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/15 p-0 font-sans text-[10px] leading-none text-white transition-colors hover:bg-white/25"
        >
          {paused ? '▶' : '⏸'}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onToast?.('▶ Opening platform overview — 2 min')}
        className="absolute bottom-5 right-4 z-10 flex cursor-pointer items-center gap-2.5 rounded-full border border-white/20 bg-white/12 py-2 pl-2 pr-4 transition-colors hover:bg-white/20 sm:right-8 lg:right-14"
      >
        <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-sdb-orange text-[11px] text-white">
          ▶
        </span>
        <span className="text-xs font-semibold text-white/90">Watch overview</span>
      </button>
    </section>
  )
}
