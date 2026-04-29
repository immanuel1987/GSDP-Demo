import { useState } from 'react'

const examples = [
  'Preventive System in Latin America 1950–1970',
  'Youth at Risk South Asia',
  'Don Bosco educator method',
  'Drug addiction pastoral guide',
]

export function SearchStrip({ onSearch }) {
  const [q, setQ] = useState('')

  return (
    <section className="border-b border-border-sdb bg-white px-4 py-6 sm:px-8 lg:px-14">
      <div className="max-w-[760px]">
        <div className="mb-3 font-serif text-base font-bold text-sdb-blue-deep">
          Search the Salesian knowledge corpus
        </div>
        <div className="flex overflow-hidden rounded-lg border-2 border-border-sdb transition-colors focus-within:border-sdb-blue">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 border-none bg-transparent px-4 py-3.5 font-sans text-sm text-ink outline-none sm:px-[18px]"
            placeholder="Search resources, institutions, persons, events…"
          />
          <button
            type="button"
            onClick={() => onSearch?.(q)}
            className="shrink-0 cursor-pointer border-none bg-sdb-blue px-6 font-sans text-sm font-semibold text-white transition-colors hover:bg-sdb-blue-deep sm:px-7"
          >
            Search
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-mid">Try:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQ(ex)}
              className="cursor-pointer rounded-full border border-sdb-blue-light bg-sdb-blue-pale px-3 py-1.5 text-xs text-sdb-blue transition-colors hover:bg-sdb-blue hover:text-white"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
