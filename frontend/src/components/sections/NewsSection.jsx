export function NewsSection({ onToast }) {
  return (
    <section id="resources-pub" className="bg-white px-4 py-10 sm:px-8 lg:px-14 lg:py-[52px]">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-serif text-2xl font-bold text-sdb-blue-deep">Latest Salesian news</div>
          <div className="mb-2 mt-2.5 h-0.5 w-12 rounded-sm bg-sdb-orange" />
          <div className="text-sm text-mid">0 stories · 0 nations — news feed not connected yet</div>
        </div>
        <button
          type="button"
          onClick={() => onToast?.('News feed not available yet')}
          className="self-start cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-orange-text transition-colors hover:bg-orange-text/10 sm:self-auto"
        >
          All news →
        </button>
      </div>
      <p className="rounded-xl border border-border-sdb bg-off-white px-4 py-8 text-center text-sm text-mid">
        0 news stories to display.
      </p>
    </section>
  )
}
