import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getSession } from '../../auth/session'
import { allowedPageIdsForRoleKey } from '../../data/dashboardNav'
import { ROLE_DISPLAY } from '../../data/dashboardRoles'
import { ANALYTICS_PROVINCE_DATA } from '../../data/analyticsProvinceData'
import { dashboardRoleKeyFromRoleName } from '../../auth/loginSession'
import { clearRoleAllowedPagesOverride, fetchAuthRoles, updateRoleAllowedPages } from '../../lib/authApi'
import {
  fetchOntologyRows,
  fetchOntologySummary,
  mapOntologyRowToResource,
  resourceDocumentKind,
  resourceDocumentUrl,
} from '../../lib/ontologyApi'
import {
  COLLECTION_CHIPS,
  DASHBOARD_COLLECTIONS,
  DASHBOARD_EVENTS,
  DASHBOARD_INSTITUTIONS,
  DASHBOARD_PERSONS,
  DASHBOARD_RESOURCES,
  INSTITUTION_TYPE_OPTIONS,
  RESOURCE_AUTHORS,
  RESOURCE_GROUP_OPTIONS,
  RESOURCE_LANG_OPTIONS,
  RESOURCE_PROVINCE_OPTIONS,
  RESOURCE_PUBLISHERS,
  RESOURCE_REGION_OPTIONS,
  RESOURCE_THEME_OPTIONS,
  RESOURCE_TYPE_OPTIONS,
  RESOURCE_YEAR_OPTIONS,
} from '../../data/dashboardCorpus'

function SectionHeader({ title, subtitle, children }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="font-serif text-[19px] font-bold text-sdb-blue-deep after:mt-1.5 after:block after:h-0.5 after:w-9 after:bg-sdb-orange after:content-['']">
          {title}
        </h3>
        <p className="mt-1 max-w-3xl text-[13px] text-mid">{subtitle}</p>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </div>
  )
}

function FilterBar({ children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-border-sdb bg-white px-4 py-3">
      {children}
    </div>
  )
}

const sel =
  'max-w-[155px] cursor-pointer rounded border border-border-sdb bg-off-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-sdb-blue'

function EmptyState({ icon, title, msg }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-sdb bg-off-white py-16 text-center">
      <div className="mb-2 text-4xl">{icon}</div>
      <div className="font-serif text-lg font-bold text-sdb-blue-deep">{title}</div>
      <p className="mt-1 max-w-md text-sm text-mid">{msg}</p>
    </div>
  )
}

const BADGE = {
  'badge-pdf': 'bg-red-100 text-red-900',
  'badge-doc': 'bg-emerald-100 text-emerald-900',
  'badge-study': 'bg-amber-100 text-amber-900',
  'badge-marc': 'bg-slate-100 text-slate-700',
}

function resourceBadgeClass(b) {
  return BADGE[b] || 'bg-slate-100 text-slate-700'
}

function viewResourceDocument(e, r) {
  e.stopPropagation()
  const url = resourceDocumentUrl(r)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function ResourceDetailModal({ resource, onClose }) {
  if (!resource) return null

  const fields = [
    { label: 'Title', value: resource.hasTitle || resource.title },
    { label: 'Author', value: resource.author },
    { label: 'Description', value: resource.desc },
    { label: 'Located In', value: resource.locatedIn },
    { label: 'Address', value: resource.address },
    { label: 'Province', value: resource.belongsToProvince || resource.province },
    { label: 'SDB Province', value: resource.hasSDBProvince },
    { label: 'Date Created', value: resource.dateCreated },
    { label: 'Date Updated', value: resource.dateLastUpdated },
    { label: 'Date Published', value: resource.datePublished },
    { label: 'File Format', value: resource.hasFileFormat || resource.fileFormat },
    { label: 'Access Level', value: resource.hasAccessLevel || resource.access },
    { label: 'Audience', value: resource.hasAudience || resource.group },
    { label: 'Status', value: resource.hasDocumentStatus },
    { label: 'Work Type', value: resource.hasWorkType || resource.type },
    { label: 'Provenance Source', value: resource.hasProvenanceSource },
    { label: 'Technical Specification', value: resource.hasTechnicalSpecification },
    { label: 'Keywords', value: resource.hasKeyword || resource.tags.join(', ') },
    { label: 'Document ID', value: resource.hasDocumentID || resource.document_id },
  ].filter(f => f.value && f.value !== '—')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sdb-blue-deep/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border-sdb bg-white shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex h-32 items-center justify-center text-4xl text-white" style={{ background: resource.cover }}>
          {resource.icon}
        </div>
        <button
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          onClick={onClose}
        >
          ✕
        </button>

        <div className="max-h-[60vh] overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="font-serif text-2xl font-bold text-sdb-blue-deep">{resource.hasTitle || resource.title}</h2>
            <p className="mt-1 text-mid">{resource.author}</p>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {fields.map(f => (
              <div key={f.label} className="border-b border-off-white pb-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-mid">{f.label}</div>
                <div className="mt-0.5 text-sm text-ink">{f.value}</div>
              </div>
            ))}
          </div>

          {resource.desc && (
            <div className="mt-6 border-t border-border-sdb pt-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-mid">Summary</div>
              <p className="mt-1 text-sm leading-relaxed text-ink">{resource.desc}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border-sdb bg-off-white p-4">
          <button
            className="rounded-lg border border-border-sdb bg-white px-4 py-2 text-sm font-semibold text-slate-sdb hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
          {resourceDocumentUrl(resource) && (
            <button
              className="rounded-lg bg-sdb-blue px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sdb-blue-deep"
              onClick={(e) => viewResourceDocument(e, resource)}
            >
              View Full Document
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


function filterResources(list, f) {
  const q = f.q.trim().toLowerCase()
  return list.filter((r) => {
    if (
      q &&
      !r.hasTitle.toLowerCase().includes(q) &&
      !r.author.toLowerCase().includes(q) &&
      !r.tags.some((t) => t.toLowerCase().includes(q)) &&
      !(r.province && r.province.toLowerCase().includes(q)) &&
      !(r.desc && r.desc.toLowerCase().includes(q))
    ) {
      return false
    }
    if (f.theme && r.area !== f.theme) return false
    if (f.type && r.type !== f.type) return false
    if (f.province && r.province !== f.province) return false
    if (f.region && r.region !== f.region) return false
    if (f.lang && !r.lang.includes(f.lang)) return false
    if (f.year && r.year !== f.year) return false
    if (f.access === 'open' && r.access !== 'open') return false
    if (f.group && r.group !== f.group) return false
    if (f.publisher && r.publisher !== f.publisher) return false
    if (f.author && !r.author.includes(f.author)) return false
    if (f.docMedia === 'pdf' && resourceDocumentKind(r) !== 'pdf') return false
    if (f.docMedia === 'image' && resourceDocumentKind(r) !== 'image') return false
    return true
  })
}

export function ResourcesView() {
  const [f, setF] = useState({
    theme: '',
    type: '',
    docMedia: '',
    province: '',
    region: '',
    lang: '',
    year: '',
    access: '',
    group: '',
    publisher: '',
    author: '',
    q: '',
  })

  const [selectedResource, setSelectedResource] = useState(null)


  const [apiRows, setApiRows] = useState([])
  const [apiLoading, setApiLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [useStaticFallback, setUseStaticFallback] = useState(false)
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(f.q.trim()), 450)
    return () => window.clearTimeout(id)
  }, [f.q])

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'provincial') return
    const reg = String(s.region || '').trim()
    if (!reg) return
    setF((prev) => {
      if (prev.region) return prev
      const opts = RESOURCE_REGION_OPTIONS.filter(Boolean)
      if (opts.length && !opts.includes(reg)) return prev
      return { ...prev, region: reg }
    })
  }, [])

  useEffect(() => {
    if (useStaticFallback) return
    let cancelled = false
    setApiLoading(true)
    setApiError(null)
    fetchOntologyRows({ limit: 200, offset: 0, q: debouncedQ })
      .then((res) => {
        if (cancelled) return
        const mapped = (res.data || []).map((row, i) => mapOntologyRowToResource(row, i))
        setApiRows(mapped)
      })
      .catch((e) => {
        if (!cancelled) setApiError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setApiLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQ, useStaticFallback])

  const sourceList = useStaticFallback ? DASHBOARD_RESOURCES : apiRows

  const filtered = useMemo(
    () => filterResources(sourceList, useStaticFallback ? f : { ...f, q: '' }),
    [sourceList, f, useStaticFallback],
  )

  function clearFilters() {
    setF({
      theme: '',
      type: '',
      docMedia: '',
      province: '',
      region: '',
      lang: '',
      year: '',
      access: '',
      group: '',
      publisher: '',
      author: '',
      q: '',
    })
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="Resource Library"
        subtitle={
          useStaticFallback
            ? 'Browse, search, and access the Salesian knowledge corpus (offline sample data)'
            : 'Live records from ontology.bronze.final_table_ontology via the platform API'
        }
      >
        {apiError ? (
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-950">
            API: {apiError.slice(0, 120)}
            {apiError.length > 120 ? '…' : ''}
          </span>
        ) : null}
        {!useStaticFallback && !apiLoading && !apiError ? (
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
            Databricks · {apiRows.length} shown
          </span>
        ) : null}
        <button
          type="button"
          className="rounded-lg border border-border-sdb bg-white px-3 py-1.5 text-xs font-semibold text-slate-sdb"
        >
          🔗 Share search
        </button>
        <button
          type="button"
          className="rounded-lg border border-border-sdb bg-white px-3 py-1.5 text-xs font-semibold text-slate-sdb"
        >
          🔖 Save search
        </button>
      </SectionHeader>

      <FilterBar>
        <select
          className={sel}
          value={f.theme}
          onChange={(e) => setF((s) => ({ ...s, theme: e.target.value }))}
          aria-label="Theme"
        >
          <option value="">All themes</option>
          {RESOURCE_THEME_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className={sel} value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
          <option value="">All types</option>
          {RESOURCE_TYPE_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={f.docMedia}
          onChange={(e) => setF((s) => ({ ...s, docMedia: e.target.value }))}
          aria-label="Document file type"
        >
          <option value="">All documents</option>
          <option value="pdf">PDF only</option>
          <option value="image">Image only</option>
        </select>
        <select
          className={sel}
          value={f.province}
          onChange={(e) => setF((s) => ({ ...s, province: e.target.value }))}
        >
          {RESOURCE_PROVINCE_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className={sel} value={f.region} onChange={(e) => setF((s) => ({ ...s, region: e.target.value }))}>
          <option value="">All Regions</option>
          {RESOURCE_REGION_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className={sel} value={f.lang} onChange={(e) => setF((s) => ({ ...s, lang: e.target.value }))}>
          <option value="">All Languages</option>
          {RESOURCE_LANG_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className={sel} value={f.year} onChange={(e) => setF((s) => ({ ...s, year: e.target.value }))}>
          <option value="">All Years</option>
          {RESOURCE_YEAR_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className={sel} value={f.access} onChange={(e) => setF((s) => ({ ...s, access: e.target.value }))}>
          <option value="">All Access</option>
          <option value="open">Open Access</option>
        </select>
        <select className={sel} value={f.group} onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))}>
          <option value="">All Groups</option>
          {RESOURCE_GROUP_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={f.publisher}
          onChange={(e) => setF((s) => ({ ...s, publisher: e.target.value }))}
        >
          <option value="">All Publishers</option>
          {RESOURCE_PUBLISHERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select className={sel} value={f.author} onChange={(e) => setF((s) => ({ ...s, author: e.target.value }))}>
          <option value="">All Authors</option>
          {RESOURCE_AUTHORS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          className="min-w-[180px] flex-1 rounded border border-border-sdb bg-white px-3 py-1.5 text-[13px] outline-none focus:border-sdb-blue"
          placeholder="🔍 Search title, author, province, tags…"
          value={f.q}
          onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))}
        />
        <button type="button" className="text-xs font-semibold text-orange-text" onClick={clearFilters}>
          Clear all
        </button>
        {apiError ? (
          <button
            type="button"
            className="rounded-lg border border-border-sdb bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sdb-blue"
            onClick={() => setUseStaticFallback(true)}
          >
            Use sample data
          </button>
        ) : null}
        {useStaticFallback ? (
          <button
            type="button"
            className="rounded-lg border border-border-sdb bg-white px-2.5 py-1.5 text-[11px] font-semibold text-sdb-blue"
            onClick={() => {
              setUseStaticFallback(false)
              setApiError(null)
            }}
          >
            Retry API
          </button>
        ) : null}
      </FilterBar>

      {apiLoading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-sdb bg-white py-16 text-center">
          <div className="mb-2 text-2xl">⏳</div>
          <div className="font-serif text-lg font-bold text-sdb-blue-deep">Loading ontology records…</div>
          <p className="mt-1 max-w-md text-sm text-mid">Fetching from /data/ontology (Databricks bronze table).</p>
        </div>
      ) : apiError && !useStaticFallback ? (
        <EmptyState
          icon="⚠️"
          title="Could not load live data"
          msg={`Check that the backend is running and Databricks credentials are set (.env). ${apiError}`}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon="📚"
          title="No resources found"
          msg="Try adjusting your filters or search terms to discover the Salesian knowledge corpus."
        />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="cursor-pointer overflow-hidden rounded-xl border border-border-sdb bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-sdb-blue-light hover:shadow-md"
              onClick={() => setSelectedResource(r)}
            >

              <div
                className="flex h-20 items-center justify-center text-3xl text-white/95 drop-shadow"
                style={{ background: r.cover }}
              >
                {r.icon}
              </div>
              <div className="border-b border-border-sdb px-4 py-4">
                <div className="mb-2 flex flex-wrap gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${resourceBadgeClass(r.badge)}`}
                  >
                    {r.icon} {r.type}
                  </span>
                  {r.province ? (
                    <span className="rounded bg-sdb-blue-mid px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {r.province}
                    </span>
                  ) : null}
                  {r.access === 'open' ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      Open Access
                    </span>
                  ) : null}
                </div>
                <div className="text-sm font-bold leading-snug text-ink">{r.title}</div>
                <div className="mt-1 text-[13px] text-mid">{r.author}</div>
                {r.publisher ? <div className="mt-0.5 text-[11px] text-mid">Publisher: {r.publisher}</div> : null}
                <div className="mt-1 text-xs text-mid">
                  {r.year} · {r.region} · {String(r.lang || '').split(',')[0] || '—'}
                </div>
                {r.desc ? <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-mid">{r.desc}</div> : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5">
                {r.tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded bg-off-white px-2 py-0.5 text-xs text-slate-sdb">
                    {t}
                  </span>
                ))}
                <div className="ml-auto flex flex-wrap justify-end gap-1.5">
                  {resourceDocumentUrl(r) ? (
                    <button
                      type="button"
                      className="rounded-md border border-border-sdb bg-white px-2 py-1 text-[11px] font-semibold text-sdb-blue-deep shadow-sm"
                      onClick={(e) => viewResourceDocument(e, r)}
                    >
                      View doc
                    </button>
                  ) : (
                    <span className="self-center text-[10px] font-medium text-mid">No file URL</span>
                  )}
                  <button
                    type="button"
                    className="rounded-md border-none bg-sdb-blue-pale px-2.5 py-1 text-[11px] font-semibold text-sdb-blue"
                  >
                    ✦ AI
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ResourceDetailModal
        resource={selectedResource}
        onClose={() => setSelectedResource(null)}
      />
    </main>
  )
}


export function CollectionsView() {
  const [chip, setChip] = useState('')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const cq = q.trim().toLowerCase()
    return DASHBOARD_COLLECTIONS.filter(
      (c) =>
        (!cq || c.title.toLowerCase().includes(cq) || c.desc.toLowerCase().includes(cq)) && (!chip || c.chip === chip),
    )
  }, [chip, q])

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="Collections"
        subtitle="Curated thematic knowledge paths — discover without needing an exact query"
      >
        <button type="button" className="rounded-lg bg-sdb-blue px-3 py-1.5 text-xs font-semibold text-white">
          + New Collection
        </button>
      </SectionHeader>
      <FilterBar>
        <select className={sel} value={chip} onChange={(e) => setChip(e.target.value)}>
          {COLLECTION_CHIPS.map((c) => (
            <option key={c || 'all'} value={c}>
              {c ? c : 'All categories'}
            </option>
          ))}
        </select>
        <input
          className="min-w-[180px] flex-1 rounded border border-border-sdb bg-white px-3 py-1.5 text-[13px] outline-none focus:border-sdb-blue"
          placeholder="🔍 Search collections…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="text-xs font-semibold text-orange-text"
          onClick={() => {
            setChip('')
            setQ('')
          }}
        >
          Clear
        </button>
      </FilterBar>
      {!filtered.length ? (
        <EmptyState
          icon="🗂"
          title="No collections found"
          msg="Try adjusting your search or category filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="cursor-pointer overflow-hidden rounded-xl border border-border-sdb bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-[90px]" style={{ background: c.bg }} />
              <div className="p-3.5">
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-orange-text">{c.chip}</div>
                <div className="font-serif text-sm font-bold text-ink">{c.title}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-mid">{c.desc}</p>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-sm font-bold text-sdb-blue">{c.count} resources</span>
                  <span className="text-sdb-orange">→</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export function InstitutionsView() {
  const [fType, setFType] = useState('')
  const [fProvince, setFProvince] = useState('')
  const [fRegion, setFRegion] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'provincial') return
    const reg = String(s.region || '').trim()
    if (!reg) return
    setFRegion((prev) => {
      if (prev) return prev
      const allowed = ['South Asia', 'Europe', 'Africa']
      if (!allowed.includes(reg)) return prev
      return reg
    })
  }, [])

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return DASHBOARD_INSTITUTIONS.filter((i) => {
      if (
        qq &&
        !i.name.toLowerCase().includes(qq) &&
        !i.type.toLowerCase().includes(qq) &&
        !(i.province && i.province.toLowerCase().includes(qq)) &&
        !(i.desc && i.desc.toLowerCase().includes(qq))
      ) {
        return false
      }
      if (fType && i.type !== fType) return false
      if (fProvince && i.province !== fProvince) return false
      if (fRegion && i.region !== fRegion) return false
      return true
    })
  }, [fType, fProvince, fRegion, q])

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="Pastoral Works"
        subtitle="CristO–Religio linked institutional map across 92 provinces · 7,240 works in 136 nations"
      />
      <FilterBar>
        <select className={sel} value={fType} onChange={(e) => setFType(e.target.value)}>
          {INSTITUTION_TYPE_OPTIONS.map((o) => (
            <option key={o || 'all'} value={o}>
              {o ? o : 'All types'}
            </option>
          ))}
        </select>
        <select className={sel} value={fProvince} onChange={(e) => setFProvince(e.target.value)}>
          {RESOURCE_PROVINCE_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className={sel} value={fRegion} onChange={(e) => setFRegion(e.target.value)}>
          <option value="">All Regions</option>
          <option>South Asia</option>
          <option>Europe</option>
          <option>Africa</option>
        </select>
        <input
          className="min-w-[180px] flex-1 rounded border border-border-sdb bg-white px-3 py-1.5 text-[13px] outline-none focus:border-sdb-blue"
          placeholder="🔍 Search by name, province, description…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className="text-xs font-semibold text-orange-text"
          onClick={() => {
            setFType('')
            setFProvince('')
            setFRegion('')
            setQ('')
          }}
        >
          Clear
        </button>
      </FilterBar>
      <div className="overflow-x-auto rounded-xl border border-border-sdb bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-sdb-blue-light bg-sdb-blue-pale">
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sdb-blue-deep">
                Institution
              </th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sdb-blue-deep">
                Province
              </th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sdb-blue-deep">Type</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sdb-blue-deep">
                Activities &amp; Reach
              </th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sdb-blue-deep">
                State/Country
              </th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sdb-blue-deep">Source</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-sdb-blue-deep">Status</th>
            </tr>
          </thead>
          <tbody>
            {!filtered.length ? (
              <tr>
                <td colSpan={7} className="p-10 text-center">
                  <div className="text-3xl">🏛</div>
                  <div className="mt-2 font-serif font-bold text-sdb-blue-deep">No institutions found</div>
                  <p className="mt-1 text-sm text-mid">Try adjusting province or type filters.</p>
                </td>
              </tr>
            ) : (
              filtered.map((i) => (
                <tr key={i.id} className="cursor-pointer border-b border-border-sdb last:border-0 hover:bg-sdb-blue-pale/60">
                  <td className="px-3.5 py-3 text-[13px]">
                    <div className="font-semibold text-ink">{i.name}</div>
                    {i.desc ? <div className="mt-0.5 line-clamp-2 text-[11px] text-mid">{i.desc}</div> : null}
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="rounded bg-sdb-blue-pale px-1.5 py-0.5 text-[11px] font-semibold text-sdb-blue-deep">
                      {i.province || '—'}
                    </span>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="rounded bg-off-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-sdb">
                      {i.type}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-xs text-mid">
                    {i.activities ? (
                      <>
                        <span className="font-semibold text-sdb-blue-deep">{i.activities}</span> activities ·{' '}
                        {(i.participants || 0).toLocaleString()} participants
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3.5 py-3 text-xs">{i.country}</td>
                  <td className="px-3.5 py-3">
                    {i.url ? (
                      <a
                        href={`https://${i.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-orange-text no-underline"
                      >
                        {i.url} ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                      {i.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 rounded-xl border border-border-sdb bg-white">
        <div className="flex items-center justify-between border-b border-border-sdb px-3 py-2">
          <span className="text-sm font-semibold text-sdb-blue-deep">🗺 South Asia — Institution Map</span>
          <span className="rounded-full bg-sdb-blue-pale px-2 py-0.5 text-[10px] font-bold text-sdb-blue-deep">
            Click a marker
          </span>
        </div>
        <div
          className="flex h-52 items-center justify-center text-sm text-mid"
          style={{ background: 'linear-gradient(160deg,#EEF5FC 0%,#D6E8F7 100%)' }}
        >
          Interactive map (reference HTML SVG markers: INK, INM, INH…)
        </div>
      </div>
    </main>
  )
}

const NETWORKS_KPI_STRIP = [
  { orangeTop: true, icon: '🏫', iconBg: '#FEF3C7', value: '261', label: 'Schools' },
  { orangeTop: false, icon: '🎓', iconBg: '#D1FAE5', value: '51', label: 'Colleges' },
  { orangeTop: false, icon: '🔧', iconBg: '#E8F0FA', value: '138', label: 'Technical Institutes' },
  { orangeTop: true, icon: '🛡', iconBg: '#FEF3C7', value: '174', label: 'YaR Centres' },
  { orangeTop: false, icon: '🏠', iconBg: '#D1FAE5', value: '192', label: 'Hostels' },
]

const NETWORKS_PROVINCES = [
  { code: 'INK', name: 'Bangalore Province', toast: 'Bangalore (INK) — Fr. Jose Koyickal · Education & Culture' },
  { code: 'INM', name: 'Chennai Province', toast: 'Chennai (INM) — Fr. Don Bosco Lourdusamy · DBYA' },
  { code: 'IND', name: 'Dimapur Province', toast: 'Dimapur (IND) — Fr. Joseph Pampackal · Missions' },
  { code: 'ING', name: 'Guwahati Province', toast: 'Guwahati (ING) — Fr. Sebastian Kuricheal · Schools' },
  { code: 'INH', name: 'Hyderabad Province', toast: 'Hyderabad (INH) — Fr. Thomas Santhiagu · YaR' },
  { code: 'INC', name: 'Kolkata Province', toast: 'Kolkata (INC) — Fr. Sunil Kerketta · Salesian Family' },
  { code: 'INB', name: 'Mumbai Province', toast: 'Mumbai (INB) — Fr. Ashley Miranda · BOSCOM' },
  { code: 'INN', name: 'New Delhi Province', toast: 'New Delhi (INN) — Fr. Davis Maniparamben · DB Tech' },
  { code: 'INP', name: 'Panjim Province', toast: 'Panjim (INP) — Fr. Clive Justin Telles · Bosconet' },
  { code: 'INS', name: 'Shillong Province', toast: 'Shillong (INS) — Fr. John Zosiama · Formation' },
  { code: 'INT', name: 'Tiruchy Province', toast: 'Tiruchy (INT) — Fr. Doss Kennedy · Vocational' },
  { code: 'LKC', name: 'Sri Lanka Vice Province', toast: 'Sri Lanka (LKC) — Fr. Roshan Miranda' },
]

const NETWORKS_REGIONAL = [
  { dot: '#0057A8', label: 'Don Bosco Youth Animation (DBYA)', toast: 'Don Bosco Youth Animation (DBYA) · coordinated by INM' },
  { dot: '#0057A8', label: 'Don Bosco Schools (AIDBES)', toast: 'Don Bosco Schools / AIDBES · 261 schools · INK' },
  { dot: '#2272C3', label: 'DB Higher Education India (DBHEI)', toast: 'DB Higher Education India (DBHEI) · 51 colleges · INK' },
  { dot: '#1A6B3C', label: 'Child Friendly Cities (CFCI)', toast: 'Child Friendly Cities Initiative (CFCI)' },
  { dot: '#B84D00', label: 'Young at Risk Forum (DB YaR)', toast: 'Young at Risk Forum India (DB YaR) · 174 centres · INH' },
  { dot: '#7A5000', label: 'DB Job Placement Network (JPN)', toast: 'Don Bosco Job Placement Network (JPN) · donboscojobs.org' },
  { dot: '#0057A8', label: 'Don Bosco Tech (DB Tech)', toast: 'Don Bosco Tech (DB Tech) · 138 institutes · INN · dbtech.in' },
  { dot: '#2D6A4F', label: 'DB Indigenous Cultures (DBCIC)', toast: 'DB Centre for Indigenous Cultures (DBCIC) · dbcic.org' },
  { dot: '#5B21B6', label: 'Don Bosco Renewal Centre (DBYP)', toast: 'Don Bosco Renewal Centre (DBYP)' },
  { dot: '#003A75', label: 'Don Bosco Network (Bosconet)', toast: 'Don Bosco Network (Bosconet) · bosconet.in · INP' },
  { dot: '#003A75', label: 'DB Communications (BOSCOM)', toast: 'Don Bosco Communications (BOSCOM) · South Asia · INB' },
]

const NETWORKS_GLOBAL_LINKS = [
  { href: 'https://www.sdb.org/en', dot: '#0057A8', label: 'Salesian Worldwide (sdb.org)' },
  { href: 'https://infoans.org/en/', dot: '#B84D00', label: 'Info ANS (News Agency)' },
  { href: 'https://www.donboscogreen.org/', dot: '#1A6B3C', label: 'Don Bosco Green Alliance' },
  { href: 'https://famigliasalesiana.org/en', dot: '#5B21B6', label: 'Salesian Family (32 groups)' },
  { href: 'https://ius-sdb.com/', dot: '#2272C3', label: 'IUS — Salesian Universities' },
  { href: 'https://www.donboscosouthasia.org', dot: '#003A75', label: 'Don Bosco South Asia Portal' },
]

const NETWORKS_WAY_PILLS = [
  { t: '🎓 We Form', toast: 'We Form — 57 Formation Centres' },
  { t: '🏫 We Educate', toast: 'We Educate — 261 Schools' },
  { t: '🔧 We Skill', toast: 'We Skill — 138 Technical Institutes' },
  { t: '🛡 We Care', toast: 'We Care — 174 YaR Centres' },
  { t: '🌱 We Develop', toast: 'We Develop — 13 PDO Centres' },
  { t: '📡 We Communicate', toast: 'We Communicate — 18 BOSCOM Centres' },
  { t: '🏠 We Host', toast: 'We Host — 192 Hostels' },
  { t: '⛪ We Shepherd', toast: 'We Shepherd — 174 Parishes' },
]

export function NetworksView() {
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return undefined
    const id = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(id)
  }, [toast])

  function showToast(msg) {
    setToast(msg)
  }

  return (
    <main id="page-networks" className="relative min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border border-border-sdb bg-white px-4 py-2.5 text-center text-sm font-medium text-ink shadow-lg">
          {toast}
        </div>
      ) : null}
      <SectionHeader
        title="Salesian Networks"
        subtitle="Provincial, regional, and global network directory — South Asia"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {NETWORKS_KPI_STRIP.map((k) => (
          <div
            key={k.label}
            className={[
              'rounded-xl border border-border-sdb bg-white px-[18px] pb-4 pt-[17px] shadow-sm',
              k.orangeTop ? 'border-t-[3px] border-t-sdb-orange' : 'border-t-[3px] border-t-sdb-blue-light',
            ].join(' ')}
          >
            <div className="mb-2.5 flex items-start">
              <div
                className="flex size-9 items-center justify-center rounded-lg text-base"
                style={{ background: k.iconBg }}
              >
                {k.icon}
              </div>
            </div>
            <div className="font-serif text-[26px] font-bold leading-none text-sdb-blue-deep">{k.value}</div>
            <div className="mt-1 text-xs text-mid">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border-sdb px-4 py-2.5">
            <span className="text-sm font-semibold text-sdb-blue-deep">🗺 South Asia Provinces</span>
            <Link to="/dashboard/persons" className="text-[11px] font-semibold text-orange-text no-underline hover:underline">
              Meet Provincials →
            </Link>
          </div>
          <div className="flex flex-col gap-1 p-3">
            {NETWORKS_PROVINCES.map((p) => (
              <button
                key={p.code}
                type="button"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-sdb-blue-pale"
                onClick={() => showToast(p.toast)}
              >
                <span className="min-w-[36px] shrink-0 rounded bg-sdb-blue px-[7px] py-0.5 text-center text-[11px] font-bold text-white">
                  {p.code}
                </span>
                <span className="min-w-0 flex-1">{p.name}</span>
                <span className="shrink-0 text-[13px] text-mid">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
            🔗 Regional Networks
          </div>
          <div className="flex flex-col gap-1 p-3">
            {NETWORKS_REGIONAL.map((r) => (
              <button
                key={r.label}
                type="button"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-sdb-blue-pale"
                onClick={() => showToast(r.toast)}
              >
                <span className="size-[9px] shrink-0 rounded-full" style={{ background: r.dot }} />
                <span className="min-w-0 flex-1">{r.label}</span>
                <span className="shrink-0 text-[13px] text-mid">→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
            <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
              🌐 Global Links
            </div>
            <div className="flex flex-col gap-1 p-3">
              {NETWORKS_GLOBAL_LINKS.map((g) => (
                <a
                  key={g.href}
                  href={g.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink no-underline transition-colors hover:bg-sdb-blue-pale"
                >
                  <span className="size-[9px] shrink-0 rounded-full" style={{ background: g.dot }} />
                  <span className="min-w-0 flex-1">{g.label}</span>
                  <span className="shrink-0 text-[13px] text-mid">↗</span>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
            <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
              ⚡ The Salesian Way
            </div>
            <div className="p-3.5">
              <p className="text-[13px] leading-relaxed text-slate-sdb">
                &quot;Education is a matter of the heart.&quot; — Don Bosco. The Preventive System is based on{' '}
                <strong className="text-ink">Reason, Religion, and Loving-Kindness</strong>.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {NETWORKS_WAY_PILLS.map((pill) => (
                  <button
                    key={pill.t}
                    type="button"
                    className="cursor-pointer rounded-lg border border-sdb-blue-light bg-sdb-blue-pale px-2.5 py-2 text-center text-xs font-semibold text-sdb-blue-deep transition-colors hover:border-sdb-blue hover:bg-sdb-blue hover:text-white"
                    onClick={() => showToast(pill.toast)}
                  >
                    {pill.t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

const EVENT_TYPE_NAMES = ['', 'Congress', 'Retreat', 'Youth Gathering', 'Mission Event']
const EVENT_REGIONS = ['', 'Europe', 'South Asia', 'Africa', 'Latin America']
const EVENT_GROUPS = ['', 'SDB', 'FMA', 'Cooperators']
const EVENT_MONTHS = ['', 'Mar', 'Apr', 'May', 'Nov']

function filterEvents(list, f) {
  const q = f.q.trim().toLowerCase()
  return list.filter((e) => {
    if (q && !e.title.toLowerCase().includes(q) && !e.location?.toLowerCase().includes(q) && !e.org?.toLowerCase().includes(q)) {
      return false
    }
    if (f.type && e.typeName !== f.type) return false
    if (f.region && e.region !== f.region) return false
    if (f.month && e.mon !== f.month) return false
    if (f.group && e.grp !== f.group) return false
    return true
  })
}

export function EventsView() {
  const [f, setF] = useState({ type: '', region: '', group: '', month: '', q: '' })

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'provincial') return
    const reg = String(s.region || '').trim()
    if (!reg) return
    setF((prev) => {
      if (prev.region) return prev
      if (!EVENT_REGIONS.includes(reg)) return prev
      return { ...prev, region: reg }
    })
  }, [])

  const filtered = useMemo(() => filterEvents(DASHBOARD_EVENTS, f), [f])

  const typeBadge = (t) => {
    if (t === 'ev-youth') return 'bg-amber-100 text-amber-900'
    if (t === 'ev-congress') return 'bg-sdb-blue-pale text-sdb-blue-deep'
    if (t === 'ev-retreat') return 'bg-emerald-100 text-emerald-900'
    if (t === 'ev-mission') return 'bg-red-100 text-red-900'
    return 'bg-slate-100 text-slate-700'
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="Events"
        subtitle="ANS-integrated global Salesian calendar — complementary to external platforms"
      />
      <FilterBar>
        <select className={sel} value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
          {EVENT_TYPE_NAMES.map((o) => (
            <option key={o || 'all'} value={o}>
              {o ? o : 'All types'}
            </option>
          ))}
        </select>
        <select className={sel} value={f.region} onChange={(e) => setF((s) => ({ ...s, region: e.target.value }))}>
          {EVENT_REGIONS.map((o) => (
            <option key={o || 'allr'} value={o}>
              {o ? o : 'All regions'}
            </option>
          ))}
        </select>
        <select className={sel} value={f.group} onChange={(e) => setF((s) => ({ ...s, group: e.target.value }))}>
          {EVENT_GROUPS.map((o) => (
            <option key={o || 'allg'} value={o}>
              {o ? o : 'All Salesian groups'}
            </option>
          ))}
        </select>
        <select className={sel} value={f.month} onChange={(e) => setF((s) => ({ ...s, month: e.target.value }))}>
          {EVENT_MONTHS.map((o) => (
            <option key={o || 'allm'} value={o}>
              {o ? `Month: ${o}` : 'All months'}
            </option>
          ))}
        </select>
        <input
          className="min-w-[180px] flex-1 rounded border border-border-sdb bg-white px-3 py-1.5 text-[13px] outline-none focus:border-sdb-blue"
          placeholder="🔍 Search events…"
          value={f.q}
          onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))}
        />
        <button type="button" className="text-xs font-semibold text-orange-text" onClick={() => setF({ type: '', region: '', group: '', month: '', q: '' })}>
          Clear
        </button>
      </FilterBar>
      <div className="flex flex-col gap-3">
        {!filtered.length ? (
          <EmptyState icon="📅" title="No events found" msg="Try adjusting your filters." />
        ) : (
          filtered.map((e) => (
            <div
              key={e.id}
              className="flex cursor-pointer gap-4 rounded-xl border border-border-sdb bg-white p-4 shadow-sm transition-all hover:border-sdb-blue-light hover:shadow-md"
            >
              <div className="w-[52px] shrink-0 rounded-lg bg-sdb-blue-pale px-1 py-2 text-center">
                <div className="font-serif text-[26px] font-bold leading-none text-sdb-blue-deep">{e.date}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-sdb-orange">{e.mon}</div>
              </div>
              <div className="min-w-0 flex-1">
                <span className={`mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${typeBadge(e.type)}`}>
                  {e.typeName}
                </span>
                <div className="text-sm font-bold text-ink">{e.title}</div>
                <div className="mt-1.5 flex flex-wrap gap-3.5 text-xs text-mid">
                  <span>📍 {e.location}</span>
                  <span>🏢 {e.org}</span>
                  <span>👥 {e.participants.toLocaleString()}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-mid">{e.desc}</p>
                {e.coll ? (
                  <div className="mt-2 rounded-md bg-sdb-orange/15 px-2.5 py-1 text-xs font-semibold text-orange-text">
                    🗂 Part of collection: {e.coll}
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}

const PERSON_REGION_OPTS = ['', 'South Asia', 'Europe', 'Africa', 'Latin America', 'East Asia']

function filterPersons(list, f) {
  const q = f.q.trim().toLowerCase()
  return list.filter((p) => {
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.title.toLowerCase().includes(q) &&
      !(p.province && p.province.toLowerCase().includes(q))
    ) {
      return false
    }
    if (f.region && p.region !== f.region) return false
    if (f.province && p.province !== f.province) return false
    if (f.aff && p.aff !== f.aff) return false
    if (f.vis === 'public' && p.vis !== 'public') return false
    if (f.vis === 'private' && p.vis !== 'private') return false
    return true
  })
}

export function PersonsView() {
  const [f, setF] = useState({ region: '', province: '', aff: '', vis: '', q: '' })

  useEffect(() => {
    const s = getSession()
    if (!s || s.role !== 'provincial') return
    const reg = String(s.region || '').trim()
    if (!reg) return
    setF((prev) => {
      if (prev.region) return prev
      if (!PERSON_REGION_OPTS.includes(reg)) return prev
      return { ...prev, region: reg }
    })
  }, [])

  const filtered = useMemo(() => filterPersons(DASHBOARD_PERSONS, f), [f])

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="Persons Directory"
        subtitle="Salesian scholars, educators, and ministers — public profiles only shown in global search"
      />
      <FilterBar>
        <select className={sel} value={f.region} onChange={(e) => setF((s) => ({ ...s, region: e.target.value }))}>
          {PERSON_REGION_OPTS.map((o) => (
            <option key={o || 'all'} value={o}>
              {o ? o : 'All regions'}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={f.province}
          onChange={(e) => setF((s) => ({ ...s, province: e.target.value }))}
        >
          {RESOURCE_PROVINCE_OPTIONS.map((o) => (
            <option key={o.value || 'allp'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className={sel} value={f.aff} onChange={(e) => setF((s) => ({ ...s, aff: e.target.value }))}>
          <option value="">All groups</option>
          <option>SDB</option>
          <option>FMA</option>
          <option>Cooperators</option>
        </select>
        <select className={sel} value={f.vis} onChange={(e) => setF((s) => ({ ...s, vis: e.target.value }))}>
          <option value="">All visibility</option>
          <option value="public">Public only</option>
          <option value="private">Internal only</option>
        </select>
        <input
          className="min-w-[180px] flex-1 rounded border border-border-sdb bg-white px-3 py-1.5 text-[13px] outline-none focus:border-sdb-blue"
          placeholder="🔍 Search by name, title, province…"
          value={f.q}
          onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))}
        />
        <button
          type="button"
          className="text-xs font-semibold text-orange-text"
          onClick={() => setF({ region: '', province: '', aff: '', vis: '', q: '' })}
        >
          Clear
        </button>
      </FilterBar>
      {!filtered.length ? (
        <EmptyState icon="👥" title="No persons found" msg="Try adjusting filters or search." />
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((p) => (
            <div
              key={p.name}
              className="cursor-pointer rounded-xl border border-border-sdb bg-white p-[18px] text-center shadow-sm transition-all hover:border-sdb-blue-light hover:shadow-md"
            >
              <div className="mx-auto mb-2.5 flex size-[46px] items-center justify-center rounded-full border-2 border-sdb-blue-light bg-linear-to-br from-sdb-blue to-sdb-blue-mid text-[15px] font-bold text-white">
                {p.init}
              </div>
              <div className="text-[13px] font-bold text-ink">{p.name}</div>
              <div className="mt-1 text-[11px] leading-snug text-mid">{p.title}</div>
              <div className="mt-2">
                <span className="inline-block rounded-full bg-sdb-blue-pale px-2.5 py-0.5 text-xs font-semibold text-sdb-blue-deep">
                  {p.region}
                </span>
                <span
                  className={`ml-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${p.vis === 'public' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {p.vis === 'public' ? 'Public' : 'Internal'}
                </span>
              </div>
              <div className="mt-2.5 flex justify-center gap-3.5">
                <div>
                  <div className="text-[15px] font-bold text-sdb-blue-deep">{p.pubs}</div>
                  <div className="text-xs text-mid">Publications</div>
                </div>
                <div>
                  <div className="text-[15px] font-bold text-sdb-blue-deep">{p.evts}</div>
                  <div className="text-xs text-mid">Events</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export function AiView() {
  const location = useLocation()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ask anything about the corpus — e.g. summarizing youth-at-risk resources for South Asia.' }
  ])
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    const p = location.state?.prefilledPrompt
    if (typeof p !== 'string' || !p.trim()) return
    setInput(p.trim())
  }, [location.pathname, location.key, location.state])

  function handleSend(text) {
    const q = (text || input).trim()
    if (!q) return

    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setIsTyping(true)

    // Simulate AI thinking and response
    setTimeout(() => {
      const responses = [
        `I am analyzing the corpus for information about "${q}". Based on the knowledge graph, there are several key resources in South Asia...`,
        `That's an interesting question about "${q}". I can summarize the related documents for you or translate them if needed.`,
        `The current ontology contains multiple records related to "${q}". Would you like me to highlight the most relevant ones?`
      ]
      const randomResponse = responses[Math.floor(Math.random() * responses.length)]

      setMessages(prev => [...prev, { role: 'assistant', text: randomResponse }])
      setIsTyping(false)
    }, 1200)
  }

  function handleTool(toolName) {
    handleSend(`Can you ${toolName.toLowerCase()} related resources?`)
  }

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="AI Assistant"
        subtitle="Semantic search · Summarization · Translation · Document chat"
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_272px]">
        <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-border-sdb bg-white">
          <div className="flex-1 space-y-4 overflow-y-auto p-[18px]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === 'assistant'
                  ? 'bg-off-white text-ink border border-border-sdb'
                  : 'bg-sdb-blue text-white shadow-md'
                  }`}>
                  <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-tighter opacity-70">
                    {m.role === 'assistant' ? '✧ Assistant' : '👤 You'}
                  </span>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-off-white border border-border-sdb px-4 py-2 text-xs text-mid animate-pulse">
                  Assistant is thinking...
                </div>
              </div>
            )}
          </div>
          <form
            className="flex gap-2.5 border-t border-border-sdb p-3"
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          >
            <input
              className="flex-1 rounded border border-border-sdb px-3 py-2 text-[13px] outline-none focus:border-sdb-blue transition-all"
              placeholder="Ask anything… e.g. 'Summarize resources on Drug Addiction in South Asia'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={isTyping}
              className="rounded bg-sdb-blue px-[18px] py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-sdb-blue-deep transition-colors disabled:opacity-50"
            >
              Send ✦
            </button>
          </form>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-border-sdb bg-white p-3.5">
            <div className="mb-2 font-semibold text-sdb-blue-deep">AI Tools</div>
            {[
              ['🔍', 'Semantic Search', 'Natural language queries'],
              ['📝', 'Summarize', 'Document summaries'],
              ['🌐', 'Translate', 'EN · IT · ES · FR · PT'],
              ['✨', 'Recommend', 'Related resources'],
            ].map(([ic, n, d]) => (
              <button
                key={n}
                className="mt-2 flex w-full gap-2.5 rounded-lg border border-border-sdb bg-off-white p-2 text-left transition-all hover:border-sdb-blue-light hover:bg-white"
                onClick={() => handleTool(n)}
              >
                <span className="w-[30px] text-center text-[17px]">{ic}</span>
                <div>
                  <div className="text-[13px] font-semibold text-sdb-blue-deep">{n}</div>
                  <div className="text-xs text-mid">{d}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-sdb-blue-light bg-sdb-blue-pale p-3.5 text-xs leading-relaxed text-slate-sdb">
            <h4 className="mb-2 text-[13px] font-bold text-sdb-blue-deep">How semantic search works</h4>
            <p>
              Unlike keyword search, semantic search understands meaning — including resources that do not repeat your
              exact words.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}


export function OwlView() {
  const [summary, setSummary] = useState(null)
  const [sumErr, setSumErr] = useState(null)
  const [sumLoading, setSumLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setSumLoading(true)
    setSumErr(null)
    fetchOntologySummary()
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch((e) => {
        if (!cancelled) setSumErr(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setSumLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const totalRows = summary?.total_rows != null ? Number(summary.total_rows).toLocaleString() : '—'
  const knowAreas =
    summary?.distinct_knowledge_areas != null ? String(summary.distinct_knowledge_areas) : '—'
  const lastIngest = summary?.last_ingestion || summary?.last_updated || '—'

  const kpi = sumLoading
    ? [
      ['🦉', '…', 'Bronze ontology', 'Loading'],
      ['🏷', '…', 'Total rows', '…'],
      ['🔗', '…', 'Distinct knowledge areas', '…'],
      ['🕐', '…', 'Last ingestion / update', '…'],
    ]
    : sumErr
      ? [
        ['🦉', '—', 'Bronze ontology', 'Error'],
        ['⚠️', sumErr.slice(0, 42) + (sumErr.length > 42 ? '…' : ''), 'API detail', 'Fix .env'],
        ['🔗', '—', 'Distinct knowledge areas', '—'],
        ['🕐', '—', 'Last ingestion', '—'],
      ]
      : [
        ['🦉', 'v3.4.1', 'OWL Version (UI)', 'Live'],
        ['🏷', totalRows, 'Total bronze rows', 'Databricks'],
        ['🔗', knowAreas, 'Distinct knowledge areas', 'Taxonomy'],
        ['🕐', String(lastIngest), 'Last ingestion / update', 'Recent'],
      ]

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="OWL Ontology Update"
        subtitle="Pipeline controls plus live row counts from ontology.bronze.final_table_ontology"
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpi.map(([icon, val, lbl, tr], idx) => (
          <div key={`${lbl}-${idx}`} className="rounded-xl border border-border-sdb border-t-[3px] border-t-sdb-orange bg-white p-4 shadow-sm">
            <div className="mb-1 flex justify-between text-lg">
              <span>{icon}</span>
              <span className="text-xs font-semibold text-emerald-700">{tr}</span>
            </div>
            <div className="line-clamp-2 font-serif text-lg font-bold text-sdb-blue-deep">{val}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-mid">{lbl}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border-sdb bg-white p-4">
          <div className="mb-2 font-semibold text-sdb-blue-deep">⚡ Trigger OWL Update</div>
          <p className="mb-3 text-xs text-mid">
            Start the OWL ontology regeneration pipeline. All 6 stages run sequentially with real-time status reporting.
          </p>
          <div className="mb-3 rounded border border-border-sdb bg-off-white px-3 py-2 font-mono text-xs text-orange-text">
            POST /api/trigger-owl-update
          </div>
          <button type="button" className="w-full rounded-lg bg-sdb-orange py-3 text-sm font-semibold text-white">
            🦉 Run OWL Update
          </button>
        </div>
        <div className="rounded-xl border border-border-sdb bg-white p-4">
          <div className="mb-2 flex justify-between font-semibold text-sdb-blue-deep">
            <span>📋 Process Monitor</span>
            <span className="text-xs font-normal text-mid">Idle</span>
          </div>
          <p className="text-xs text-mid">Pipeline steps appear here when a run is started (reference HTML).</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl border border-border-sdb bg-white">
        <div className="border-b border-border-sdb px-4 py-2 text-sm font-semibold text-sdb-blue-deep">
          🗂 Update History
        </div>
        <div className="divide-y divide-border-sdb p-4 text-xs">
          <div>
            <strong className="text-ink">OWL v3.4.1</strong> — all 6 stages completed · 847 classes · 312 properties
            <div className="text-mid">2026-03-01 18:42 UTC · paul.dsouza</div>
          </div>
          <div className="pt-3">
            <strong className="text-ink">OWL v3.4.0</strong> — Province INK taxonomy mappings updated
            <div className="text-mid">2026-02-28 09:15 UTC</div>
          </div>
        </div>
      </div>
    </main>
  )
}

const ANALYTICS_PROVINCE_OPTIONS = [
  { value: 'all', label: 'All Provinces' },
  { value: 'INK', label: 'INK Bangalore' },
  { value: 'INM', label: 'INM Chennai' },
  { value: 'IND', label: 'IND Dimapur' },
  { value: 'ING', label: 'ING Guwahati' },
  { value: 'INH', label: 'INH Hyderabad' },
  { value: 'INC', label: 'INC Kolkata' },
  { value: 'INB', label: 'INB Mumbai' },
  { value: 'INN', label: 'INN New Delhi' },
  { value: 'INP', label: 'INP Panjim' },
  { value: 'INS', label: 'INS Shillong' },
  { value: 'INT', label: 'INT Tiruchy' },
  { value: 'LKC', label: 'LKC Sri Lanka' },
]

const ANALYTICS_AREA_OPTIONS = [
  { value: 'all', label: 'All Areas' },
  { value: 'Education', label: 'Education' },
  { value: 'Youth Ministry', label: 'Youth Ministry' },
  { value: 'Formation', label: 'Formation' },
  { value: 'Social Development', label: 'Social Development' },
  { value: 'Spirituality', label: 'Spirituality' },
  { value: 'Pedagogy', label: 'Pedagogy' },
]

/** Wireframe `renderAnalytics` — Knowledge areas (max = first value) */
const ANALYTICS_AREA_ROWS = [
  ['Education', 3240],
  ['Youth Ministry', 2890],
  ['Formation', 1980],
  ['Social Development', 1654],
  ['Spirituality', 1247],
  ['Pedagogy', 986],
  ['Missiology', 850],
]

const ANALYTICS_TYPE_ROWS = [
  ['Official Publication', 4892],
  ['Study', 3241],
  ['Good Practice', 2187],
  ['Multimedia', 1432],
  ['MARC21', 1095],
]

const ANALYTICS_AI_ROWS = [
  ['Semantic Search', 1842],
  ['Summarize', 1124],
  ['Translate', 678],
  ['Recommend', 247],
]

const ANALYTICS_NETWORK_ROWS = [
  ['Bosconet NGOs', 350, 350, '#0057A8'],
  ['DB Tech Institutes', 138, 350, '#E8600A'],
  ['DB Schools', 261, 350, '#1A6B3C'],
  ['DB Colleges', 51, 350, '#5B21B6'],
  ['YaR Centres', 174, 350, '#B84D00'],
  ['Parishes', 174, 350, '#2D6A4F'],
]

/** Wireframe monthly trend: [month, actual|null, forecast|null] */
const ANALYTICS_MONTHLY_TREND = [
  ['Jan', 820, null],
  ['Feb', 940, null],
  ['Mar', 1080, null],
  ['Apr', 1020, null],
  ['May', 1190, null],
  ['Jun', 1340, null],
  ['Jul', 1210, null],
  ['Aug', 1380, null],
  ['Sep', 1450, null],
  ['Oct', 1620, null],
  ['Nov', 1580, null],
  ['Dec', 1760, null],
  ["Jan'26", null, 1820],
  ["Feb'26", null, 1940],
  ["Mar'26", null, 2100],
]

const ANALYTICS_COMPLIANCE_GRID = [
  { code: 'INK', score: 94, color: '#1A8A5A' },
  { code: 'INM', score: 88, color: '#1A8A5A' },
  { code: 'IND', score: 71, color: '#B02020' },
  { code: 'ING', score: 82, color: '#1A8A5A' },
  { code: 'INH', score: 79, color: '#C07A00' },
  { code: 'INC', score: 86, color: '#1A8A5A' },
  { code: 'INB', score: 91, color: '#1A8A5A' },
  { code: 'INN', score: 84, color: '#1A8A5A' },
  { code: 'INP', score: 78, color: '#C07A00' },
  { code: 'INS', score: 90, color: '#1A8A5A' },
  { code: 'INT', score: 87, color: '#1A8A5A' },
  { code: 'LKC', score: 61, color: '#B02020' },
]

const ANALYTICS_BAR_GRADIENT = 'linear-gradient(90deg, #0057A8, #E8600A)'

function barRowsFromMaxTuples(tuples) {
  const maxVal = tuples[0][1]
  return tuples.map(([label, value]) => ({
    label,
    value,
    widthPct: Math.round((value / maxVal) * 100),
  }))
}

function AnalyticsBarRow({ label, value, widthPct, fill, title }) {
  const fillStyle =
    fill === 'gradient'
      ? { width: `${widthPct}%`, background: ANALYTICS_BAR_GRADIENT }
      : { width: `${widthPct}%`, background: fill }
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-[155px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-sdb"
        title={title || label}
      >
        {label}
      </div>
      <div className="h-[7px] min-w-0 flex-1 overflow-hidden rounded-full bg-off-white">
        <div className="h-full rounded-full transition-[width] duration-500" style={fillStyle} />
      </div>
      <div className="min-w-[2.5rem] shrink-0 text-right text-xs font-semibold text-mid">{value}</div>
    </div>
  )
}

function AnalyticsBarChart({ rows }) {
  return (
    <div className="flex flex-col gap-2 py-0.5">
      {rows.map((r) => (
        <AnalyticsBarRow
          key={r.label}
          label={r.label}
          value={typeof r.value === 'number' ? r.value.toLocaleString() : String(r.value)}
          widthPct={r.widthPct}
          fill={r.barColor ?? 'gradient'}
          title={r.title}
        />
      ))}
    </div>
  )
}

const ANALYTICS_AREA_BAR_ROWS = barRowsFromMaxTuples(ANALYTICS_AREA_ROWS)
const ANALYTICS_TYPE_BAR_ROWS = barRowsFromMaxTuples(ANALYTICS_TYPE_ROWS)
const ANALYTICS_AI_BAR_ROWS = barRowsFromMaxTuples(ANALYTICS_AI_ROWS).map((r) => ({ ...r, barColor: 'var(--color-sdb-orange, #E8600A)' }))
const ANALYTICS_NETWORK_BAR_ROWS = ANALYTICS_NETWORK_ROWS.map(([label, v, m, c]) => ({
  label,
  value: v,
  widthPct: Math.round((v / m) * 100),
  barColor: c,
}))

function AnalyticsStatCard({ orangeTop, icon, iconBg, trend, value, label }) {
  return (
    <div
      className={[
        'rounded-xl border border-border-sdb bg-white px-[18px] pb-4 pt-[17px] shadow-sm',
        orangeTop ? 'border-t-[3px] border-t-sdb-orange' : 'border-t-[3px] border-t-sdb-blue-light',
      ].join(' ')}
    >
      <div className="mb-2.5 flex items-start justify-between">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">{trend}</span>
      </div>
      <div className="font-serif text-[26px] font-bold leading-none text-sdb-blue-deep">{value}</div>
      <div className="mt-1 text-xs text-mid">{label}</div>
    </div>
  )
}

function AnalyticsForecastRow({ label, widthPct, barColor, current, forecast }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="w-[150px] shrink-0 text-xs text-mid">{label}</div>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-off-white">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${widthPct}%`, background: barColor }} />
      </div>
      <div className="flex min-w-[100px] shrink-0 items-center justify-end gap-1.5 whitespace-nowrap text-[11px]">
        <span className="text-mid">{current}</span>
        <span className="text-border-sdb">→</span>
        <span className="font-bold text-sdb-blue-deep">{forecast}</span>
      </div>
    </div>
  )
}

export function AnalyticsView() {
  const [year, setYear] = useState('2025')
  const [province, setProvince] = useState('all')
  const [area, setArea] = useState('all')
  const [toast, setToast] = useState('')

  const provinceFiltered = useMemo(
    () =>
      province === 'all' ? ANALYTICS_PROVINCE_DATA : ANALYTICS_PROVINCE_DATA.filter((p) => p.code === province),
    [province],
  )

  const provinceBarRows = useMemo(() => {
    const data = provinceFiltered
    if (!data.length) return []
    const maxRes = Math.max(...data.map((p) => p.resources))
    return data.map((p) => ({
      label: `${p.code} ${p.name}`,
      title: p.fullName,
      value: p.resources,
      widthPct: Math.round((p.resources / maxRes) * 100),
      barColor: p.color,
    }))
  }, [provinceFiltered])

  const deepDiveProvinces = useMemo(
    () => (province === 'all' ? ANALYTICS_PROVINCE_DATA.slice(0, 6) : provinceFiltered),
    [province, provinceFiltered],
  )

  useEffect(() => {
    if (!toast) return undefined
    const id = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  function showToast(msg) {
    setToast(msg)
  }

  const monthlyMax = 2100

  return (
    <main id="page-analytics" className="relative min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border border-border-sdb bg-white px-4 py-2.5 text-center text-sm font-medium text-ink shadow-lg">
          {toast}
        </div>
      ) : null}
      <SectionHeader
        title="Analytics & Platform Insights"
        subtitle="AI-powered intelligence · 12 SA provinces · 23 Mar 2026 · Updated every 6 hours"
      >
        <select className={sel} value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="2026">2026 YTD</option>
          <option value="2025">2025</option>
          <option value="2024">2024</option>
          <option value="all">All time</option>
        </select>
        <select className={sel} value={province} onChange={(e) => setProvince(e.target.value)}>
          {ANALYTICS_PROVINCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className={sel} value={area} onChange={(e) => setArea(e.target.value)}>
          {ANALYTICS_AREA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg bg-sdb-blue px-3 py-1.5 text-xs font-semibold text-white"
          onClick={() => showToast('Generating AI report…')}
        >
          ✦ AI Report
        </button>
      </SectionHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <AnalyticsStatCard
          orangeTop
          icon="📚"
          iconBg="#FEF3C7"
          trend="+12%"
          value="12,847"
          label="Total Resources"
        />
        <AnalyticsStatCard icon="🏫" iconBg="#D1FAE5" trend="+2%" value="261" label="DB Schools" />
        <AnalyticsStatCard icon="🔧" iconBg="#E8F0FA" trend="+5%" value="138" label="Tech Institutes" />
        <AnalyticsStatCard
          orangeTop
          icon="🛡"
          iconBg="#FEF3C7"
          trend="+8%"
          value="174"
          label="YaR Centres"
        />
        <AnalyticsStatCard icon="✦" iconBg="#D1FAE5" trend="+41%" value="3,891" label="AI Queries/Mo" />
        <AnalyticsStatCard icon="🌐" iconBg="#E8F0FA" trend="1.75M" value="28" label="States Reached" />
      </div>

      <div className="mb-5 flex flex-col items-stretch gap-4 rounded-2xl border border-[rgba(0,87,168,0.3)] bg-gradient-to-br from-[#002240] to-[#003A75] p-5 shadow-[0_4px_20px_rgba(0,57,117,0.12)] sm:flex-row sm:items-center">
        <div className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-sdb-orange text-lg text-white">
          ✦
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-white">AI Platform Intelligence — Live Analysis · 23 Mar 2026</div>
          <p className="mt-1 text-xs leading-relaxed text-white/70">
            Based on resource upload patterns, AI query trends, and provincial contribution data, the platform has
            identified <strong className="text-white">3 priority actions</strong> and{' '}
            <strong className="text-white">4 growth opportunities</strong> for Q2 2026.
          </p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg border border-white/25 bg-white/15 px-[18px] py-2 text-xs font-semibold text-white transition-colors hover:bg-white/25"
          onClick={() => showToast('Opening full AI insights report…')}
        >
          View full report →
        </button>
      </div>

      <div id="an-insights-row" className="mb-5 grid gap-3.5 lg:grid-cols-3">
        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border-sdb px-4 py-2.5"
            style={{ borderLeftWidth: 3, borderLeftColor: '#B02020', paddingLeft: 13 }}
          >
            <span className="text-sm font-semibold text-sdb-blue-deep">⚠ Priority Actions</span>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-900">3 urgent</span>
          </div>
          <div className="flex flex-col gap-2.5 px-4 pb-4 pt-2">
            <div className="flex gap-2.5 border-b border-border-sdb py-2 last:border-b-0">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-[#B02020]" />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink">IND Province — 0 uploads in 47 days</div>
                <div className="mt-1 text-xs leading-snug text-mid">
                  Dimapur Province has not submitted resources since Feb 4. AI predicts continued gap without
                  intervention. <strong>Action:</strong> Contact Fr. Joseph Pampackal.
                </div>
              </div>
            </div>
            <div className="flex gap-2.5 border-b border-border-sdb py-2 last:border-b-0">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-[#B02020]" />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink">LKC metadata compliance: 61%</div>
                <div className="mt-1 text-xs leading-snug text-mid">
                  Sri Lanka Vice Province below 80% threshold. 24 resources missing taxonomy classification.{' '}
                  <strong>Action:</strong> Run AI auto-tag on LKC collection.
                </div>
              </div>
            </div>
            <div className="flex gap-2.5 py-2">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-[#C07A00]" />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-ink">OWL version 90 days overdue</div>
                <div className="mt-1 text-xs leading-snug text-mid">
                  Last ontology update: 2026-03-01. 3 new Salesian Family groups not yet mapped.{' '}
                  <strong>Action:</strong> Schedule OWL update this week.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border-sdb px-4 py-2.5"
            style={{ borderLeftWidth: 3, borderLeftColor: '#1A8A5A', paddingLeft: 13 }}
          >
            <span className="text-sm font-semibold text-sdb-blue-deep">✦ AI Opportunities</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-900">
              4 identified
            </span>
          </div>
          <div className="flex flex-col gap-0 px-4 pb-4 pt-2">
            {[
              {
                dot: '#1A8A5A',
                title: 'Tamil-language gap: 847 resources unindexed',
                sub: 'INM and INT provinces have Tamil-language materials not yet in the corpus. AI can auto-translate abstracts. Estimated reach: +2,400 users.',
              },
              {
                dot: '#1A8A5A',
                title: 'YaR collections under-linked',
                sub: '174 YaR centre reports exist but only 12 are cross-linked to the YaR Collection. AI recommends batch-tagging to increase discovery by 340%.',
              },
              {
                dot: '#2272C3',
                title: 'DB Tech × Education overlap untapped',
                sub: '138 vocational institute reports and 261 school directories share no cross-references. AI can generate 400+ semantic links automatically.',
              },
              {
                dot: '#6A3BAA',
                title: 'Spirituality area: lowest AI query rate',
                sub: 'Only 3.2% of AI queries target Spirituality. Suggested: Add 5 curated query templates to AI Assistant homepage to surface this content.',
              },
            ].map((it) => (
              <div key={it.title} className="flex gap-2.5 border-b border-border-sdb py-2 last:border-b-0">
                <div className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: it.dot }} />
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-ink">{it.title}</div>
                  <div className="mt-1 text-xs leading-snug text-mid">{it.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border-sdb px-4 py-2.5"
            style={{ borderLeftWidth: 3, borderLeftColor: '#0057A8', paddingLeft: 13 }}
          >
            <span className="text-sm font-semibold text-sdb-blue-deep">📈 AI Forecast — Q2 2026</span>
            <span className="rounded-full bg-sdb-blue-pale px-2 py-0.5 text-[11px] font-bold text-sdb-blue-deep">
              93% confidence
            </span>
          </div>
          <div className="p-4">
            <div className="flex flex-col gap-0">
              <AnalyticsForecastRow
                label="Resources uploaded"
                widthPct={78}
                barColor="#0057A8"
                current="12,847"
                forecast="14,200"
              />
              <AnalyticsForecastRow
                label="AI queries/month"
                widthPct={65}
                barColor="#1A8A5A"
                current="3,891"
                forecast="5,800"
              />
              <AnalyticsForecastRow
                label="New provinces onboarded"
                widthPct={40}
                barColor="#C07A00"
                current="12"
                forecast="15"
              />
              <AnalyticsForecastRow
                label="Collections created"
                widthPct={55}
                barColor="#6A3BAA"
                current="11"
                forecast="18"
              />
              <AnalyticsForecastRow
                label="Metadata compliance avg"
                widthPct={88}
                barColor="#0F8A8A"
                current="84%"
                forecast="91%"
              />
              <AnalyticsForecastRow
                label="Beneficiaries (Bosconet)"
                widthPct={72}
                barColor="#B02020"
                current="1.75M"
                forecast="2.1M"
              />
            </div>
            <div className="mt-3 border-t border-border-sdb pt-2.5 text-[11px] text-mid">
              Model: GSDP-Forecast v2.1 · Based on 3-year trend analysis · Seasonal correction applied for Q2
            </div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div id="an-provinces" className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border-sdb px-4 py-2.5">
            <span className="text-sm font-semibold text-sdb-blue-deep">Resources by Province</span>
            <button
              type="button"
              className="text-[11px] font-semibold text-orange-text"
              onClick={() => showToast('Export province data')}
            >
              Export ↓
            </button>
          </div>
          <div className="p-4">
            <AnalyticsBarChart rows={provinceBarRows} />
          </div>
        </div>
        <div id="an-areas" className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border-sdb px-4 py-2.5">
            <span className="text-sm font-semibold text-sdb-blue-deep">Knowledge Areas</span>
            <button
              type="button"
              className="text-[11px] font-semibold text-orange-text"
              onClick={() => showToast('Export area data')}
            >
              Export ↓
            </button>
          </div>
          <div className="p-4">
            <AnalyticsBarChart rows={ANALYTICS_AREA_BAR_ROWS} />
          </div>
        </div>
        <div id="an-types" className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
            Document Types
          </div>
          <div className="p-4">
            <AnalyticsBarChart rows={ANALYTICS_TYPE_BAR_ROWS} />
          </div>
        </div>
        <div id="an-ai" className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
            AI Feature Usage
          </div>
          <div className="p-4">
            <AnalyticsBarChart rows={ANALYTICS_AI_BAR_ROWS} />
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3.5 lg:grid-cols-2">
        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-sdb px-4 py-2.5">
            <span className="text-sm font-semibold text-sdb-blue-deep">📅 Monthly Upload Trend — 2025</span>
            <span className="text-[11px] text-mid">Actual + AI forecast</span>
          </div>
          <div className="p-4">
            <div id="an-monthly-trend" className="flex flex-col gap-2">
              {ANALYTICS_MONTHLY_TREND.map(([m, actual, forecast]) => {
                const v = actual ?? forecast
                const isFcst = forecast != null
                const pct = Math.round((v / monthlyMax) * 100)
                return (
                  <div key={m} className="flex items-center gap-2">
                    <div className="w-[52px] shrink-0 text-right text-[11px] text-mid">{m}</div>
                    <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-off-white">
                      <div
                        className="h-full rounded-full"
                        style={
                          isFcst
                            ? { width: `${pct}%`, background: '#C07A00', opacity: 0.7 }
                            : { width: `${pct}%`, background: '#0057A8' }
                        }
                      />
                    </div>
                    <div
                      className={`w-9 shrink-0 text-right text-[11px] font-semibold ${isFcst ? 'italic text-amber-800' : 'text-sdb-blue-deep'}`}
                    >
                      {v}
                    </div>
                    <span className={`w-7 shrink-0 text-[9px] font-bold ${isFcst ? 'text-amber-800' : 'text-transparent'}`}>
                      {isFcst ? 'fcst' : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-mid">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-[3px] w-3 rounded-sm bg-sdb-blue" />
                Actual uploads
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-[3px] w-3 rounded-sm border border-dashed border-amber-700 bg-amber-700/80" />
                AI forecast
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-sdb px-4 py-2.5">
            <span className="text-sm font-semibold text-sdb-blue-deep">🗺 Province Metadata Compliance</span>
            <span className="text-[11px] text-mid">Target: 80% · AI monitored</span>
          </div>
          <div className="p-4">
            <div id="an-compliance-grid" className="grid grid-cols-4 gap-2">
              {ANALYTICS_COMPLIANCE_GRID.map((cell) => {
                const bg = cell.score >= 90 ? '#D1FAE5' : cell.score >= 80 ? '#FEF3C7' : '#FEE2E2'
                const border = cell.score >= 90 ? '#86EFAC' : cell.score >= 80 ? '#FCD34D' : '#FCA5A5'
                return (
                  <button
                    key={cell.code}
                    type="button"
                    className="cursor-pointer rounded-lg border px-2 py-2.5 text-center transition-transform hover:scale-[1.02]"
                    style={{ background: bg, borderColor: border }}
                    onClick={() => showToast(`${cell.code}: ${cell.score}% metadata compliance`)}
                  >
                    <div className="text-[11px] font-bold text-[#1A1A1A]">{cell.code}</div>
                    <div className="my-0.5 text-base font-bold" style={{ color: cell.color }}>
                      {cell.score}%
                    </div>
                    <div className="h-[3px] w-full overflow-hidden rounded-sm bg-black/[0.08]">
                      <div className="h-full rounded-sm" style={{ width: `${cell.score}%`, background: cell.color }} />
                    </div>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-mid">
              Provinces below 80% flagged for AI-assisted metadata enrichment. Click a cell for details.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-3.5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-border-sdb px-4 py-2.5">
            <span className="text-sm font-semibold text-sdb-blue-deep">
              Province Strength — Members, Houses &amp; Resources
            </span>
            <Link
              to="/dashboard/persons"
              className="text-[11px] font-semibold text-orange-text no-underline hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto p-4" id="an-province-table">
            <table className="w-full min-w-[520px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b-2 border-sdb-blue-light text-[11px] text-sdb-blue-deep">
                  <th className="px-2 py-1.5 text-left font-bold">Province</th>
                  <th className="px-2 py-1.5 text-right font-bold">Members</th>
                  <th className="px-2 py-1.5 text-right font-bold">Houses</th>
                  <th className="px-2 py-1.5 text-right font-bold">Schools</th>
                  <th className="px-2 py-1.5 text-right font-bold">Colleges</th>
                </tr>
              </thead>
              <tbody className="text-mid">
                {ANALYTICS_PROVINCE_DATA.map((p, i) => (
                  <tr
                    key={p.code}
                    className="border-b border-border-sdb last:border-0"
                    style={{ background: i % 2 === 0 ? 'var(--color-off-white, #f8fafc)' : undefined }}
                  >
                    <td className="px-2 py-1.5 font-semibold text-ink">
                      {p.code} <span className="font-normal text-mid">{p.name}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right">{p.members}</td>
                    <td className="px-2 py-1.5 text-right">{p.houses}</td>
                    <td className="px-2 py-1.5 text-right">{p.schools}</td>
                    <td className="px-2 py-1.5 text-right">{p.colleges}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
            Network Reach — Bosconet &amp; DB Tech
          </div>
          <div className="p-4">
            <div id="an-network">
              <AnalyticsBarChart rows={ANALYTICS_NETWORK_BAR_ROWS} />
            </div>
            <div className="mt-3.5 rounded-lg border-l-[3px] border-sdb-blue bg-sdb-blue-pale/90 p-3">
              <div className="text-[13px] font-bold text-sdb-blue-deep">Bosconet — 1.75 Million Lives / Year</div>
              <div className="mt-1 text-xs text-mid">
                350+ NGOs · 11 regional offices · 28 Indian states · Source: bosconet.in
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-1">
        <h4 className="mb-4 font-serif text-[17px] font-bold text-sdb-blue-deep">
          Province Deep Dive{' '}
          <span className="text-sm font-normal text-mid">— sourced from official provincial websites</span>
        </h4>
        <div id="province-cards-grid" className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {deepDiveProvinces.map((p) => (
            <button
              key={p.code}
              type="button"
              className="cursor-pointer rounded-xl border border-border-sdb bg-white text-left shadow-sm transition-shadow hover:shadow-md"
              onClick={() => showToast(`Opening: ${p.fullName} — ${p.url}`)}
            >
              <div
                className="flex flex-wrap items-start justify-between gap-2 border-b border-border-sdb px-4 py-2.5"
                style={{ borderLeftWidth: 4, borderLeftColor: p.color, paddingLeft: 14 }}
              >
                <span className="text-sm font-semibold text-sdb-blue-deep">
                  {p.code} · {p.fullName}
                </span>
                <a
                  href={`https://${p.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-semibold text-orange-text no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.url} ↗
                </a>
              </div>
              <div className="px-4 py-3">
                <div className="mb-2.5 text-xs text-mid">{p.state}</div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  {[
                    ['Members', p.members],
                    ['Houses', p.houses],
                    ['Schools', p.schools],
                    ['Colleges', p.colleges],
                  ].map(([lab, val]) => (
                    <div key={lab}>
                      <div className="text-base font-bold text-sdb-blue-deep">{val}</div>
                      <div className="text-[11px] text-mid">{lab}</div>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

const GOVERNANCE_AUDIT_LOG = [
  {
    dot: 'bg-emerald-600',
    tx: (
      <>
        User <strong>james.rodrigues@ins</strong> submitted RES-SUB-041 — Bronze Layer
      </>
    ),
    tm: '2026-03-02 08:14',
  },
  {
    dot: 'bg-sdb-blue',
    tx: <>AI Classifier tagged RES-SUB-041 with 4 taxonomy terms (conf: 94%)</>,
    tm: '2026-03-02 08:15',
  },
  {
    dot: 'bg-amber-500',
    tx: <>CristO–Religio sync: 23 institution records updated (South Asia)</>,
    tm: '2026-03-02 06:00',
  },
  {
    dot: 'bg-red-600',
    tx: <>Compliance alert raised: Region BGS score 74% (threshold: 80%)</>,
    tm: '2026-03-01 22:30',
  },
]

const GOVERNANCE_REGION_ROWS = [
  { name: 'South Asia', score: 94, status: 'approved' },
  { name: 'Europe', score: 88, status: 'approved' },
  { name: 'Latin America', score: 96, status: 'approved' },
  { name: 'Central Europe', score: 74, status: 'rejected' },
  { name: 'East Africa', score: 81, status: 'review' },
]

function governanceRegionBarBg(score) {
  return score >= 80
    ? 'linear-gradient(90deg, var(--color-sdb-blue, #0057A8), var(--color-sdb-blue-mid, #2272C3))'
    : 'linear-gradient(90deg, var(--color-danger, #DC2626), #E53E3E)'
}

function governanceStatusClass(st) {
  if (st === 'approved') return 'bg-emerald-100 font-bold text-emerald-900'
  if (st === 'rejected') return 'bg-red-100 font-bold text-red-900'
  return 'bg-blue-100 font-bold text-blue-900'
}

const ACCESS_MATRIX_MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'resources', label: 'Resources' },
  { id: 'collections', label: 'Collections' },
  { id: 'institutions', label: 'Pastoral Works' },
  { id: 'networks', label: 'Networks' },
  { id: 'events', label: 'Events' },
  { id: 'persons', label: 'Persons' },
  { id: 'ai', label: 'AI Assistant' },
  { id: 'owl', label: 'OWL Update' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'governance', label: 'Governance' },
  { id: 'access', label: 'Access Control' },
]

/** `roleId` string → `{ [moduleId]: boolean }` — checked means access granted for that module. */
function buildAccessMatrixFromRoles(roles) {
  const next = {}
  for (const r of roles) {
    const rid = String(r.id)
    let allowed
    if (Array.isArray(r.allowed_pages) && r.allowed_pages.length > 0) {
      allowed = new Set(r.allowed_pages)
    } else {
      const mapKey = dashboardRoleKeyFromRoleName(r.name)
      allowed = allowedPageIdsForRoleKey(mapKey)
    }
    next[rid] = {}
    for (const m of ACCESS_MATRIX_MODULES) {
      next[rid][m.id] = allowed.has(m.id)
    }
  }
  return next
}

function matrixRowToAllowedPages(row) {
  const ids = ACCESS_MATRIX_MODULES.filter((m) => row[m.id]).map((m) => m.id)
  const s = new Set(ids)
  if (!s.has('dashboard')) s.add('dashboard')
  return Array.from(s)
}

export function GovernanceView() {
  return (
    <main id="page-governance" className="min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader title="Governance & Policy" subtitle="Contribution policy · Audit logs · Data lineage" />
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div>
          <div className="mb-3.5 rounded-xl border border-border-sdb bg-white shadow-sm">
            <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
              Recent Audit Log
            </div>
            <div id="audit-log" className="px-4 pb-1 pt-0">
              {GOVERNANCE_AUDIT_LOG.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 border-b border-border-sdb py-2.5 last:border-b-0"
                >
                  <div className={`mt-1.5 size-[7px] shrink-0 rounded-full ${a.dot}`} />
                  <div className="min-w-0">
                    <div className="text-[13px] leading-snug text-ink">{a.tx}</div>
                    <div className="mt-0.5 text-[11px] text-mid">{a.tm}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
            <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
              Regional Submission Status
            </div>
            <div id="region-status" className="px-4 py-1">
              {GOVERNANCE_REGION_ROWS.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2.5 border-b border-border-sdb py-1.5 last:border-b-0"
                >
                  <div className="flex-1 text-[13px] font-medium text-ink">{p.name}</div>
                  <div className="min-w-0 flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-off-white">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p.score}%`, background: governanceRegionBarBg(p.score) }}
                      />
                    </div>
                  </div>
                  <div className="w-7 shrink-0 text-right text-xs font-bold text-mid">{p.score}%</div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] capitalize ${governanceStatusClass(p.status)}`}
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
          <div className="border-b border-border-sdb px-4 py-2.5 text-sm font-semibold text-sdb-blue-deep">
            Policy Compliance
          </div>
          <div id="compliance-panel" className="flex flex-col gap-2.5 p-4">
            <div className="rounded-lg border-l-[3px] border-sdb-blue bg-sdb-blue-pale/90 p-3">
              <div className="mb-1 text-[13px] font-bold text-sdb-blue-deep">✅ Approved submission methods</div>
              <div className="text-xs leading-relaxed text-slate-sdb">
                API integration · Secure upload portal · Cloud storage · Structured export · Subdomain API sync
              </div>
            </div>
            <div className="rounded-lg border-l-[3px] border-red-600 bg-red-50 p-3">
              <div className="mb-1 text-[13px] font-bold text-red-700">🚫 Prohibited methods</div>
              <div className="text-xs leading-relaxed text-red-950">
                No scraping · No unauthorized crawling · No bypassing access controls · No personal data without consent
              </div>
            </div>
            <div className="rounded-lg border-l-[3px] border-amber-600 bg-amber-50 p-3">
              <div className="mb-1 text-[13px] font-bold text-amber-800">🔐 Security & compliance</div>
              <div className="text-xs leading-relaxed text-slate-sdb">
                GDPR compliant · Role-based access · Full audit logs · Data lineage · 99.5% uptime SLA
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export function AccessView() {
  const [catalogRoles, setCatalogRoles] = useState([])
  const [matrix, setMatrix] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [saving, setSaving] = useState(false)

  async function refreshRoles() {
    const list = await fetchAuthRoles()
    if (!Array.isArray(list)) return
    const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id))
    setCatalogRoles(sorted)
    setMatrix(buildAccessMatrixFromRoles(sorted))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchAuthRoles()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return
        const sorted = [...list].sort((a, b) => Number(a.id) - Number(b.id))
        setCatalogRoles(sorted)
        setMatrix(buildAccessMatrixFromRoles(sorted))
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function persistRow(roleIdStr, nextRow) {
    const token = getSession()?.token
    const pages = matrixRowToAllowedPages(nextRow)
    setSaving(true)
    setSaveError(null)
    try {
      await updateRoleAllowedPages(Number(roleIdStr), pages, token)
      await refreshRoles()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      await refreshRoles()
    } finally {
      setSaving(false)
    }
  }

  async function onToggleModule(r, modId) {
    const rid = String(r.id)
    const prev = matrix[rid] || {}
    const nextRow = { ...prev, [modId]: !prev[modId] }
    setMatrix((p) => ({ ...p, [rid]: nextRow }))
    await persistRow(rid, nextRow)
  }

  async function resetToMappedDefaults() {
    const token = getSession()?.token
    setSaving(true)
    setSaveError(null)
    try {
      await Promise.all(catalogRoles.map((r) => clearRoleAllowedPagesOverride(r.id, token)))
      await refreshRoles()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <main id="page-access" className="relative min-h-0 flex-1 overflow-y-auto bg-off-white p-6">
      <SectionHeader
        title="Access Control"
        subtitle="Changes are saved to Databricks and apply the next time users with that role sign in."
      />
      <div className="rounded-xl border border-border-sdb bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-sdb px-4 py-2.5">
          <span className="text-sm font-semibold text-sdb-blue-deep">Role-based Access Matrix</span>
          {!loading && catalogRoles.length > 0 ? (
            <button
              type="button"
              disabled={saving}
              className="rounded-lg border border-border-sdb bg-off-white px-2.5 py-1 text-[11px] font-semibold text-sdb-blue-deep transition-colors hover:bg-sdb-blue-pale disabled:opacity-60"
              onClick={() => void resetToMappedDefaults()}
            >
              {saving ? 'Saving…' : 'Reset to name-based defaults'}
            </button>
          ) : null}
        </div>
        <div id="access-panel" className="p-4 text-xs text-mid">
          <p className="mb-3 text-[12px] leading-relaxed text-slate-sdb">
            Each <strong className="text-ink">checked</strong> box is stored on the role row and enforced at{' '}
            <strong className="text-ink">login</strong> via <code className="rounded bg-off-white px-1 text-[11px] text-ink">allowed_pages</code>.
            Dashboard must include <strong className="text-ink">Dashboard</strong> (added automatically if missing). Users
            must sign in again to pick up permission changes.
          </p>
          {saveError ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-900">
              {saveError}
            </div>
          ) : null}
          {loadError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-950">
              Could not load roles: {loadError}
            </div>
          ) : null}
          {loading ? (
            <div className="py-10 text-center text-sm text-mid">Loading roles…</div>
          ) : !catalogRoles.length ? (
            <div className="py-10 text-center text-sm text-mid">No roles returned from the API.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {catalogRoles.map((r) => {
                const rid = String(r.id)
                const mapKey = dashboardRoleKeyFromRoleName(r.name)
                const templateLabel = ROLE_DISPLAY[mapKey]?.label
                return (
                  <div
                    key={r.id}
                    className="flex flex-col items-stretch gap-2 border-b border-border-sdb py-2 last:border-b-0 sm:flex-row sm:items-start sm:gap-3.5"
                  >
                    <div className="w-full shrink-0 sm:w-[200px]">
                      <div className="text-[13px] font-semibold text-ink">{r.name}</div>
                      <div className="mt-0.5 text-[11px] text-mid">
                        UC id {r.id} · map <span className="font-mono text-ink">{mapKey}</span>
                        {templateLabel ? (
                          <>
                            {' '}
                            · <span className="text-slate-sdb">{templateLabel}</span>
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      {ACCESS_MATRIX_MODULES.map((m) => {
                        const inputId = `access-${r.id}-${m.id}`
                        const checked = !!matrix[rid]?.[m.id]
                        return (
                          <label
                            key={inputId}
                            htmlFor={inputId}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border-sdb bg-off-white px-2 py-0.5 text-[11px] font-medium text-ink hover:border-sdb-blue/40 has-checked:border-emerald-400 has-checked:bg-emerald-50 has-checked:text-emerald-950"
                          >
                            <input
                              id={inputId}
                              type="checkbox"
                              className="size-3.5 shrink-0 accent-sdb-blue"
                              checked={checked}
                              disabled={saving}
                              onChange={() => void onToggleModule(r, m.id)}
                              aria-label={`${r.name}: ${m.label}${checked ? ', enabled' : ', disabled'}`}
                            />
                            <span>{m.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
