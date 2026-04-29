import { Link } from 'react-router-dom'
import { SdbGlobeLogo } from '../branding/SdbGlobeLogo'
import {
  footerGlobalLinks,
  footerProvinces,
  footerQuickLinks,
  footerRegionalNetworks,
} from '../../data/footerData'

function FooterPlainLink({ href, title, url, className = '' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex flex-col gap-px rounded-md px-2 py-1.5 no-underline transition-colors hover:bg-white/[0.07] hover:text-white ${className}`}
    >
      <span className="text-[13px] font-medium leading-snug text-white/85">{title}</span>
      <span className="mt-px text-[11px] text-white/40">{url}</span>
    </a>
  )
}

function FooterProvinceLink({ href, badge, title, url, badgeClass = '' }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 no-underline transition-colors hover:bg-white/[0.07] hover:text-white"
    >
      <span
        className={`inline-flex min-w-[34px] shrink-0 self-start rounded px-1.5 py-0.5 text-center text-[10px] font-bold text-white ${badgeClass || 'bg-sdb-blue-mid'}`}
      >
        {badge}
      </span>
      <span className="text-[13px] font-medium leading-snug text-white/85">{title}</span>
      <span className="text-[11px] text-white/40">{url}</span>
    </a>
  )
}

export function Footer({ onFooterAction }) {
  const notify = (label) => () => onFooterAction?.(label)

  return (
    <footer
      className="border-t-[3px] border-sdb-orange bg-sdb-blue-deep"
      aria-label="Site footer"
    >
      <div className="grid grid-cols-1 gap-9 px-4 py-10 sm:px-8 md:grid-cols-2 xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] xl:gap-9 xl:px-14 xl:pb-10 xl:pt-[52px]">
        <div>
          <SdbGlobeLogo size={44} />
          <div className="mt-3.5">
            <div className="font-serif text-base font-bold leading-tight text-white">
              Global Salesian
              <br />
              Digital Platform
            </div>
            <div className="mt-1.5 text-[11px] uppercase tracking-wider text-white/45">
              Open access · worldwide
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-white/55 max-xl:max-w-md">
            Open-access knowledge platform of the Salesians of Don Bosco — 136 nations, 12,847
            resources, 5 languages.
          </p>
          <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3.5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-peach-accent">
              Strenna 2026
            </div>
            <div className="text-xs italic leading-relaxed text-white/70">
              &quot;Do Whatever He Tells You. Believers, Free to Serve.&quot;
            </div>
            <div className="mt-1 text-[11px] text-white/40">— Fr. Fabio Attard · Rector Major</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href="https://www.youtube.com/user/DonBoscoSouthAsia"
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[13px] text-white/75 no-underline transition-colors hover:border-sdb-orange hover:bg-sdb-orange hover:text-white"
              aria-label="YouTube channel"
            >
              ▶
            </a>
            <a
              href="https://www.subscribepage.com/donboscosouthasia"
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[13px] text-white/75 no-underline transition-colors hover:border-sdb-orange hover:bg-sdb-orange hover:text-white"
              aria-label="Subscribe to newsletter"
            >
              ✉
            </a>
            <a
              href="https://www.donboscosouthasia.org/SocialMediaIndex"
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[13px] text-white/75 no-underline transition-colors hover:border-sdb-orange hover:bg-sdb-orange hover:text-white"
              aria-label="Social media index"
            >
              ⊞
            </a>
            <a
              href="https://open.spotify.com/show/6xwGk1B4ccKPhzpi4sjpSg"
              target="_blank"
              rel="noreferrer"
              className="inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[13px] text-white/75 no-underline transition-colors hover:border-sdb-orange hover:bg-sdb-orange hover:text-white"
              aria-label="Podcast on Spotify"
            >
              🎙
            </a>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="mb-2 border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-wider text-peach-accent">
            🌐 Quick Links
          </div>
          {footerQuickLinks.map((l) => (
            <FooterPlainLink key={l.href} {...l} />
          ))}
          <div className="my-2 h-px bg-white/[0.08]" />
          <Link
            to="/login"
            className="flex flex-col gap-px rounded-md px-2 py-1.5 text-left no-underline transition-colors hover:bg-white/[0.07]"
          >
            <span className="text-[13px] font-medium text-peach-accent">Sign in to the platform →</span>
            <span className="text-[11px] text-white/40">Global Salesian Digital Platform</span>
          </Link>
        </div>

        <div id="provinces-pub" className="scroll-mt-28 flex min-w-0 flex-col gap-0.5">
          <div className="mb-2 border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-wider text-peach-accent">
            🏛️ South Asia Provinces
          </div>
          {footerProvinces.map((p) => (
            <FooterProvinceLink key={p.badge} {...p} />
          ))}
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="mb-2 border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-wider text-peach-accent">
            🔗 Regional Networks
          </div>
          {footerRegionalNetworks.map((l) => (
            <FooterPlainLink key={l.href} {...l} />
          ))}
          <div className="my-2 h-px bg-white/[0.08]" />
          <div className="mb-2 mt-2 border-b border-white/10 pb-2 text-xs font-bold uppercase tracking-wider text-peach-accent">
            🌍 Global Links
          </div>
          {footerGlobalLinks.map((l) => (
            <FooterPlainLink key={l.href} {...l} />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-2.5 border-t border-white/10 bg-black/15 px-4 py-4 text-center sm:flex-row sm:text-left md:px-8 lg:px-14">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-3">
          <div className="text-[13px] font-semibold text-white/65">Global Salesian Digital Platform</div>
          <div className="hidden h-3.5 w-px bg-white/15 sm:block" />
          <div className="text-xs text-white/35">
            © 2026 Salesians of Don Bosco · All public resources are open access
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-5">
          {['Privacy', 'Terms', 'Accessibility', 'Technology'].map((label) => (
            <button
              key={label}
              type="button"
              onClick={notify(`${label} — platform`)}
              className="cursor-pointer text-xs text-white/40 transition-colors hover:text-white/75"
            >
              {label}
            </button>
          ))}
          <Link
            to="/login"
            className="cursor-pointer text-xs text-white/40 no-underline transition-colors hover:text-white/75"
          >
            Sign In
          </Link>
        </div>
      </div>
    </footer>
  )
}
