const council = [
  {
    cc: '#E8600A',
    initials: 'FA',
    name: 'Fr. Fabio Attard',
    role: 'Rector Major',
    region: 'Malta · Gozo',
    footer: '11th Successor of Don Bosco\nElected 25 Mar 2025 · Term 2025–2031',
    toast: 'Fr. Fabio Attard — 11th Rector Major, elected GC29 · Malta',
  },
  {
    cc: '#2272C3',
    initials: 'SM',
    name: 'Fr. Stefano Martoglio',
    role: 'Vicar General',
    region: 'Italy',
    footer: 'Deputy to the Rector Major\nGovernance & coordination',
    toast: 'Fr. Stefano Martoglio — Vicar General · Italy',
  },
  {
    cc: '#1A8A5A',
    initials: 'SR',
    name: 'Fr. Silvio Roggia',
    role: 'Councillor for Formation',
    region: 'Italy',
    footer: 'Initial & ongoing formation\nSalesian spirituality',
    toast: 'Fr. Silvio Roggia — Councillor for Formation · Italy',
  },
  {
    cc: '#C07A00',
    initials: 'RB',
    name: 'Fr. Rafael Bejarano',
    role: 'Councillor, Youth Ministry',
    region: 'Spain',
    footer: 'SYM · Youth at Risk\nPreventive System',
    toast: 'Fr. Rafael Bejarano — Councillor, Youth Ministry · Spain',
  },
  {
    cc: '#0F8A8A',
    initials: 'FO',
    name: 'Fr. Fidel Orendain',
    role: 'Social Communication',
    region: 'Philippines',
    footer: 'News agency · Digital ministry\nMedia & communications',
    toast: 'Fr. Fidel Orendain — Social Communication · Philippines',
  },
  {
    cc: '#B02020',
    initials: 'JC',
    name: 'Fr. Jorge Crisafulli',
    role: 'Councillor for Missions',
    region: 'Argentina',
    footer: 'Mission ad gentes\n136 nations outreach',
    toast: 'Fr. Jorge Crisafulli — Councillor for Missions · Argentina',
  },
  {
    cc: '#6A3BAA',
    initials: 'GS',
    name: 'Fr. Gabriel Stawowy',
    role: 'Economer General',
    region: 'Poland',
    footer: 'Finance & administration\nGlobal resource management',
    toast: 'Fr. Gabriel Stawowy — Economer General · Poland',
  },
  {
    cc: '#8A5A00',
    initials: 'AO',
    name: 'Fr. Alphonse Owoudou',
    role: 'Regional Councillor · Africa',
    region: 'Central & West Africa',
    footer: 'Sub-Saharan mission\nFrancophone provinces',
    toast: 'Fr. Alphonse Owoudou — Regional Councillor · Africa',
  },
]

export function CouncilSection({ onToast }) {
  return (
    <section
      id="council-pub"
      className="relative overflow-hidden bg-gradient-to-b from-[#001830] from-0% via-sdb-blue-deep via-40% to-[#002A5A] px-4 py-10 sm:px-8 lg:px-14 lg:py-[52px] before:pointer-events-none before:absolute before:-right-20 before:-top-[120px] before:size-[500px] before:rounded-full before:bg-[radial-gradient(circle,rgba(0,87,168,0.18),transparent_65%)] after:pointer-events-none after:absolute after:-bottom-20 after:left-10 after:size-[320px] after:rounded-full after:bg-[radial-gradient(circle,rgba(232,96,10,0.1),transparent_65%)]"
    >
      <div className="relative z-[1] mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-sdb-orange-light">
            Salesian Congregation · 29th General Chapter · Valdocco, Turin · March 2025
          </div>
          <h2 className="font-serif text-2xl font-bold text-white sm:text-[26px]">
            General Council <span className="text-peach-accent">2025–2031</span>
          </h2>
          <p className="mt-1.5 text-sm text-white/65">
            Elected at the 29th General Chapter — 13,750 Salesians in 136 nations
          </p>
          <div className="mt-3.5 h-0.5 w-12 rounded-sm bg-sdb-orange" />
        </div>
        <button
          type="button"
          onClick={() => onToast?.('Opening: Full General Council page')}
          className="self-start rounded-lg border border-sdb-orange/35 bg-sdb-orange/10 px-4 py-2 font-sans text-[13px] font-semibold text-peach-accent transition-colors hover:bg-sdb-orange/20 sm:self-auto cursor-pointer"
        >
          View full council →
        </button>
      </div>
      <div className="relative z-[1] grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {council.map((m) => (
          <button
            key={m.initials}
            type="button"
            onClick={() => onToast?.(m.toast)}
            className="group cursor-pointer overflow-hidden rounded-xl border border-white/15 bg-white text-left shadow-none transition-all hover:-translate-y-1 hover:shadow-[0_20px_48px_rgba(0,0,0,0.45)]"
          >
            <div
              className="h-1 w-full transition-[height] group-hover:h-1.5"
              style={{ backgroundColor: m.cc }}
            />
            <div className="p-5">
              <div
                className="mb-3 flex size-[50px] items-center justify-center rounded-full text-base font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                style={{ backgroundColor: m.cc }}
              >
                {m.initials}
              </div>
              <div className="text-sm font-bold leading-snug text-ink">{m.name}</div>
              <div className="text-xs font-semibold" style={{ color: m.cc }}>
                {m.role}
              </div>
              <div className="mt-1 text-xs text-mid">{m.region}</div>
              <div className="mt-3 border-t border-[#eef0f3] pt-2.5 text-[11px] leading-relaxed text-[#888] whitespace-pre-line">
                {m.footer}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
