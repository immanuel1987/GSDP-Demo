const collections = [
  {
    grad: 'bg-gradient-to-br from-[#1C0A00] via-[#5C2800] to-[#8B4A00]',
    chip: 'Historical Figures',
    title: 'The Legacy of Michele Rua',
    desc: "Primary sources and biographies of Don Bosco's first successor and his global expansion of the Salesian mission.",
    count: '47 resources',
  },
  {
    grad: 'bg-gradient-to-br from-[#002240] via-[#003A75] to-[#0057A8]',
    chip: 'Thematic Archive',
    title: 'Salesian Bulletin — Century Archive',
    desc: 'Complete digital archive of the Salesian Bulletin from 1877 — the oldest continuously published Catholic periodical.',
    count: '1,200+ issues',
  },
  {
    grad: 'bg-gradient-to-br from-[#001C00] via-[#003A10] to-[#006020]',
    chip: 'Regional Focus',
    title: 'Social Works in Latin America',
    desc: 'Field reports, best practices, and studies on Salesian social development projects across Central and South America.',
    count: '89 resources',
  },
  {
    grad: 'bg-gradient-to-br from-[#1C0A00] via-[#5C3000] to-sdb-orange',
    chip: 'Pedagogy',
    title: 'The Preventive System Today',
    desc: "Contemporary applications of Don Bosco's method in digital contexts, vulnerable youth, and global education.",
    count: '63 resources',
  },
  {
    grad: 'bg-gradient-to-br from-[#1A0040] via-[#3A0090] to-[#6040C0]',
    chip: 'Youth Ministry',
    title: 'World Youth Day — Salesian Presence',
    desc: 'Documentation and testimonies from every WYD since 1987, with Salesian participation and formation materials.',
    count: '38 resources',
  },
  {
    grad: 'bg-gradient-to-br from-[#001220] via-[#003A60] to-[#006090]',
    chip: 'Formation',
    title: 'Initial Formation — Global Standards',
    desc: 'Official documents and guidelines for Salesian initial formation programmes — Ratio Fundamentalis and regional guides.',
    count: '72 resources',
  },
]

export function CollectionsSection({ onEnterPlatform }) {
  return (
    <section id="coll-pub" className="px-4 py-10 sm:px-8 lg:px-14 lg:py-[52px]">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-serif text-2xl font-bold text-sdb-blue-deep">Curated Collections</div>
          <div className="mb-2 mt-2.5 h-0.5 w-12 rounded-sm bg-sdb-orange" />
          <div className="text-sm text-mid">
            Thematic knowledge paths — discover without needing an exact query
          </div>
        </div>
        <button
          type="button"
          onClick={onEnterPlatform}
          className="self-start cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-orange-text transition-colors hover:bg-orange-text/10 sm:self-auto"
        >
          All collections →
        </button>
      </div>
      <div className="grid gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
        {collections.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={onEnterPlatform}
            className="cursor-pointer rounded-xl border border-border-sdb bg-white text-left transition-all hover:-translate-y-0.5 hover:border-sdb-blue-light hover:shadow-[0_8px_32px_rgba(0,57,117,0.12)]"
          >
            <div
              className={`flex h-[110px] items-end bg-cover p-3.5 ${c.grad}`}
            >
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/95">
                {c.chip}
              </span>
            </div>
            <div className="p-4">
              <div className="mb-1.5 font-serif text-sm font-bold leading-snug text-ink">{c.title}</div>
              <p className="mb-3 text-[13px] leading-relaxed text-mid">{c.desc}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sdb-blue">{c.count}</span>
                <span className="text-base text-orange-text">→</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
