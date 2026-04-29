const items = [
  { val: '12,847', lbl: 'Resources' },
  { val: '261', lbl: 'Don Bosco schools' },
  { val: '138', lbl: 'Technical Institutes' },
  { val: '174', lbl: 'Young at Risk centres' },
  { val: '57', lbl: 'Formation Centres' },
  { val: '174', lbl: 'Parishes' },
  { val: '51', lbl: 'Colleges' },
]

export function StatsRibbon() {
  return (
    <div className="flex flex-col bg-sdb-blue lg:flex-row lg:items-stretch">
      <div className="flex min-w-0 flex-1 flex-wrap justify-center gap-0 px-2 py-4 sm:px-4 lg:flex-nowrap lg:px-14 lg:py-[18px]">
        {items.map((it) => (
          <div
            key={it.lbl}
            className="min-w-[100px] flex-1 border-b border-white/10 px-3 py-2 text-center last:border-b-0 sm:border-b-0 lg:border-r lg:border-white/12 lg:py-0"
          >
            <div className="font-serif text-xl font-bold text-white sm:text-[26px]">{it.val}</div>
            <div className="mt-1 text-xs uppercase tracking-wider text-white/75">{it.lbl}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center border-t border-white/15 px-4 py-3 text-center text-xs text-white/60 lg:border-l lg:border-t-0 lg:px-6">
        South Asia Region · Updated 23 Mar 2026
      </div>
    </div>
  )
}
