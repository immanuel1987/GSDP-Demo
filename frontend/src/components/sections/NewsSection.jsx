const cards = [
  {
    top: 'orange',
    region: 'South Asia · Mumbai',
    title:
      'SYMLEAD South Asia Meet Strengthens Youth Leadership and Collaboration in Mumbai',
    date: '17 Mar 2026',
    tag: 'Youth Ministry',
    toast: 'Read: SYMLEAD South Asia Meet',
  },
  {
    top: 'blue',
    region: 'South Asia · Siliguri',
    title: 'Salesian Students Launch LuvlyU to Inspire Confidence and Mental Wellness Among Peers',
    date: '15 Mar 2026',
    tag: 'Mental Health',
    toast: 'Read: LuvlyU platform launch',
  },
  {
    top: 'deep',
    region: 'South Asia · Assam',
    title:
      'Disaster Preparedness Boosted in Morigaon as Bosco Reach Out Concludes SAFE Initiative',
    date: '13 Mar 2026',
    tag: 'Social Development',
    toast: 'Read: BRO SAFE Initiative',
  },
]

const topBar = {
  orange: 'bg-sdb-orange',
  blue: 'bg-sdb-blue',
  deep: 'bg-sdb-blue-deep',
}

export function NewsSection({ onToast }) {
  return (
    <section id="resources-pub" className="bg-white px-4 py-10 sm:px-8 lg:px-14 lg:py-[52px]">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-serif text-2xl font-bold text-sdb-blue-deep">Latest Salesian news</div>
          <div className="mb-2 mt-2.5 h-0.5 w-12 rounded-sm bg-sdb-orange" />
          <div className="text-sm text-mid">Salesian news agency · news from 136 nations</div>
        </div>
        <button
          type="button"
          onClick={() => onToast?.('Opening full news feed')}
          className="self-start cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-orange-text transition-colors hover:bg-orange-text/10 sm:self-auto"
        >
          All news →
        </button>
      </div>
      <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => onToast?.(c.toast)}
            className="cursor-pointer rounded-xl border border-border-sdb bg-off-white text-left transition-all hover:border-sdb-blue-light hover:shadow-[0_6px_24px_rgba(0,57,117,0.1)]"
          >
            <div className={`h-3 ${topBar[c.top]}`} />
            <div className="p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-orange-text">
                {c.region}
              </div>
              <div className="mb-2 text-sm font-semibold leading-snug text-ink">{c.title}</div>
              <div className="text-[13px] text-mid">{c.date}</div>
              <span className="mt-2 inline-block rounded-full bg-sdb-blue-pale px-2.5 py-1 text-xs font-semibold text-sdb-blue">
                {c.tag}
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
