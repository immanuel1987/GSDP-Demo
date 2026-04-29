export function NetworksStrip({ onToast, onEnterPlatform }) {
  return (
    <section id="networks-strip" className="bg-white px-4 py-10 sm:px-8 lg:px-14 lg:py-[52px]">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-serif text-2xl font-bold text-sdb-blue-deep">The Salesian Network</div>
          <div className="mb-2 mt-2.5 h-0.5 w-12 rounded-sm bg-sdb-orange" />
          <div className="text-sm text-mid">
            12 provinces · regional networks · global partners — all connected through one platform
          </div>
        </div>
        <button
          type="button"
          onClick={onEnterPlatform}
          className="self-start cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-orange-text transition-colors hover:bg-orange-text/10 sm:self-auto"
        >
          Explore full directory →
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border-sdb bg-off-white p-5 transition-all hover:border-sdb-blue-light hover:shadow-[0_4px_20px_rgba(0,57,117,0.08)]">
          <div className="mb-2.5 text-2xl">🗺</div>
          <div className="mb-1.5 font-serif text-sm font-bold text-sdb-blue-deep">12 South Asia provinces</div>
          <div className="mb-3 text-xs leading-relaxed text-mid">
            INK · INM · IND · ING · INH · INC · INB · INN · INP · INS · INT · LKC
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="cursor-pointer text-left text-xs font-semibold text-orange-text hover:text-sdb-blue"
              onClick={() => onToast?.('Bangalore · Chennai · Dimapur · Guwahati')}
            >
              India North →
            </button>
            <button
              type="button"
              className="cursor-pointer text-left text-xs font-semibold text-orange-text hover:text-sdb-blue"
              onClick={() => onToast?.('Hyderabad · Kolkata · Mumbai · New Delhi')}
            >
              India South →
            </button>
            <button
              type="button"
              className="cursor-pointer text-left text-xs font-semibold text-orange-text hover:text-sdb-blue"
              onClick={() => onToast?.('Panjim · Shillong · Tiruchy · Sri Lanka')}
            >
              More →
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-border-sdb bg-off-white p-5 transition-all hover:border-sdb-blue-light hover:shadow-[0_4px_20px_rgba(0,57,117,0.08)]">
          <div className="mb-2.5 text-2xl">🔗</div>
          <div className="mb-1.5 font-serif text-sm font-bold text-sdb-blue-deep">Regional Networks</div>
          <div className="mb-3 text-xs leading-relaxed text-mid">
            Youth animation · schools · higher education · Young at Risk · technical institutes · networks
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="cursor-pointer text-left text-xs font-semibold text-orange-text hover:text-sdb-blue"
              onClick={() => onToast?.('Don Bosco Youth Animation')}
            >
              Youth animation →
            </button>
            <button
              type="button"
              className="cursor-pointer text-left text-xs font-semibold text-orange-text hover:text-sdb-blue"
              onClick={() => onToast?.('Don Bosco technical institutes — 138 centres')}
            >
              Technical institutes →
            </button>
            <button
              type="button"
              className="cursor-pointer text-left text-xs font-semibold text-orange-text hover:text-sdb-blue"
              onClick={() => onToast?.('Young at Risk forum — 174 centres')}
            >
              Young at Risk →
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-border-sdb bg-off-white p-5 transition-all hover:border-sdb-blue-light hover:shadow-[0_4px_20px_rgba(0,57,117,0.08)]">
          <div className="mb-2.5 text-2xl">🌐</div>
          <div className="mb-1.5 font-serif text-sm font-bold text-sdb-blue-deep">Global Links</div>
          <div className="mb-3 text-xs leading-relaxed text-mid">
            Worldwide congregation · Salesian news · ecology · Salesian Family · universities
          </div>
          <div className="flex flex-col gap-1">
            <a
              href="https://www.sdb.org/en"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-orange-text no-underline hover:text-sdb-blue"
            >
              Worldwide site →
            </a>
            <a
              href="https://infoans.org/en/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-orange-text no-underline hover:text-sdb-blue"
            >
              Salesian news →
            </a>
            <a
              href="https://www.donboscogreen.org/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-orange-text no-underline hover:text-sdb-blue"
            >
              DB Green →
            </a>
          </div>
        </div>
        <div className="rounded-xl border border-border-sdb bg-gradient-to-br from-sdb-blue-pale to-white p-5 transition-all hover:border-sdb-blue-light hover:shadow-[0_4px_20px_rgba(0,57,117,0.08)]">
          <div className="mb-2.5 text-2xl">✉</div>
          <div className="mb-1.5 font-serif text-sm font-bold text-sdb-blue-deep">Stay Connected</div>
          <div className="mb-3 text-xs leading-relaxed text-mid">
            News, resources, and updates from the Salesian mission across South Asia and the world.
          </div>
          <div className="flex flex-col gap-1">
            <a
              href="https://www.subscribepage.com/donboscosouthasia"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-orange-text no-underline hover:text-sdb-blue"
            >
              Subscribe →
            </a>
            <a
              href="https://www.donboscosouthasia.org/SocialMediaIndex"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-orange-text no-underline hover:text-sdb-blue"
            >
              Social Media →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
