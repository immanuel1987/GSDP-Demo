export function AboutSection({ onEnterPlatform, onToast }) {
  return (
    <section
      id="about-pub"
      className="grid items-center gap-10 bg-off-white px-4 py-10 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:px-14 lg:py-[52px]"
    >
      <div>
        <div className="mb-3 text-xs font-bold uppercase tracking-widest text-orange-text">About Us</div>
        <p className="mb-3.5 border-l-[3px] border-sdb-orange-light pl-3 text-[13px] italic text-mid">
          Serious but not rigid. Academic but accessible. Institutional but human.
        </p>
        <p className="text-sm leading-relaxed text-slate-sdb">
          The Global Salesian Digital Platform is the official digital knowledge platform of the Salesians of
          Don Bosco — built to make the
          vast Salesian intellectual heritage freely explorable by scholars, educators, ministers, and the
          curious, worldwide.
        </p>
        <p className="mt-3.5 text-sm leading-relaxed text-slate-sdb">
          In South Asia alone, Don Bosco runs <strong>261 schools</strong>,{' '}
          <strong>138 technical institutes</strong>, <strong>174 Young-at-Risk centres</strong>, and{' '}
          <strong>192 hostels</strong> — serving millions of the poorest young people across India, Sri
          Lanka, Bangladesh, Nepal, and beyond.
        </p>
        <p className="mt-3.5 text-sm leading-relaxed text-slate-sdb">
          Built on semantic AI — it understands <em>meaning</em>, not just keywords.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onToast?.('Opening: Technology and Development')}
            className="cursor-pointer rounded-lg border-none bg-sdb-blue px-5 py-2.5 font-sans text-sm font-semibold text-white transition-[filter] hover:brightness-110"
          >
            Our Technology →
          </button>
          <button
            type="button"
            onClick={onEnterPlatform}
            className="cursor-pointer rounded-lg border border-sdb-blue bg-transparent px-5 py-2.5 font-sans text-sm font-semibold text-sdb-blue transition-colors hover:bg-sdb-blue-pale"
          >
            Enter Platform
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        {[
          {
            icon: '🔓',
            title: 'Open access by default',
            text: 'Every public resource is freely downloadable as PDF. No paywalls, no registration required.',
          },
          {
            icon: '✦',
            title: 'Semantic AI search',
            text: 'Ask in natural language. Summarize, translate, and explore across 5 languages — AI assists, Salesians curate.',
          },
          {
            icon: '🏫',
            title: 'South Asia network',
            text: '261 schools, 138 technical institutes, 174 Young at Risk centres, 57 formation houses — all indexed and discoverable.',
          },
          {
            icon: '📡',
            title: 'Live news & regional feeds',
            text: 'Real-time news, events, and reports from the Salesian news agency and all South Asia province offices.',
          },
        ].map((p) => (
          <div key={p.title} className="flex gap-3.5">
            <div className="flex size-[38px] shrink-0 items-center justify-center rounded-lg border border-sdb-blue-light bg-sdb-blue-pale text-lg">
              {p.icon}
            </div>
            <div>
              <strong className="block text-sm font-bold text-sdb-blue-deep">{p.title}</strong>
              <span className="mt-0.5 block text-[13px] leading-relaxed text-mid">{p.text}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
