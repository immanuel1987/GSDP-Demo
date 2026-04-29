export function TechnologySection({ onToast }) {
  return (
    <section
      id="tech-pub"
      className="border-t border-border-sdb bg-sdb-blue-pale px-4 py-10 sm:px-8 lg:px-14 lg:py-[52px]"
    >
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-serif text-2xl font-bold text-sdb-blue-deep">
            Technology & Development
          </div>
          <div className="mb-2 mt-2.5 h-0.5 w-12 rounded-sm bg-sdb-orange" />
          <div className="text-sm text-mid">
            Open architecture · Semantic AI · Salesian knowledge ontology
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToast?.('Opening full technology documentation')}
          className="self-start cursor-pointer rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-orange-text transition-colors hover:bg-orange-text/10 sm:self-auto"
        >
          Full docs →
        </button>
      </div>

      <div className="mb-6 grid gap-8 rounded-xl border border-border-sdb bg-white p-6 sm:grid-cols-2 sm:p-7 lg:gap-8">
        <div>
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-orange-text">
            Project Description
          </div>
          <h3 className="mb-3 font-serif text-lg font-bold leading-snug text-sdb-blue-deep">
            What is the Global Salesian Digital Platform?
          </h3>
          <p className="mb-2.5 text-[13px] leading-relaxed text-slate-sdb">
            The Global Salesian Digital Platform is the official open-access knowledge platform of the{' '}
            <strong>Salesians of Don Bosco</strong> — a congregation of 13,750 religious working in 136
            nations. It serves as a unified, searchable repository for the Salesian intellectual and
            pastoral heritage.
          </p>
          <p className="mb-2.5 text-[13px] leading-relaxed text-slate-sdb">
            Built to serve{' '}
            <strong>
              scholars, educators, formation teams, provincial administrators, and the broader Salesian
              Family
            </strong>{' '}
            — making scattered resources discoverable through semantic AI, structured taxonomy, and open
            access publishing.
          </p>
          <p className="text-[13px] leading-relaxed text-slate-sdb">
            The South Asia pilot covers 12 provinces (India + Sri Lanka) and forms the template for global
            rollout across all 92 Salesian provinces by 2027.
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-orange-text">
            Vision & Context
          </div>
          <div className="rounded-lg border-l-[3px] border-sdb-blue bg-sdb-blue-pale px-3.5 py-3">
            <div className="mb-1 text-xs font-bold text-sdb-blue-deep">Mission</div>
            <div className="text-xs leading-relaxed text-slate-sdb">
              Make the Salesian intellectual and pastoral heritage freely explorable by anyone, anywhere —
              scholars, educators, ministers, and the curious worldwide.
            </div>
          </div>
          <div className="rounded-lg border-l-[3px] border-sdb-orange bg-[#FFF5EF] px-3.5 py-3">
            <div className="mb-1 text-xs font-bold text-orange-text">Initiated by</div>
            <div className="text-xs leading-relaxed text-slate-sdb">
              South Asia Provincial Conference (SPCSA) · Developed under the GC29 digital mission mandate
              · Coordinated by Don Bosco South Asia digital team.
            </div>
          </div>
          <div className="rounded-lg border-l-[3px] border-[#1A8A5A] bg-emerald-50 px-3.5 py-3">
            <div className="mb-1 text-xs font-bold text-emerald-800">Core Principle</div>
            <div className="text-xs leading-relaxed text-slate-sdb">
              Open access by default. No paywalls, no login required for basic discovery. Knowledge is the
              mission — not control of it.
            </div>
          </div>
        </div>
      </div>

      <div className="mb-7 grid gap-5 md:grid-cols-3">
        {[
          {
            icon: '🦉',
            t: 'OWL Ontology',
            d: 'The Salesian knowledge graph uses an OWL 2 ontology with 847 classes and 312 properties — mapping 92 provinces, all Salesian groups, charism, mission areas, and institutional types into a structured semantic layer.',
          },
          {
            icon: '✦',
            t: 'Semantic AI Search',
            d: 'Powered by Azure OpenAI with vector embeddings on Databricks. Queries are matched by meaning — not just keywords. Supports summarization, translation across 5 languages, and document chat for all open-access resources.',
          },
          {
            icon: '📚',
            t: 'MARC21 & Metadata',
            d: 'Resources are catalogued using MARC21 standard with extended Salesian taxonomy fields. Metadata is validated against the OWL ontology at submission — ensuring 80%+ compliance across all contributing provinces.',
          },
        ].map((x) => (
          <div key={x.t} className="rounded-xl border border-border-sdb bg-white p-5">
            <div className="mb-2.5 text-2xl">{x.icon}</div>
            <div className="mb-1.5 text-sm font-bold text-sdb-blue-deep">{x.t}</div>
            <p className="text-[13px] leading-relaxed text-mid">{x.d}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border-sdb bg-white p-5">
        <div className="mb-3.5 text-sm font-bold text-sdb-blue-deep">Development Phases</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              c: '#1A8A5A',
              bg: '#F0FAF4',
              phase: 'Phase 1 — Complete',
              name: 'Foundation',
              d: 'OWL ontology · MARC21 cataloguing · Province onboarding · Core search',
            },
            {
              c: '#E8600A',
              bg: '#FFF5EF',
              phase: 'Phase 2 — Active',
              name: 'AI Integration',
              d: 'Semantic search · Summarization · Translation · AI query assistant',
            },
            {
              c: '#0057A8',
              bg: '#EEF5FC',
              phase: 'Phase 3 — 2026',
              name: 'Network Expansion',
              d: '15+ provinces · Interactive maps · Collections API · Mobile app',
            },
            {
              c: '#525E6B',
              bg: '#F7F7F5',
              phase: 'Phase 4 — 2027',
              name: 'Global Platform',
              d: 'All 92 provinces · Multilingual UI · Federated search · Open API',
            },
          ].map((p) => (
            <div
              key={p.phase}
              className="rounded-lg border-l-[3px] px-3 py-3"
              style={{ borderLeftColor: p.c, backgroundColor: p.bg }}
            >
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: p.c }}>
                {p.phase}
              </div>
              <div className="mb-1 text-xs font-semibold text-ink">{p.name}</div>
              <div className="text-xs text-mid">{p.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
