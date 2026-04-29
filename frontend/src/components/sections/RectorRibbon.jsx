export function RectorRibbon({ onToast }) {
  return (
    <div className="relative flex flex-col gap-8 overflow-hidden border-b-4 border-sdb-orange border-t border-white/[0.06] bg-gradient-to-br from-[#001428] via-[#003A75] to-[#004B96] px-4 py-7 sm:flex-row sm:items-center sm:gap-9 sm:px-8 lg:px-14 lg:py-7 before:pointer-events-none before:absolute before:left-[calc(1rem-20px)] before:top-1/2 before:size-[200px] before:-translate-y-1/2 before:rounded-full before:bg-[radial-gradient(circle,rgba(232,96,10,0.18),transparent_70%)] sm:before:left-[calc(2rem-20px)] lg:before:left-[calc(3.5rem-20px)] after:pointer-events-none after:absolute after:right-0 after:top-0 after:h-full after:w-[40%] after:bg-[repeating-linear-gradient(45deg,transparent,transparent_18px,rgba(255,255,255,0.012)_18px,rgba(255,255,255,0.012)_19px)]">
      <div className="relative z-[1] flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-sdb-orange bg-gradient-to-br from-[#1A5FAA] to-sdb-blue-mid text-3xl text-white shadow-[0_0_0_6px_rgba(232,96,10,0.18),0_8px_32px_rgba(0,0,0,0.4)]">
        <span className="font-serif font-bold tracking-tight">FA</span>
      </div>
      <div className="relative z-[1] min-w-0 flex-1">
        <div className="mb-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-peach-accent before:inline-block before:h-0.5 before:w-5 before:rounded-sm before:bg-sdb-orange">
          Rector Major · 11th Successor of Don Bosco
        </div>
        <div className="font-serif text-xl font-bold text-white sm:text-[22px]">Fr. Fabio Attard</div>
        <div className="mt-0.5 text-[13px] text-white/65">
          Elected 25 March 2025 &nbsp;·&nbsp; 29th General Chapter, Valdocco, Turin &nbsp;·&nbsp; Term 2025–2031
        </div>
        <div className="mt-2.5 inline-block rounded-full border border-sdb-orange/35 bg-sdb-orange/15 px-3.5 py-1.5 text-xs italic leading-snug text-peach-accent">
          &quot;Do Whatever He Tells You. Believers, Free to Serve.&quot; &nbsp;— Strenna 2026
        </div>
      </div>
      <div className="relative z-[1] hidden h-[72px] w-px shrink-0 bg-white/12 sm:block" />
      <div className="relative z-[1] flex flex-1 flex-wrap justify-center gap-0 sm:justify-start">
        {[
          {
            val: (
              <>
                136<span className="text-base text-sdb-orange">+</span>
              </>
            ),
            lbl: 'Nations',
          },
          { val: '92', lbl: 'Provinces' },
          {
            val: (
              <>
                13<span className="text-base text-sdb-orange">K+</span>
              </>
            ),
            lbl: 'Salesians',
          },
          { val: '1,703', lbl: 'Houses' },
        ].map((s, idx, arr) => (
          <div
            key={s.lbl}
            className={`px-4 py-2 text-center sm:px-7 sm:py-0 ${idx < arr.length - 1 ? 'border-r border-white/10' : ''}`}
          >
            <div className="font-serif text-2xl font-bold leading-none text-white drop-shadow-[0_2px_12px_rgba(0,87,168,0.5)] sm:text-[28px]">
              {s.val}
            </div>
            <div className="mt-1.5 text-xs uppercase tracking-wider text-white/55">{s.lbl}</div>
          </div>
        ))}
      </div>
      <div className="relative z-[1] flex shrink-0 flex-col gap-2">
        <button
          type="button"
          onClick={() => onToast?.('Opening: Rector Major — Fr. Fabio Attard biography')}
          className="cursor-pointer rounded-lg border border-sdb-orange bg-sdb-orange px-5 py-2.5 text-center font-sans text-xs font-semibold text-white transition-[filter] hover:brightness-110"
        >
          Biography
        </button>
        <button
          type="button"
          onClick={() => onToast?.('29th General Chapter documents — Valdocco, Turin 2025')}
          className="cursor-pointer rounded-lg border border-white/20 bg-white/[0.07] px-5 py-2.5 text-center font-sans text-xs font-semibold text-white/85 transition-colors hover:border-sdb-orange hover:bg-sdb-orange/15 hover:text-white"
        >
          Chapter documents
        </button>
        <button
          type="button"
          onClick={() => onToast?.('Salesian news — international agency')}
          className="cursor-pointer rounded-lg border border-white/20 bg-white/[0.07] px-5 py-2.5 text-center font-sans text-xs font-semibold text-white/85 transition-colors hover:border-sdb-orange hover:bg-sdb-orange/15 hover:text-white"
        >
          Salesian news
        </button>
      </div>
    </div>
  )
}
