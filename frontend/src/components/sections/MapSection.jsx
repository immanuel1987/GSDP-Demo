export function MapSection({ onEnterPlatform }) {
  return (
    <section id="institutions-pub" className="bg-sdb-blue-pale px-4 py-10 sm:px-8 lg:px-14 lg:py-[52px]">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-serif text-2xl font-bold text-sdb-blue-deep">
            Pastoral Works & Institutions
          </div>
          <div className="mb-2 mt-2.5 h-0.5 w-12 rounded-sm bg-sdb-orange" />
          <div className="max-w-3xl text-sm text-mid">
            7,240 schools, oratories, parishes, and social works — click any point to explore profile
            and related resources
          </div>
        </div>
        <button
          type="button"
          onClick={onEnterPlatform}
          className="self-start cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-orange-text transition-colors hover:bg-orange-text/10 sm:self-auto"
        >
          Full directory →
        </button>
      </div>
      <div className="relative flex h-[280px] flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-border-sdb bg-gradient-to-br from-sdb-blue-light to-sdb-blue-pale sm:h-[320px] before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_40%_50%,rgba(0,87,168,0.1),transparent_60%),radial-gradient(circle_at_75%_35%,rgba(232,96,10,0.07),transparent_45%)]">
        <div className="relative font-serif text-lg font-bold text-sdb-blue-deep">
          🗺 Interactive World Map · 1,703 communities · 136 nations
        </div>
        <div className="relative max-w-lg px-4 text-center text-[13px] text-mid">
          Click any marker to view institution profile, programs, and related resources
        </div>
        <button
          type="button"
          onClick={onEnterPlatform}
          className="relative cursor-pointer rounded-lg border-none bg-sdb-blue px-6 py-2.5 text-[13px] font-semibold text-white"
        >
          Explore the Map
        </button>
      </div>
    </section>
  )
}
