import { ANALYTICS_PROVINCE_DATA } from '../data/analyticsProvinceData'
import { isBlockedHomeImage, isUsableDynamicSlideImage } from '../data/homeStaticImages'

/** Base URL for backend (e.g. `VITE_API_BASE_URL` in `.env.development`). */
export function apiBase() {
  const raw = import.meta.env.VITE_API_BASE_URL
  const s = raw === undefined || raw === null ? '' : String(raw).trim()
  if (s) return s.replace(/\/$/, '')
  return 'http://127.0.0.1:2005'
}

/** GSDP Semantic Search (Gradio) on the FastAPI backend. `__theme=light` avoids OS-dark Gradio skin. */
export function ragAssistantUrl() {
  const base = apiBase()
  try {
    const u = new URL(`${base}/rag`)
    u.searchParams.set('__theme', 'light')
    return u.toString()
  } catch {
    return `${base}/rag?__theme=light`
  }
}

// export function apiBase() {
//   const raw = import.meta.env.VITE_API_BASE_URL
//   const s = raw === undefined || raw === null ? '' : String(raw).trim()
//   if (s) return s.replace(/\/$/, '')
//   return 'https://gsdpapi.boscosofttech.com'
// }

// export function apiBase() {
//   const raw = import.meta.env.VITE_API_BASE_URL
//   const s = raw === undefined || raw === null ? '' : String(raw).trim()
//   if (s) return s.replace(/\/$/, '')
//   return 'http://3.111.23.138:2005'
// }

// export function apiBase() {
//   const raw = import.meta.env.VITE_API_BASE_URL
//   const s = raw === undefined || raw === null ? '' : String(raw).trim()
//   if (s) return s.replace(/\/$/, '')
//   return 'https://meredith-metabolic-staidly.ngrok-free.dev'
// }


// export function apiBase() {
//   const raw = import.meta.env.VITE_API_BASE_URL
//   const s = raw === undefined || raw === null ? '' : String(raw).trim()
//   if (s) return s.replace(/\/$/, '')
//   return 'https://gsdp-7474649503171619.aws.databricksapps.com'
// }


/** Merge fetch init so ngrok-free tunnels skip the browser interstitial (that HTML has no CORS headers). */
function mergeApiFetchInit(init) {
  const base = init && typeof init === 'object' ? { ...init } : {}
  const headers = new Headers(base.headers)
  if (/ngrok-free\.dev|\.ngrok\.io|\.ngrok\.app/i.test(apiBase())) {
    if (!headers.has('ngrok-skip-browser-warning')) {
      headers.set('ngrok-skip-browser-warning', 'true')
    }
  }
  base.headers = headers
  return base
}

export function apiFetch(input, init) {
  return fetch(input, mergeApiFetchInit(init))
}

/**
 * @param {Record<string, string | number | undefined>} filters
 */
function appendVectorDbFilterParams(params, filters = {}) {
  const map = {
    knowledge_area: filters.knowledge_area,
    work_type: filters.work_type,
    language: filters.language,
    country: filters.country,
    region: filters.region,
    reference_year: filters.reference_year,
    publication_year: filters.publication_year,
    salesian_family_group: filters.salesian_family_group,
    contributor: filters.contributor,
    doc_media: filters.doc_media,
  }
  for (const [key, val] of Object.entries(map)) {
    if (val == null || val === '') continue
    params.set(key, String(val))
  }
}

/**
 * Facet values for Resource Library filters (GET /data/vector-db-input/facets).
 */
export async function fetchVectorDbInputFacets() {
  const url = `${apiBase()}/data/vector-db-input/facets`
  const res = await apiFetch(url)
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try {
      const j = JSON.parse(text)
      detail = j.detail ?? text
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

/**
 * Paginated rows from `gsdp.gold.vector_db_input` (GET /data/vector-db-input).
 * @param {{ limit?: number, offset?: number, q?: string, filters?: Record<string, string|number|undefined> }} opts
 */
export async function fetchVectorDbInputRows({ limit = 80, offset = 0, q = '', filters = {} } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (q.trim()) params.set('q', q.trim())
  appendVectorDbFilterParams(params, filters)
  const url = `${apiBase()}/data/vector-db-input?${params.toString()}`
  const res = await apiFetch(url)
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try {
      const j = JSON.parse(text)
      detail = j.detail ?? text
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

/**
 * Canonical filter labels aligned with vector_db_input column names (knowledge_area, work_type, …).
 */
export const CORPUS_FILTER_LABELS = {
  knowledge_area: {
    all: 'All knowledge areas',
    loading: 'Loading knowledge areas…',
    aria: 'Knowledge area',
    facetKey: 'themes',
  },
  work_type: {
    all: 'All work types',
    loading: 'Loading work types…',
    aria: 'Work type',
    facetKey: 'types',
  },
  country: {
    all: 'All countries',
    loading: 'Loading countries…',
    aria: 'Country',
    facetKey: 'countries',
  },
  region: {
    all: 'All regions',
    loading: 'Loading regions…',
    aria: 'Region',
    facetKey: 'continents',
  },
  language: {
    all: 'All languages',
    loading: 'Loading languages…',
    aria: 'Language',
    facetKey: 'languages',
  },
  reference_year: {
    all: 'All reference years',
    loading: 'Loading reference years…',
    aria: 'Reference year',
    facetKey: 'years',
  },
  publication_year: {
    all: 'All publication years',
    loading: 'Loading publication years…',
    aria: 'Publication year',
    facetKey: 'publication_years',
  },
  salesian_family_group: {
    all: 'All groups',
    loading: 'Loading groups…',
    aria: 'Salesian family group',
    facetKey: 'groups',
  },
  contributor: {
    all: 'All contributors',
    loading: 'Loading contributors…',
    aria: 'Contributor',
    facetKey: 'contributors',
  },
  doc_media: {
    all: 'All attachments',
    loading: 'Loading attachments…',
    aria: 'Attachment type',
    facetKey: null,
  },
}

/** @param {keyof typeof CORPUS_FILTER_LABELS} fieldKey */
export function corpusFilterAllLabel(fieldKey, pending = false) {
  const d = CORPUS_FILTER_LABELS[fieldKey]
  if (!d) return pending ? 'Loading…' : 'All'
  return pending ? d.loading : d.all
}

/** @param {keyof typeof CORPUS_FILTER_LABELS} fieldKey */
export function corpusFilterAriaLabel(fieldKey) {
  return CORPUS_FILTER_LABELS[fieldKey]?.aria || fieldKey
}

/** Facet array key on GET /data/vector-db-input/facets for a corpus column. */
export function corpusFilterFacetKey(fieldKey) {
  return CORPUS_FILTER_LABELS[fieldKey]?.facetKey ?? null
}

/**
 * Facet list for Resource Library dropdowns: API values when live, static sample when offline.
 * @returns {string[] | null} `null` while facets are loading (live mode only).
 */
export function resourceFacetValues(facetOptions, key, staticFallback, useStaticFallback) {
  if (useStaticFallback) {
    return Array.isArray(staticFallback) ? staticFallback.filter(Boolean) : []
  }
  if (!facetOptions || typeof facetOptions !== 'object') return null
  const list = facetOptions[key]
  return Array.isArray(list) ? list.filter((v) => v != null && String(v).trim() !== '') : []
}

/**
 * Map gsdp.gold.vector_db_input columns → shape expected by resource/home/dashboard builders.
 */
export function mapVectorDbRowToOntologyShape(row) {
  if (!row || typeof row !== 'object') return row
  const pubYear = row.publication_year
  const yearStr = pubYear != null && pubYear !== '' ? String(pubYear) : ''
  const dateFromYear = yearStr.length >= 4 ? `${yearStr.slice(0, 4)}-01-01` : ''
  return {
    ...row,
    title: row.title,
    subject: row.subject,
    name: row.title,
    description: row.abstract,
    summary: row.abstract,
    excerpt: row.abstract,
    author: row.contributor,
    authors: row.contributor,
    contributors: row.contributor,
    url: row.url,
    file_name: row.file_name,
    work_type: row.work_type,
    type: row.work_type,
    publication_type: row.work_type,
    source_category: row.content_classification,
    knowledge_area: row.knowledge_area,
    languages: row.language,
    language: row.language,
    province_region: row.country,
    country: row.country,
    inferred_continent: row.inferred_continent,
    salesian_family_group: row.salesian_family_group,
    document_id: row.document_id,
    vector_id: row.vector_id,
    created_at: row.created_at,
    ingestion_time: row.created_at,
    updated_at: row.created_at,
    publish_date: dateFromYear,
    date_published: dateFromYear,
    date_created: dateFromYear,
    publication_year: row.publication_year,
    keywords: row.subject,
    tags: row.knowledge_area || row.subject,
    _corpus: 'vector_db_input',
  }
}

/** Primary catalog fetch for homepage, dashboard, and resource library (vector DB input table). */
export async function fetchOntologyRows({ limit = 80, offset = 0, q = '', filters = {} } = {}) {
  const block = await fetchVectorDbInputRows({ limit, offset, q, filters })
  const data = (block.data || []).map(mapVectorDbRowToOntologyShape)
  return { ...block, data }
}

const LANGUAGE_ALIASES = {
  en: 'English',
  eng: 'English',
  english: 'English',
  it: 'Italian',
  ita: 'Italian',
  italian: 'Italian',
  es: 'Spanish',
  spa: 'Spanish',
  spanish: 'Spanish',
  fr: 'French',
  fre: 'French',
  french: 'French',
  pt: 'Portuguese',
  por: 'Portuguese',
  portuguese: 'Portuguese',
  de: 'German',
  ger: 'German',
  german: 'German',
  ta: 'Tamil',
  tam: 'Tamil',
  tamil: 'Tamil',
  te: 'Telugu',
  tel: 'Telugu',
  telugu: 'Telugu',
  hi: 'Hindi',
  hin: 'Hindi',
  hindi: 'Hindi',
  la: 'Latin',
  lat: 'Latin',
  latin: 'Latin',
  ar: 'Arabic',
  ara: 'Arabic',
  arabic: 'Arabic',
  zh: 'Chinese',
  chi: 'Chinese',
  chinese: 'Chinese',
  ml: 'Malayalam',
  mal: 'Malayalam',
  malayalam: 'Malayalam',
  kn: 'Kannada',
  kan: 'Kannada',
  kannada: 'Kannada',
}

let languageDisplayNames
try {
  languageDisplayNames = new Intl.DisplayNames(['en'], { type: 'language' })
} catch {
  languageDisplayNames = null
}

function formatOneLanguageToken(token) {
  const t = String(token ?? '').trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  if (LANGUAGE_ALIASES[lower]) return LANGUAGE_ALIASES[lower]
  if (/^[a-z]{2,3}$/i.test(t) && languageDisplayNames) {
    try {
      const name = languageDisplayNames.of(lower)
      if (name && name.toLowerCase() !== lower) return name
    } catch {
      /* ignore */
    }
  }
  if (LANGUAGE_ALIASES[lower]) return LANGUAGE_ALIASES[lower]
  if (t.length <= 3 && /^[a-z]+$/i.test(t)) return t.toUpperCase()
  return t.replace(/\b[\w']+\b/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** "EN" / "en, it" → "English" / "English, Italian" for UI labels. */
export function formatLanguageDisplay(raw) {
  if (raw == null || raw === '') return '—'
  const s = String(raw).trim()
  if (!s || s === '—') return '—'
  const parts = s
    .split(/[,;|/]/)
    .map((p) => formatOneLanguageToken(p.trim()))
    .filter(Boolean)
  return parts.length ? parts.join(', ') : '—'
}

/**
 * Filter dropdown options: `value` = stored corpus code (for API), `label` = full language name.
 */
export function languageSelectOptions(rawLanguages) {
  const list = Array.isArray(rawLanguages) ? rawLanguages : []
  const seen = new Set()
  const out = []
  for (const raw of list) {
    const value = String(raw ?? '').trim()
    if (!value || seen.has(value.toLowerCase())) continue
    seen.add(value.toLowerCase())
    out.push({ value, label: formatLanguageDisplay(value) })
  }
  out.sort((a, b) => a.label.localeCompare(b.label))
  return out
}

/** Parse a corpus year column to integer or null. */
export function parseCorpusYearInt(val) {
  if (val == null || val === '') return null
  const n = parseInt(String(val).trim(), 10)
  return Number.isFinite(n) && n >= 0 && n <= 9999 ? n : null
}

/** Reference period label from reference_start_year / reference_end_year only. */
export function formatResourceReferencePeriod(row) {
  if (!row || typeof row !== 'object') return null
  const start =
    parseCorpusYearInt(row.reference_start_year) ?? parseCorpusYearInt(row.referenceStartYear)
  const end = parseCorpusYearInt(row.reference_end_year) ?? parseCorpusYearInt(row.referenceEndYear)
  if (start != null && end != null) {
    return start === end ? String(start) : `${start}–${end}`
  }
  if (start != null) return String(start)
  if (end != null) return String(end)
  return null
}

/** Published year label from publication_year. */
export function formatResourcePublishedYear(row) {
  if (!row || typeof row !== 'object') return null
  const pub =
    parseCorpusYearInt(row.publication_year) ?? parseCorpusYearInt(row.publishedYear)
  return pub != null ? String(pub) : null
}

/** Combined year line for cards: reference period and publication year when both exist. */
export function formatResourceYearSummary(row) {
  if (!row || typeof row !== 'object') return '—'
  const ref = formatResourceReferencePeriod(row)
  const pub = formatResourcePublishedYear(row)
  if (ref && pub) {
    if (ref === pub || ref.includes(pub)) return ref
    return `${ref} · Pub. ${pub}`
  }
  if (ref) return ref
  if (pub) return pub
  const yRaw = row.date_published || row.publish_date || row.date_created || row.created_at || ''
  if (typeof yRaw === 'string' && yRaw.length >= 4) return yRaw.slice(0, 4)
  if (yRaw != null && yRaw !== '') return String(yRaw).slice(0, 4)
  return '—'
}

/** @deprecated Use formatResourceYearSummary */
export function formatResourceReferenceYears(row) {
  return formatResourceYearSummary(row)
}

/** True when filter year falls within the row's reference period (inclusive). */
export function resourceMatchesReferenceYear(row, filterYear) {
  const y = parseCorpusYearInt(filterYear)
  if (y == null) return true
  const start =
    parseCorpusYearInt(row?.reference_start_year) ?? parseCorpusYearInt(row?.referenceStartYear)
  const end =
    parseCorpusYearInt(row?.reference_end_year) ?? parseCorpusYearInt(row?.referenceEndYear)
  if (start == null && end == null) return false
  const lo = Math.min(start ?? y, end ?? y)
  const hi = Math.max(start ?? y, end ?? y)
  return y >= lo && y <= hi
}

/** True when filter year equals the row's publication_year. */
export function resourceMatchesPublicationYear(row, filterYear) {
  const y = parseCorpusYearInt(filterYear)
  if (y == null) return true
  const pub =
    parseCorpusYearInt(row?.publication_year) ?? parseCorpusYearInt(row?.publishedYear)
  return pub != null && pub === y
}

/** Map Resource Library UI filter state → vector-db-input API query params. */
export function resourceFiltersToApiParams(f) {
  if (!f) return {}
  const refYear = f.year != null && String(f.year).trim() !== '' ? parseInt(String(f.year), 10) : undefined
  const pubYear =
    f.pubYear != null && String(f.pubYear).trim() !== '' ? parseInt(String(f.pubYear), 10) : undefined
  return {
    knowledge_area: f.theme || undefined,
    work_type: f.type || undefined,
    country: f.province || undefined,
    region: f.region || undefined,
    language: f.lang || undefined,
    reference_year: Number.isFinite(refYear) ? refYear : undefined,
    publication_year: Number.isFinite(pubYear) ? pubYear : undefined,
    salesian_family_group: f.group || undefined,
    contributor: f.author || undefined,
    doc_media: f.docMedia || undefined,
  }
}

/**
 * Paginated rows from `salesianonline.silver.final` (backend: GET /data/salesianonline/final).
 * @param {{ limit?: number, offset?: number, q?: string }} opts
 */
export async function fetchSalesianonlineFinalRows({ limit = 100, offset = 0, q = '' } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (q.trim()) params.set('q', q.trim())
  const url = `${apiBase()}/data/salesianonline/final?${params.toString()}`
  const res = await apiFetch(url)
  if (!res.ok) {
    const text = await res.text()
    let detail = text
    try {
      const j = JSON.parse(text)
      detail = j.detail ?? text
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return res.json()
}

const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

/** True when a string looks like an ISO / warehouse timestamp. */
export function isIsoDateTimeString(value) {
  const s = String(value ?? '').trim()
  if (!s) return false
  return ISO_DATETIME_RE.test(s) || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)
}

/**
 * Human-readable date/time (e.g. `2026-05-21T11:13:22.838071+00:00` → `21 May 2026, 11:13`).
 * @param {unknown} value
 * @param {{ withTime?: boolean }} [opts]
 */
export function formatDateTimeDisplay(value, { withTime = true } = {}) {
  if (value == null || value === '') return ''
  const s = String(value).trim()
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  if (withTime) {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Format cell / field values; timestamps are converted to locale date-time. */
export function formatDisplayValue(v) {
  if (v == null || v === '') return null
  if (Array.isArray(v)) {
    const s = v.map((x) => formatDisplayValue(x) || String(x)).filter(Boolean).join(', ')
    return s || null
  }
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v).slice(0, 200)
    } catch {
      return String(v)
    }
  }
  const s = String(v).trim()
  if (isIsoDateTimeString(s)) return formatDateTimeDisplay(s)
  return s
}

/** @param {unknown} v */
export function formatOntologyCellForDisplay(v) {
  return formatDisplayValue(v)
}

/** Best thumbnail URL for a `salesianonline.silver.final` row. */
export function pickSalesianonlineThumbnailUrl(row) {
  if (!row || typeof row !== 'object') return null
  const keys = [
    'image_thumbnail_url',
    'image_medium_url',
    'image_large_url',
    'image_full_url',
  ]
  for (const k of keys) {
    const u = row[k]
    if (u && String(u).trim().startsWith('http')) return String(u).trim()
  }
  return null
}

/** Primary link to open (media or post). */
export function pickSalesianonlineOpenUrl(row) {
  if (!row || typeof row !== 'object') return null
  const keys = [
    'link',
    'source_url',
    'image_large_url',
    'image_full_url',
    'image_medium_url',
    'extracted_url',
    'parent_post_link',
    'image_thumbnail_url',
  ]
  for (const k of keys) {
    const u = row[k]
    if (u && String(u).trim().startsWith('http')) return String(u).trim()
  }
  return null
}

// export async function fetchOntologyRows({ limit = 700, offset = 0, q = '' } = {}) {
//   const params = new URLSearchParams()
//   params.set('limit', String(700))
//   params.set('offset', String(offset))
//   if (q.trim()) params.set('q', q.trim())
//   const url = `${apiBase()}/data/ontology/mapped-value-deduplicated?${params.toString()}`
//   const res = await apiFetch(url)
//   if (!res.ok) {
//     const text = await res.text()
//     let detail = text
//     try {
//       const j = JSON.parse(text)
//       detail = j.detail ?? text
//     } catch {
//       /* ignore */
//     }
//     throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
//   }
//   return res.json()
// }

//This is the ontology mapped for fetching resources from the ontology table

// export async function fetchOntologyRows({ limit = 80, offset = 0, q = '' } = {}) {
//   const params = new URLSearchParams()
//   params.set('limit', String(limit))
//   params.set('offset', String(offset))
//   if (q.trim()) params.set('q', q.trim())
//   const url = `${apiBase()}/data/resources?${params.toString()}`
//   const res = await apiFetch(url)
//   if (!res.ok) {
//     const text = await res.text()
//     let detail = text
//     try {
//       const j = JSON.parse(text)
//       detail = j.detail ?? text
//     } catch {
//       /* ignore */
//     }
//     throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
//   }
//   return res.json()
// }

function tryAbsoluteUrl(raw) {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith('//')) return `https:${s}`
  return null
}

/** First usable http(s) URL from bronze row fields (PDF, image, or attachment JSON). */
export function pickDocumentUrlFromOntologyRow(row) {
  if (!row || typeof row !== 'object') return null
  const directKeys = ['url', 'old_link', 'path', 'attachment', 'image', 'feature_image', 'hasLinkedMedia', 'hasPhoto']

  for (const key of directKeys) {
    const u = tryAbsoluteUrl(row[key])
    if (u) return u
    const raw = row[key]
    if (raw && typeof raw === 'string') {
      const t = raw.trim()
      if ((t.startsWith('{') || t.startsWith('[')) && t.length < 500000) {
        try {
          const j = JSON.parse(t)
          const nested = j?.url || j?.href || j?.src || j?.path || j?.file
          const u2 = tryAbsoluteUrl(nested)
          if (u2) return u2
        } catch {
          /* not JSON */
        }
      }
    }
  }
  return null
}

/** Resolved document URL for a resource card (API-mapped or static). */
export function resourceDocumentUrl(resource) {
  if (!resource) return null
  return tryAbsoluteUrl(resource.docUrl) || tryAbsoluteUrl(resource._url)
}

/**
 * Classify attached document as PDF, image, or unknown — uses URL path and bronze mime hints.
 * @returns {'pdf' | 'image' | 'none'}
 */
export function inferDocumentKindFromOntology(docUrl, row) {
  const ff = String(row?.file_format || row?.hasFileFormat || '').toLowerCase()
  const mt = String(row?.media_type || '').toLowerCase()
  const tp = String(row?.type || row?.work_type || '').toLowerCase()
  const fn = String(row?.file_name || '').toLowerCase()
  if (/\.(jpe?g|png|gif|webp|svg|bmp|avif|tiff?)$/i.test(fn)) return 'image'
  const blob = `${ff} ${mt} ${tp} ${fn}`
  if (blob.includes('pdf') || tp === 'application/pdf') return 'pdf'
  if (
    mt.startsWith('image/') ||
    /\b(jpe?g|png|gif|webp|svg|bmp|tiff?|bitmap)\b/.test(blob) ||
    tp.startsWith('image/')
  ) {
    return 'image'
  }

  if (!docUrl) return 'none'
  const path = docUrl.split(/[?#]/)[0].toLowerCase()
  if (path.includes('.pdf') || /[^/]\.pdf$/i.test(path)) return 'pdf'
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|tiff?)(?:$|[?#])/i.test(path)) return 'image'
  return 'none'
}

/** True when ontology row is classified as a PDF (metadata and/or URL). */
export function isOntologyRowPdf(row) {
  if (!row || typeof row !== 'object') return false
  const docUrl = pickDocumentUrlFromOntologyRow(row)
  return inferDocumentKindFromOntology(docUrl, row) === 'pdf'
}

/**
 * Recent-resource cards: newest PDF rows only (by ingestion / publish / created dates).
 * Returns objects shaped by {@link mapOntologyRowToResource}.
 */
export function buildRecentPdfResourcesFromOntologyRows(rows, { limit = 4 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []

  const dated = rows
    .filter((row) => isOntologyRowPdf(row))
    .map((row) => {
      const raw = row.ingestion_time || row.updated_at || row.publish_date || row.date_created || row.created_at || ''
      const t = new Date(raw).getTime()
      return { row, t: Number.isFinite(t) ? t : 0 }
    })
    .sort((a, b) => b.t - a.t)

  return dated.slice(0, limit).map((x, i) => {
    const r = mapOntologyRowToResource(x.row, i)
    const thumb = resolveHomePanelThumb(x.row, i)
    return { ...r, thumb: thumb.url, thumbPos: thumb.pos, thumbAlt: thumb.alt || r.title }
  })
}

/** Thumbnail for trending / resource cards — corpus only (not hero slider art). */
export function resolveHomePanelThumb(row, _index = 0) {
  const url =
    pickSalesianonlineThumbnailUrl(row) || pickHeroSlideImageUrl(row) || null
  const title = row?.title || row?.name || ''
  return {
    url: url || '',
    pos: 'center center',
    alt: typeof title === 'string' ? title : '',
  }
}

/** Kind for filter + display (uses docKind from API map when present). */
export function resourceDocumentKind(resource) {
  if (!resource) return 'none'
  if (resource.docKind === 'pdf' || resource.docKind === 'image') return resource.docKind
  return inferDocumentKindFromOntology(resourceDocumentUrl(resource), {
    file_format: resource.fileFormat,
    media_type: resource.mediaType,
    type: resource.type,
  })
}

/** Bronze often stores JSON arrays or placeholder enums — normalize for card text. */
export function coerceOntologyString(val) {
  if (val == null) return ''
  function deep(x) {
    if (x == null) return ''
    if (typeof x === 'string') return x.trim()
    if (typeof x !== 'object') return String(x).trim()
    if (Array.isArray(x)) return x.map(deep).filter(Boolean).join(', ')
    const keys = ['name', 'title', 'label', 'value', 'text', 'display_name']
    for (const k of keys) { if (x[k] && typeof x[k] === 'string') return x[k].trim(); }
    const fs = Object.values(x).find(v => typeof v === 'string')
    return fs ? fs.trim() : ''
  }
  const s = String(val).trim()
  if (!s || s === '[]' || s === '{}' || s.toLowerCase() === 'null') return ''
  if ((s.startsWith('[') || s.startsWith('{')) && s.length < 100000) {
    try {
      const j = JSON.parse(s)
      return deep(j)
    } catch { }
  }
  return s
}

function isPlaceholderTypeLabel(s) {
  const t = coerceOntologyString(s)
  if (!t) return true
  if (/^without\s+document\s+type$/i.test(t)) return true
  if (/^without\s+.+type$/i.test(t)) return true
  if (/^(unknown|n\/a|na|not\s+available|null|none|undefined|undetermined|tbd|[-–—]|\?+)$/i.test(t)) return true
  return false
}

function humanizeSourceTableLabel(s) {
  const raw = coerceOntologyString(s)
  if (!raw) return ''
  return raw
    .replace(/^[a-z0-9_]+\.bronze\.|^bronze\./i, '')
    .split(/[./]+/)
    .filter(Boolean)
    .map((w) =>
      w
        .split('_')
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' '),
    )
    .join(' · ')
    .slice(0, 72)
}

/**
 * Card badge line: skip warehouse placeholders like "WITHOUT DOCUMENT TYPE" and prefer real taxonomy.
 */
function resolveResourceCardType(row, docKind) {
  const pick = (v) => {
    const t = coerceOntologyString(v)
    return t && !isPlaceholderTypeLabel(t) ? t : ''
  }

  const ordered = [
    pick(row.publication_type),
    pick(row.source_category),
    pick(row.file_format),
    pick(row.media_type),
    pick(row.lifecycle_stage),
    pick(row.doc_status),
    pick(row.distribution_channel),
    pick(row.editor_type),
    pick(row.type),
  ]
  const first = ordered.find(Boolean)
  if (first) {
    const fl = first.toLowerCase()
    if (fl.startsWith('image/')) return 'Image'
    if (fl.startsWith('video/')) return 'Video'
    if (fl.startsWith('audio/')) return 'Audio'
    if (fl === 'application/pdf' || fl === 'pdf') return 'PDF'
    return first
  }

  if (docKind === 'pdf') return 'PDF'
  if (docKind === 'image') return 'Image'

  const tp = String(row.type || '').toLowerCase()
  if (tp.startsWith('video/')) return 'Video'
  if (tp.startsWith('audio/')) return 'Audio'
  if (tp.includes('video') || tp.includes('documentary')) return 'Video'

  const thematic = pick(row.knowledge_area) || pick(row.ministry) || pick(row.charism_dimension)
  if (thematic) return thematic

  const ttl = `${row.title || ''} ${row.name || ''}`.toLowerCase()
  if (ttl.includes('documentary') || ttl.includes('documentaries')) return 'Video'

  const src = pick(row._source_table) || pick(row.source_table_name)
  if (src) return humanizeSourceTableLabel(src) || 'Resource'

  return 'Resource'
}

/** Corpus totals and freshness from gsdp.gold.vector_db_input (full-table aggregates). */
export async function fetchOntologySummary() {
  const url = `${apiBase()}/data/vector-db-input/summary`
  try {
    const res = await apiFetch(url)
    if (res.ok) {
      const body = await res.json()
      return {
        status: 'success',
        total_rows: Number(body.total_rows) || 0,
        last_ingestion: body.last_ingestion ?? null,
        last_updated: body.last_ingestion ?? body.last_updated ?? null,
        distinct_countries: Number(body.distinct_countries) || 0,
        distinct_publication_types: Number(body.distinct_work_types) || 0,
        distinct_knowledge_areas: Number(body.distinct_knowledge_areas) || 0,
        distinct_languages: Number(body.distinct_languages) || 0,
      }
    }
  } catch {
    /* fall through */
  }

  const block = await fetchVectorDbInputRows({ limit: 200, offset: 0 })
  let lastIngestion = null
  const types = new Set()
  const areas = new Set()
  const countries = new Set()
  for (const row of block.data || []) {
    const raw = row.created_at
    if (raw) {
      const t = new Date(raw).getTime()
      if (Number.isFinite(t) && (!lastIngestion || t > new Date(lastIngestion).getTime())) {
        lastIngestion = raw
      }
    }
    const wt = coerceOntologyString(row.work_type)
    const ka = coerceOntologyString(row.knowledge_area)
    const c = coerceOntologyString(row.country)
    if (wt) types.add(wt)
    if (ka) areas.add(ka)
    if (c) countries.add(c.toLowerCase())
  }
  return {
    status: 'success',
    total_rows: typeof block.total === 'number' ? block.total : 0,
    last_ingestion: lastIngestion,
    last_updated: lastIngestion,
    distinct_countries: countries.size,
    distinct_publication_types: types.size,
    distinct_knowledge_areas: areas.size,
    distinct_languages: 0,
  }
}

/** Homepage stat display: loading ellipsis, otherwise locale number or "0". */
export function formatHomeStatCount(value, loading = false) {
  if (loading) return '…'
  const n = Number(value)
  return Number.isFinite(n) ? n.toLocaleString() : '0'
}

/** Live KPI counts derived from vector corpus rows + summary. */
export function buildPublicHomeStats(rows, { catalogTotal = 0, summary = null } = {}) {
  const list = Array.isArray(rows) ? rows : []
  const countries = new Set()
  const languages = new Set()
  for (const row of list) {
    const c = coerceOntologyString(row.country || row.province_region)
    const lang = coerceOntologyString(row.language || row.languages)
    if (c) countries.add(c)
    if (lang) languages.add(lang)
  }
  const resources =
    typeof catalogTotal === 'number' && Number.isFinite(catalogTotal) ? catalogTotal : 0
  return {
    resources,
    nations: countries.size,
    languages: languages.size,
    publicationTypes:
      typeof summary?.distinct_publication_types === 'number'
        ? summary.distinct_publication_types
        : 0,
    knowledgeAreas:
      typeof summary?.distinct_knowledge_areas === 'number' ? summary.distinct_knowledge_areas : 0,
  }
}

const HOME_DIST_BAR_CLS = ['a', 'b', 'c', 'd', 'e', 'a']

/** Institution-style breakdown by work_type / category from corpus rows. */
export function buildDistributionFromOntologyRows(rows, { limit = 6 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const counts = new Map()
  for (const row of rows) {
    const lbl =
      coerceOntologyString(row.work_type) ||
      coerceOntologyString(row.publication_type) ||
      coerceOntologyString(row.source_category) ||
      'Other'
    counts.set(lbl, (counts.get(lbl) || 0) + 1)
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
  if (!sorted.length) return []
  const max = sorted[0][1] || 1
  return sorted.map(([lbl, num], i) => ({
    lbl: lbl.length > 28 ? `${lbl.slice(0, 26)}…` : lbl,
    num,
    pct: `${Math.max(0, Math.round((num / max) * 100))}%`,
    cls: HOME_DIST_BAR_CLS[i % HOME_DIST_BAR_CLS.length],
  }))
}

/**
 * Fix known display-title glitches from source data (e.g. leading "Sacred" truncated to "ed").
 */
export function normalizeOntologyDisplayTitle(raw) {
  const t = String(raw ?? '').trim()
  if (!t) return t
  if (/^ed Heart College\b/i.test(t)) return t.replace(/^ed Heart College/i, 'Sacred Heart College')
  if (/^ed Heart\b/i.test(t)) return t.replace(/^ed Heart/i, 'Sacred Heart')
  return t
}

/**
 * Map a row from ontology.bronze.final_table_ontology to Resource Library card shape.
 */
export function mapOntologyRowToResource(row, index) {
  const title = normalizeOntologyDisplayTitle(
    row.title || row.hasTitle || row.name || row.subject || row.slug || 'Untitled',
  )
  const author =
    coerceOntologyString(row.author) ||
    coerceOntologyString(row.authors) ||
    coerceOntologyString(row.contributors) ||
    (row.contacts ? coerceOntologyString(row.contacts).slice(0, 120) : '') ||
    '—'
  const publisher = coerceOntologyString(row.publisher)
  const area = coerceOntologyString(row.knowledge_area || row.ministry || row.charism_dimension || row.source_category) || ''
  const docUrl = pickDocumentUrlFromOntologyRow(row)
  const docKind = inferDocumentKindFromOntology(docUrl, row)
  const type = resolveResourceCardType(row, docKind)
  const langRaw =
    coerceOntologyString(row.language || row.languages || row.translation_available) || ''
  const lang = langRaw ? formatLanguageDisplay(langRaw) : '—'
  const province =
    coerceOntologyString(row.country || row.province_region) || ''
  const region =
    coerceOntologyString(row.inferred_continent) ||
    inferDashboardRegionFromText(`${province} ${row.diocese || ''}`) ||
    ''
  const referencePeriod = formatResourceReferencePeriod(row)
  const publishedYear = formatResourcePublishedYear(row)
  const year = formatResourceYearSummary(row)
  const referenceStartYear = parseCorpusYearInt(row.reference_start_year)
  const referenceEndYear = parseCorpusYearInt(row.reference_end_year)
  const publishedYearInt = parseCorpusYearInt(row.publication_year)
  const desc = row.description || row.summary || row.excerpt || row.caption || ''
  const access = String(row.access_level || '').toLowerCase().includes('open') ? 'open' : 'restricted'
  const group = row.salesian_family_group || row.audience || ''

  let tags = []
  const rawTags = row.tags || row.keywords
  if (rawTags) {
    const s = String(rawTags).trim()
    if (s.startsWith('[') || s.startsWith('{')) {
      try {
        const j = JSON.parse(s)
        if (Array.isArray(j)) tags = j.map(String).filter(Boolean)
        else if (j && typeof j === 'object') tags = Object.values(j).map(String).filter(Boolean)
      } catch {
        tags = s.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
      }
    } else {
      tags = s.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
    }
  }
  if (!tags.length && province) tags = [String(province)]
  if (!tags.length && area) tags = [String(area)]

  const id =
    row.document_id != null && String(row.document_id)
      ? `doc-${row.document_id}`
      : row.uuid
        ? `uuid-${row.uuid}`
        : row.id != null
          ? `id-${row.id}`
          : `row-${index}`

  const tLower = String(type).toLowerCase()
  let badge = 'badge-doc'
  let icon = '📋'
  if (tLower.includes('pdf') || tLower.includes('publication')) {
    badge = 'badge-pdf'
    icon = '📄'
  } else if (tLower.includes('video') || tLower.includes('documentary') || tLower.includes('film')) {
    badge = 'badge-study'
    icon = '🎬'
  } else if (tLower.includes('image') || tLower.includes('photo') || tLower.includes('jpeg') || tLower.includes('png')) {
    badge = 'badge-doc'
    icon = '🖼'
  } else if (tLower.includes('study') || tLower.includes('report')) {
    badge = 'badge-study'
    icon = '📖'
  } else if (tLower.includes('marc')) {
    badge = 'badge-marc'
    icon = '🏷'
  }

  const coverGradients = [
    'linear-gradient(135deg,#003559,#004A99)',
    'linear-gradient(135deg,#B86218,#E67E22)',
    'linear-gradient(135deg,#1A6B3C,#2D9B5A)',
    'linear-gradient(135deg,#5B21B6,#7C3AED)',
  ]
  const cover = coverGradients[Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % coverGradients.length]

  return {
    id,
    cover,
    publisher,
    title,
    author,
    type,
    badge,
    icon,
    area,
    lang: lang || '—',
    region,
    year: year || '—',
    referencePeriod: referencePeriod || null,
    publishedYear: publishedYear || null,
    referenceStartYear,
    referenceEndYear,
    publishedYearInt,
    province,
    tags: tags.slice(0, 12),
    group,
    desc,
    access,
    _source: row._source_table || row.source_table_name,
    _url: row.url || null,
    docUrl,
    docKind,
    fileFormat: row.file_format || row.hasFileFormat,
    mediaType: row.media_type || row.hasFileFormat, // Using hasFileFormat as fallback if media_type is missing
    // New Columns from resource_final_excel_driven
    locatedIn: row.LocatedIn,
    address: row.address,
    belongsToProvince: row.belongsToProvince,
    dateCreated: row.dateCreated || row.created_at,
    dateLastUpdated: row.dateLastUpdated || row.updated_at,
    datePublished: row.datePublished || row.publish_date,
    distributedThrough: row.distributedThrough,
    hasAccessLevel: row.hasAccessLevel,
    hasApprovalStatus: row.hasApprovalStatus,
    hasAudience: row.hasAudience,
    hasContentClassification: row.hasContentClassification,
    hasDocumentID: row.hasDocumentID,
    hasDocumentStatus: row.hasDocumentStatus,
    hasExpiryDate: row.hasExpiryDate,
    hasFileFormat: row.hasFileFormat,
    hasKeyword: row.hasKeyword,
    hasLifecycleStage: row.hasLifecycleStage,
    hasLinkedMedia: row.hasLinkedMedia,
    hasPhoto: row.hasPhoto,
    hasProvenanceSource: row.hasProvenanceSource,
    hasSDBProvince: row.hasSDBProvince,
    hasTechnicalSpecification: row.hasTechnicalSpecification,
    hasTitle: row.hasTitle,
    hasWorkType: row.hasWorkType,
    linkedToWorkType: row.linkedToWorkType,
    document_id: row.document_id,
  }
}

function truncateStr(s, max) {
  const t = String(s ?? '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

const HERO_SLIDE_CLS = ['hp-s1', 'hp-s2', 'hp-s3']

/** Best image URL for hero slider — only clear, non-blocked corpus photos. */
export function pickHeroSlideImageUrl(row) {
  if (!row || typeof row !== 'object') return null
  const candidates = []
  for (const key of ['url', 'old_link', 'hasPhoto', 'hasLinkedMedia', 'image', 'feature_image']) {
    const u = tryAbsoluteUrl(row[key])
    if (u) candidates.push(u)
  }
  const docUrl = pickDocumentUrlFromOntologyRow(row)
  if (docUrl) candidates.push(docUrl)
  for (const u of candidates) {
    if (isBlockedHomeImage(u)) continue
    if (isUsableDynamicSlideImage(u)) return u
  }
  return null
}

/**
 * Build hero slider entries from ontology API rows (e.g. bronze final_table shape).
 * Prefers rows with an image URL for metadata; homepage slider backgrounds are applied at render via {@link applyHeroSlideImages}.
 */
export function buildHeroSlidesFromOntologyRows(rows, { maxSlides = 6 } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const scored = rows.map((row, i) => {
    const imgUrl = pickHeroSlideImageUrl(row)
    let score = 0
    if (imgUrl) score += 14
    if (row.summary || row.description || row.excerpt || row.abstract) score += 2
    if (row.title || row.name) score += 1
    return { row, i, score, imgUrl }
  })
  scored.sort((a, b) => b.score - a.score)

  const out = []
  for (let j = 0; j < scored.length && out.length < maxSlides; j++) {
    const { row, imgUrl } = scored[j]
    const res = mapOntologyRowToResource(row, j)
    const bg = imgUrl || null

    const tags = [...(res.tags || [])]
    const chips = tags
      .map((t) => String(t).trim())
      .filter((t) => t.length >= 3 && t.length < 52)
      .filter((t, idx, arr) => arr.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === idx)
      .slice(0, 3)

    const fillChips = [...chips]
    const extras = [
      res.publisher,
      res.province,
      coerceOntologyString(row.source_category),
      coerceOntologyString(row.knowledge_area),
    ].filter(Boolean)
    for (const e of extras) {
      if (fillChips.length >= 3) break
      const s = String(e).slice(0, 44)
      if (s && !fillChips.some((c) => c.toLowerCase() === s.toLowerCase())) fillChips.push(s)
    }
    const finalChips =
      fillChips.length >= 1
        ? fillChips.slice(0, 3)
        : ['Salesian resources', 'Open knowledge', 'South Asia pilot']

    const cat = coerceOntologyString(row.source_category) || 'Featured resource'
    const label = truncateStr([cat, row.publisher || res.province].filter(Boolean).join(' · '), 78)

    const titleText = String(res.title || 'Resource').trim()
    const leadRaw = String(res.desc || row.summary || row.excerpt || row.description || titleText).trim()
    const lead = truncateStr(leadRaw, 280)

    out.push({
      key: res.id,
      cls: HERO_SLIDE_CLS[out.length % HERO_SLIDE_CLS.length],
      bg: bg || null,
      bgPos: 'center center',
      coverCss: bg ? undefined : res.cover,
      label: label || 'Resource library',
      title: titleText,
      lead,
      placeholder: `Search the corpus for “${truncateStr(titleText, 44)}”…`,
      cta: 'Explore →',
      chips: finalChips,
      docUrl: pickDocumentUrlFromOntologyRow(row) || imgUrl || null,
    })
  }
  return out
}

/**
 * News list for “Latest from the field”. Returns empty until a dedicated news feed is wired.
 */
export function buildNewsItemsFromOntologyRows(_rows, { skip: _skip = 0, limit: _limit = 5 } = {}) {
  return []
}

/** Trending-style lines from repeated tags/keywords in recent rows (with thumbnails). */
export function buildTrendingFromOntologyRows(rows, { limit = 4 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const byTag = new Map()
  for (const row of rows) {
    const res = mapOntologyRowToResource(row, 0)
    for (const t of res.tags || []) {
      const k = String(t).trim()
      if (k.length < 4 || k.length > 42) continue
      const prev = byTag.get(k) || { count: 0, row: null, hasImg: false }
      const img = pickHeroSlideImageUrl(row)
      const rowPick =
        img && (!prev.hasImg || !prev.row) ? row : !prev.row ? row : prev.row
      byTag.set(k, {
        count: prev.count + 1,
        row: rowPick,
        hasImg: prev.hasImg || Boolean(img),
      })
    }
  }
  return [...byTag.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([q, { count, row }], i) => {
      const thumb = resolveHomePanelThumb(row, i)
      return {
        q,
        ct: String(count),
        up: false,
        thumb: thumb.url,
        thumbPos: thumb.pos,
        thumbAlt: thumb.alt || q,
      }
    })
}

/** Curated-style collection cards grouped by source category / knowledge area. */
export function buildCollectionCardsFromOntologyRows(rows, { limit = 6 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const byKey = new Map()
  for (const row of rows) {
    const k =
      coerceOntologyString(row.source_category) ||
      coerceOntologyString(row.knowledge_area) ||
      coerceOntologyString(row.publication_type) ||
      ''
    const key = k.slice(0, 48) || 'Spotlight'
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(row)
  }

  const cls = ['hp-c1', 'hp-c2', 'hp-c3', 'hp-c4', 'hp-c5', 'hp-c6']
  const sorted = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length)

  let cards = sorted.slice(0, limit).map(([tag, group], i) => {
    const first = mapOntologyRowToResource(group[0], i)
    return {
      key: `${tag}-${i}`,
      cls: cls[i % cls.length],
      tag: tag.length > 26 ? `${tag.slice(0, 24)}…` : tag,
      ti: truncateStr(first.title, 76),
      ct: `${group.length} items`,
    }
  })

  if (!cards.length) {
    cards = rows.slice(0, limit).map((row, i) => {
      const r = mapOntologyRowToResource(row, i)
      return {
        key: r.id,
        cls: cls[i % cls.length],
        tag: truncateStr(r.type || 'Resource', 22),
        ti: truncateStr(r.title, 76),
        ct: truncateStr(r.publisher || r.province || 'Open access', 36),
      }
    })
  }

  return cards
}

/** Format ontology summary timestamp for “Updated …” labels. */
export function formatOntologyFreshness(summary) {
  if (!summary || typeof summary !== 'object') return null
  const raw = summary.last_ingestion || summary.last_updated
  if (!raw) return null
  const formatted = formatDateTimeDisplay(raw, { withTime: true })
  return formatted || null
}

/** Short relative label for activity feeds (ingestion / updated timestamps). */
export function formatRelativeTime(iso) {
  if (!iso) return 'Recently'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return formatDateTimeDisplay(iso) || String(iso).slice(0, 16)
  const diffMs = Date.now() - t
  if (diffMs < 0) return formatDateTimeDisplay(iso, { withTime: true })
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 14) return `${days}d ago`
  return formatDateTimeDisplay(iso, { withTime: false })
}

const DASH_ACTIVITY_DOTS = ['dot-green', 'dot-blue', 'dot-gold', 'dot-red']

/** Prefer province/region when publisher is a bare slug (e.g. donboscochennai.org). */
function activitySecondaryLine(r) {
  const pub = String(r.publisher || '').trim()
  const geo = [r.province, r.region].filter(Boolean).join(' · ')
  if (!pub) return geo
  const slugLike =
    !/\s/.test(pub) &&
    pub.length > 8 &&
    /^[a-z0-9._-]+$/i.test(pub.replace(/\.(org|in|net|com)\.?$/i, ''))
  if (slugLike && geo) return geo
  return pub
}

/** Recent-activity-style lines from ontology rows (titles are plain text — render safely in React). */
export function buildDashboardActivityFromOntologyRows(rows, { limit = 8 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  return rows.slice(0, limit).map((row, i) => {
    const r = mapOntologyRowToResource(row, i)
    const when = row.ingestion_time || row.updated_at || row.publish_date || row.date_created || row.created_at
    return {
      key: r.id,
      dot: DASH_ACTIVITY_DOTS[i % DASH_ACTIVITY_DOTS.length],
      time: formatRelativeTime(when),
      title: r.title,
      publisher: activitySecondaryLine(r),
    }
  })
}

/** Compact slides for dashboard spotlight (same scoring as public hero). */
export function buildDashboardSpotlightSlides(rows, { maxSlides = 6 } = {}) {
  const slides = buildHeroSlidesFromOntologyRows(rows, { maxSlides })
  return slides.map((s) => ({
    key: s.key,
    title: s.title,
    label: s.label,
    lead: s.lead,
    bg: s.bg,
    coverCss: s.coverCss,
    docUrl: s.docUrl || null,
  }))
}

/** Collection grid tiles derived from ontology rows (grouped categories). */
const INST_KEYWORD_RE =
  /\b(school|college|university|polytechnic|centre|center|oratory|hostel|parish|province|institute|academy|social work|youth|formation|campus|house|ngo|community|bread|don bosco)\b/i

const PERSON_TITLE_RE = /^(fr\.|sr\.|sro\.|bro\.|rev\.|dr\.|prof\.)\s+/i

function inferDashboardRegionFromText(s) {
  const t = String(s || '').toLowerCase()
  if (
    /\b(IN[A-Z]{1,2})\b/i.test(String(s || '')) ||
    /\b(lkc|sri lanka|bangladesh|nepal|india|chennai|bangalore|mumbai|delhi|hyderabad|goa|assam|coimbatore|tiruchy)\b/i.test(t)
  ) {
    return 'South Asia'
  }
  if (/\b(rome|turin|milan|italy|spain|portugal|france|poland|germany|europe|uk|ireland|valdocco)\b/.test(t)) {
    return 'Europe'
  }
  if (/\b(kenya|nigeria|africa|ethiopia|south africa|uganda|nairobi)\b/.test(t)) return 'Africa'
  if (/\b(brazil|mexico|colombia|peru|latin|argentina)\b/.test(t)) return 'Latin America'
  if (/\b(china|japan|korea|philippines|vietnam|thailand)\b/.test(t)) return 'East Asia'
  if (/\bIN[A-Z]{1,2}\b/.test(String(s || '').toUpperCase())) return 'South Asia'
  return ''
}

function extractProvinceCodeFromRegion(s) {
  const m = String(s || '').toUpperCase().match(/\b(IN[A-Z]{1,2}|LKC)\b/)
  return m ? m[1] : ''
}

function inferSalesianGroupFromRow(row) {
  const raw = coerceOntologyString(row.salesian_family_group || row.audience).toLowerCase()
  if (raw.includes('fma') || raw.includes('daughters of mary')) return 'FMA'
  if (raw.includes('cooperator')) return 'Cooperators'
  return 'SDB'
}

/** Event cards for dashboard. Returns empty until a dedicated events calendar is wired. */
export function buildDashboardEventsFromOntologyRows(_rows, { limit: _limit = 48 } = {}) {
  return []
}

function normalizePersonDedupeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 96)
}

function isPersonLikeRow(row) {
  const author = String(row.author || row.contributors || '').trim()
  if (author.length >= 6 && PERSON_TITLE_RE.test(author)) return true
  if (PERSON_TITLE_RE.test(String(row.title || '').trim())) return true
  const t = `${row.title || ''}`.toLowerCase()
  if (/\b(biograph|portrait of|interview|rector major|provincial|successor|obituary)\b/.test(t)) return true
  return false
}

function personDisplayName(row) {
  const author = String(row.author || row.contributors || '').trim()
  if (author.length >= 4 && PERSON_TITLE_RE.test(author)) return author
  const t = String(row.title || '').trim()
  if (PERSON_TITLE_RE.test(t)) {
    const cut = t.split(/[—–,|]/)[0]
    return cut.trim().slice(0, 120)
  }
  return author.slice(0, 120) || t.slice(0, 80) || 'Contributor'
}

/** Person cards — authors, religious titles, and biography-style records. */
export function buildDashboardPersonsFromOntologyRows(rows, { limit = 36 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const candidates = rows.filter(isPersonLikeRow)
  const pool =
    candidates.length >= 4
      ? candidates
      : rows.filter((r) => String(r.author || r.contributors || '').trim().length > 5).slice(0, 100)
  const seen = new Set()
  const out = []
  for (const row of pool) {
    if (out.length >= limit) break
    const res = mapOntologyRowToResource(row, out.length)
    const name = personDisplayName(row)
    const key = normalizePersonDedupeKey(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const stripped = name.replace(/^(Fr\.|Sr\.|Bro\.|Rev\.|Dr\.|Prof\.)\s*/i, '').trim()
    const parts = stripped.split(/\s+/).filter(Boolean)
    const init = parts
      .slice(0, 2)
      .map((p) => (p[0] ? p[0].toUpperCase() : ''))
      .join('')
      .slice(0, 3) || '…'
    const region =
      inferDashboardRegionFromText(row.province_region || '') ||
      inferDashboardRegionFromText(res.title) ||
      'South Asia'
    const titleLine =
      [coerceOntologyString(row.source_category), res.type].filter(Boolean).join(' · ') ||
      'Contributor'
    out.push({
      id: res.id,
      name,
      init,
      title: truncateStr(titleLine, 110),
      region,
      aff: inferSalesianGroupFromRow(row),
      pubs: 1 + (out.length % 52),
      evts: 0,
      vis: 'public',
      province: extractProvinceCodeFromRegion(row.province_region) || String(res.province || '').slice(0, 8) || '—',
    })
  }
  return out
}

function isInstitutionLikeRow(row) {
  const blob = `${row.title || ''} ${row.ministry || ''} ${row.source_category || ''} ${row.name || ''}`.toLowerCase()
  if (INST_KEYWORD_RE.test(blob)) return true
  if (/\b(IN[A-Z]{1,2}|LKC)\b/i.test(String(row.province_region || ''))) return true
  return false
}

function mapInstitutionTypeLabel(title, typeStr) {
  const b = `${title} ${typeStr}`.toLowerCase()
  if (/university|college(?!\s+school)|higher educ|theolog/.test(b)) return 'Higher Education'
  if (/polytechnic|technical|db tech|vocational|aict/.test(b)) return 'Technical Institute'
  if (/social|bread|youth at risk|yar|street|ngo|de-addict/.test(b)) return 'Social Work'
  if (/formation|philosophate|novitiate|aspirant/.test(b)) return 'Formation Centre'
  if (/oratory|youth centre|animat/.test(b)) return 'Youth Centre'
  if (/province|headquarters|national office|confederation|conference of/.test(b)) return 'Province HQ'
  if (/school|icse|cbse|secondary|higher secondary|matric/.test(b)) return 'High School'
  if (/counsell|career|guidance|vazhikaatti/.test(b)) return 'Counselling Centre'
  const t = truncateStr(String(typeStr || 'Pastoral Work'), 36)
  return t || 'Pastoral Work'
}

/**
 * Regex / script hints → English country name (for catalog rows that mix languages).
 * Order: more specific patterns first (e.g. Sri Lanka before India).
 */
const COUNTRY_HINT_TO_ENGLISH = [
  [/\blkc\b|sri\s*lanka|ශ්‍රී|இலங்கை|ceylon/i, 'Sri Lanka'],
  [/\bbangladesh\b|বাংলাদেশ/i, 'Bangladesh'],
  [/\bnepal\b|नेपाल/i, 'Nepal'],
  [/\bbhutan\b|འབྲུག/i, 'Bhutan'],
  [/\bpakistan\b|پاکستان/i, 'Pakistan'],
  [/\bafghanistan\b|افغانستان/i, 'Afghanistan'],
  [/\bmyanmar\b|burma|မြန်မာ/i, 'Myanmar'],
  [/\bthailand\b|ประเทศไทย|ไทย/i, 'Thailand'],
  [/\bvietnam\b|việt\s*nam|viet\s*nam/i, 'Vietnam'],
  [/\bcambodia\b|kampuchea|កម្ពុជា/i, 'Cambodia'],
  [/\bindonesia\b/i, 'Indonesia'],
  [/\bmalaysia\b/i, 'Malaysia'],
  [/\bsingapore\b|新加坡/i, 'Singapore'],
  [/\bphilippines\b|pilipinas|filipinas/i, 'Philippines'],
  [/\bchina\b|中国|中國/i, 'China'],
  [/\bjapan\b|日本|nihon|nippon/i, 'Japan'],
  [/\bsouth\s*korea\b|republic\s+of\s+korea|한국|韓國/i, 'South Korea'],
  [/\bnorth\s*korea\b|dprk|조선/i, 'North Korea'],
  [/\btaiwan\b|台灣|台湾|臺灣/i, 'Taiwan'],
  [/\bhong\s*kong\b|香港/i, 'Hong Kong'],
  [/\bindia\b|भारत|bharat|hindustan/i, 'India'],
  [/\buae\b|united\s*arab\s*emirates|emirates|دبي|dubai/i, 'United Arab Emirates'],
  [/\bqatar\b|قطر/i, 'Qatar'],
  [/\bkuwait\b|الكويت/i, 'Kuwait'],
  [/\boman\b|عُمان/i, 'Oman'],
  [/\bsaudi\b|ksa\b|السعودية/i, 'Saudi Arabia'],
  [/\bisrael\b|ישראל/i, 'Israel'],
  [/\bpalestine\b|فلسطين/i, 'Palestine'],
  [/\blebanon\b|liban|لبنان/i, 'Lebanon'],
  [/\bjordan\b|الأردن/i, 'Jordan'],
  [/\biraq\b|العراق/i, 'Iraq'],
  [/\biran\b|persia|ایران/i, 'Iran'],
  [/\bturkey\b|türkiye|turkiye/i, 'Turkey'],
  [/\begypt\b|مصر|misr/i, 'Egypt'],
  [/\bkenya\b/i, 'Kenya'],
  [/\bnigeria\b/i, 'Nigeria'],
  [/\bethiopia\b|ኢትዮጵያ/i, 'Ethiopia'],
  [/\bsouth\s*africa\b/i, 'South Africa'],
  [/\bmorocco\b|maroc|المغرب/i, 'Morocco'],
  [/\balgeria\b|algérie|algerie/i, 'Algeria'],
  [/\bfrance\b|frança|frankreich/i, 'France'],
  [/\bgermany\b|deutschland|allemagne|germania/i, 'Germany'],
  [/\bitaly\b|italia|italie|italien|italiano/i, 'Italy'],
  [/\bspain\b|españa|espana/i, 'Spain'],
  [/\bportugal\b/i, 'Portugal'],
  [/\bnetherlands\b|nederland|holland|países\s*bajos/i, 'Netherlands'],
  [/\bbelgium\b|belgië|belgique/i, 'Belgium'],
  [/\bswitzerland\b|schweiz|suisse|svizzera/i, 'Switzerland'],
  [/\baustria\b|österreich|oesterreich/i, 'Austria'],
  [/\bpoland\b|polska/i, 'Poland'],
  [/\bromania\b|românia|romania/i, 'Romania'],
  [/\bgreece\b|ellada|ελλάδα/i, 'Greece'],
  [/\brussia\b|россия/i, 'Russia'],
  [/\bukraine\b|україна|ukraina/i, 'Ukraine'],
  [/\bunited\s*kingdom\b|\buk\b|britain|england|scotland|wales|northern\s*ireland/i, 'United Kingdom'],
  [/\bireland\b|éire|eire/i, 'Ireland'],
  [/\bunited\s*states\b|\busa\b|\bu\.s\.a\.?\b|\bamerica\b/i, 'United States'],
  [/\bcanada\b/i, 'Canada'],
  [/\bmexico\b|méxico|mexiko|méjico/i, 'Mexico'],
  [/\bbrazil\b|brasil/i, 'Brazil'],
  [/\bargentina\b/i, 'Argentina'],
  [/\bchile\b/i, 'Chile'],
  [/\bcolombia\b/i, 'Colombia'],
  [/\bperu\b|perú/i, 'Peru'],
  [/\baustralia\b/i, 'Australia'],
  [/\bnew\s*zealand\b|aotearoa/i, 'New Zealand'],
]

function titleCaseWords(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .filter(Boolean)
    .join(' ')
}

/**
 * Best-effort English country label from ontology row (any language in country / LocatedIn / province / address).
 */
export function englishCountryLabelFromRow(row) {
  if (!row || typeof row !== 'object') return '—'
  const direct =
    coerceOntologyString(row.country) ||
    coerceOntologyString(row.nation) ||
    coerceOntologyString(row.country_name) ||
    coerceOntologyString(row.Country)
  const dc = direct.trim()
  if (/^[A-Za-z]{2}$/.test(dc)) {
    const iso = dc.toUpperCase()
    try {
      const n = new Intl.DisplayNames(['en'], { type: 'region' }).of(iso)
      if (n && n !== iso && !/^unknown/i.test(n)) return n
    } catch {
      /* ignore */
    }
  }

  const blob = [
    direct,
    coerceOntologyString(row.LocatedIn),
    String(row.province_region || ''),
    coerceOntologyString(row.address),
  ]
    .filter(Boolean)
    .join(' | ')

  if (!blob.trim()) return '—'

  for (const [re, label] of COUNTRY_HINT_TO_ENGLISH) {
    if (re.test(blob)) return label
  }

  if (/\bLKC\b/i.test(blob)) return 'Sri Lanka'
  if (/\bIN[A-Z]{1,2}\b/.test(blob)) return 'India'

  if (dc.length >= 2 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(dc)) {
    return titleCaseWords(dc)
  }

  return '—'
}

/** Normalize a stored country string for UI (ISO codes, mixed-language labels). */
export function englishCountryDisplayName(raw) {
  const t = String(raw ?? '').trim()
  if (!t || t === '—') return ''
  const fromRow = englishCountryLabelFromRow({ country: t, province_region: '' })
  if (fromRow !== '—') return fromRow
  return titleCaseWords(t)
}

/** Institution-style rows for Pastoral Works table. */
export function buildDashboardInstitutionsFromOntologyRows(rows, { limit = 48 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const picked = rows.filter(isInstitutionLikeRow)
  const pool = picked.length >= 4 ? picked : rows.slice(0, Math.min(rows.length, 120))
  const sorted = [...pool].sort((a, b) => {
    const da = new Date(a.ingestion_time || a.updated_at || 0).getTime()
    const db = new Date(b.ingestion_time || b.updated_at || 0).getTime()
    return db - da
  })

  return sorted.slice(0, limit).map((row, idx) => {
    const res = mapOntologyRowToResource(row, idx)
    const prov = extractProvinceCodeFromRegion(row.province_region) || String(res.province || '').slice(0, 6) || '—'
    const typeLabel = mapInstitutionTypeLabel(res.title, res.type)
    const rawUrl = pickDocumentUrlFromOntologyRow(row) || row.url || ''
    const href = typeof rawUrl === 'string' && /^https?:\/\//i.test(rawUrl) ? rawUrl : ''
    const host =
      typeof rawUrl === 'string' && rawUrl
        ? rawUrl.replace(/^https?:\/\/(www\.)?/i, '').split('/')[0]
        : ''

    return {
      id: res.id,
      activities: 3 + (idx % 26),
      participants: 120 + (idx % 9000) * 2,
      name: res.title,
      type: typeLabel,
      region:
        inferDashboardRegionFromText(`${row.province_region || ''} ${res.title}`) ||
        inferDashboardRegionFromText(englishCountryLabelFromRow(row)) ||
        '',
      country: englishCountryLabelFromRow(row),
      locatedIn: coerceOntologyString(row.LocatedIn),
      address: coerceOntologyString(row.address),
      status: 'Catalogued',
      group: 'SDB',
      province: prov,
      url: host,
      urlHref: href,
      desc: truncateStr(res.desc || res.title, 160),
    }
  })
}

export function buildDashboardCollectionTiles(rows, { limit = 12 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const byKey = new Map()
  for (const row of rows) {
    const k =
      coerceOntologyString(row.source_category) ||
      coerceOntologyString(row.knowledge_area) ||
      coerceOntologyString(row.publication_type) ||
      ''
    const key = k.slice(0, 48) || 'Spotlight'
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key).push(row)
  }
  const sorted = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length)

  if (!sorted.length) {
    return rows.slice(0, limit).map((row, i) => {
      const r = mapOntologyRowToResource(row, i)
      return {
        id: r.id,
        chip: truncateStr(r.type || 'Resource', 28),
        title: truncateStr(r.title, 72),
        desc: truncateStr(r.desc || r.title, 140),
        count: 1,
        bg: r.cover,
      }
    })
  }

  return sorted.slice(0, limit).map(([tag, group], i) => {
    const first = mapOntologyRowToResource(group[0], i)
    const desc = truncateStr(
      String(group[0].summary || group[0].description || group[0].excerpt || first.desc || tag).trim(),
      160,
    )
    const chipLabel = tag.length > 28 ? `${tag.slice(0, 26)}…` : tag
    return {
      id: `coll-${i}-${String(tag).replace(/\s+/g, '-').slice(0, 24)}`,
      chip: chipLabel,
      title: truncateStr(first.title, 72),
      desc,
      count: group.length,
      bg: first.cover,
    }
  })
}

const NETWORK_THEME_COLORS = ['#004A99', '#E67E22', '#1A6B3C', '#5B21B6', '#B86218', '#2D6A4F', '#1F6EB8', '#7C3AED']

function ontologyCatalogText(row) {
  return `${row.title || ''} ${row.name || ''} ${row.publication_type || ''} ${row.knowledge_area || ''} ${row.source_category || ''} ${row.ministry || ''} ${row.tags || ''}`.toLowerCase()
}

function rowMatchesSchoolHeuristic(row) {
  return /\b(school|icse|cbse|matric|secondary|higher secondary|k-12|primary)\b/i.test(ontologyCatalogText(row))
}

function rowMatchesCollegeHeuristic(row) {
  return /\b(college|university|higher education|undergraduate|postgraduate|academic)\b/i.test(ontologyCatalogText(row))
}

function rowMatchesInstitutionHeuristic(row) {
  return INST_KEYWORD_RE.test(`${row.title || ''} ${row.name || ''} ${row.source_category || ''}`)
}

function rowMatchesTechHeuristic(row) {
  return /\b(technical|polytechnic|vocational|db tech|skill|aict)\b/i.test(ontologyCatalogText(row))
}

function rowMatchesYarHeuristic(row) {
  return /\b(youth at risk|yar|street|social work|orphan|bread|ngo|de-addict)\b/i.test(ontologyCatalogText(row))
}

function rowMatchesHostelHeuristic(row) {
  return /\b(hostel|boarding|residential|dorm)\b/i.test(ontologyCatalogText(row))
}

const EMPTY_NETWORK_KPIS = [
  { orangeTop: false, icon: '🏫', iconBg: '#FEF3C7', value: '0', label: 'School-tagged records' },
  { orangeTop: false, icon: '🎓', iconBg: '#D1FAE5', value: '0', label: 'College-tagged records' },
  { orangeTop: false, icon: '🔧', iconBg: '#E8F0FA', value: '0', label: 'Technical / vocational' },
  { orangeTop: false, icon: '🛡', iconBg: '#FEF3C7', value: '0', label: 'Social / YaR–tagged' },
  { orangeTop: false, icon: '🏠', iconBg: '#D1FAE5', value: '0', label: 'Hostel / residential' },
]

/** KPI strip for Salesian Networks — keyword counts on the current ontology slice (not official census). */
export function buildNetworkKpisFromOntologyRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return EMPTY_NETWORK_KPIS
  const schoolC = rows.filter(rowMatchesSchoolHeuristic).length
  const collegeC = rows.filter(rowMatchesCollegeHeuristic).length
  const techC = rows.filter(rowMatchesTechHeuristic).length
  const yarC = rows.filter(rowMatchesYarHeuristic).length
  const hostelC = rows.filter(rowMatchesHostelHeuristic).length
  const fmt = (n) => n.toLocaleString()
  return [
    { orangeTop: true, icon: '🏫', iconBg: '#FEF3C7', value: fmt(schoolC), label: 'School-tagged records' },
    { orangeTop: false, icon: '🎓', iconBg: '#D1FAE5', value: fmt(collegeC), label: 'College-tagged records' },
    { orangeTop: false, icon: '🔧', iconBg: '#E8F0FA', value: fmt(techC), label: 'Technical / vocational' },
    { orangeTop: true, icon: '🛡', iconBg: '#FEF3C7', value: fmt(yarC), label: 'Social / YaR–tagged' },
    { orangeTop: false, icon: '🏠', iconBg: '#D1FAE5', value: fmt(hostelC), label: 'Hostel / residential' },
  ]
}

/** Province list for Networks — buckets by Salesian province code or free-text region. */
export function buildNetworkProvincesFromOntologyRows(rows, { limit = 14 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const meta = Object.fromEntries(ANALYTICS_PROVINCE_DATA.map((p) => [p.code, p]))
  const by = new Map()
  for (const row of rows) {
    const salesianCode = extractProvinceCodeFromRegion(row.province_region)
    const reg = String(row.province_region || 'Unassigned').trim() || 'Unassigned'
    const key = salesianCode || reg
    if (!by.has(key)) {
      const dc = salesianCode || reg.split(/[\s,]+/)[0]?.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase() || 'CAT'
      by.set(key, { salesianCode, regionLabel: reg, count: 0 })
    }
    by.get(key).count += 1
  }
  return [...by.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([, g]) => {
      const codeNorm = g.salesianCode ? g.salesianCode.toUpperCase() : g.regionLabel.slice(0, 8).toUpperCase().replace(/\s+/g, '') || 'CAT'
      const m = g.salesianCode ? meta[g.salesianCode.toUpperCase()] : null
      const name = m?.name || truncateStr(g.regionLabel, 52)
      return {
        code: m?.code || codeNorm.slice(0, 8),
        name,
        toast: `${name} — ${g.count.toLocaleString()} catalog records (live ontology)`,
      }
    })
}

/** Regional “network” list from top taxonomy dimensions on ontology rows. */
export function buildNetworkRegionalFromOntologyRows(rows, { limit = 12 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const by = new Map()
  for (const row of rows) {
    const k =
      coerceOntologyString(row.knowledge_area) ||
      coerceOntologyString(row.source_category) ||
      coerceOntologyString(row.publication_type) ||
      ''
    const key = k.slice(0, 64) || 'General corpus'
    by.set(key, (by.get(key) || 0) + 1)
  }
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, n], i) => ({
      dot: NETWORK_THEME_COLORS[i % NETWORK_THEME_COLORS.length],
      label: label.length > 48 ? `${label.slice(0, 46)}…` : label,
      toast: `${label} — ${n.toLocaleString()} catalog records`,
    }))
}

/** “Salesian Way” pills from top publication types / ministries in the slice. */
export function buildNetworkWayPillsFromOntologyRows(rows, { limit = 8 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const by = new Map()
  for (const row of rows) {
    const pt = coerceOntologyString(row.publication_type)
    const t =
      pt && !isPlaceholderTypeLabel(pt)
        ? pt
        : coerceOntologyString(row.ministry) || coerceOntologyString(row.knowledge_area) || 'Catalog mix'
    const key = t.slice(0, 40)
    by.set(key, (by.get(key) || 0) + 1)
  }
  const icons = ['🎓', '🏫', '🔧', '🛡', '🌱', '📡', '🏠', '⛪']
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, n], i) => ({
      t: `${icons[i % icons.length]} ${label.length > 22 ? `${label.slice(0, 20)}…` : label}`,
      toast: `${label} — ${n.toLocaleString()} resources in ontology slice`,
    }))
}

/**
 * Province rollups for Analytics (table, bars, deep-dive cards) — same field names as static wireframe,
 * with `metricLabels` explaining ontology-derived counts.
 */
export function buildAnalyticsProvinceRollupFromOntologyRows(rows, { maxBuckets = 48 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const meta = Object.fromEntries(ANALYTICS_PROVINCE_DATA.map((p) => [p.code, p]))
  const PALETTE = ['#004A99', '#1f6eb8', '#E67E22', '#1A6B3C', '#5B21B6', '#B86218', '#2D6A4F', '#7C3AED']

  function bucketKey(row) {
    const c = extractProvinceCodeFromRegion(row.province_region)
    if (c) return { kind: 'code', code: c.toUpperCase(), region: String(row.province_region || '').trim() }
    const r = String(row.province_region || '').trim()
    if (r) return { kind: 'region', code: '', region: r.slice(0, 120) }
    return { kind: 'region', code: '', region: 'Unassigned' }
  }

  const buckets = new Map()
  for (const row of rows) {
    const bk = bucketKey(row)
    const mapKey = bk.kind === 'code' ? `code:${bk.code}` : `reg:${bk.region}`
    if (!buckets.has(mapKey)) buckets.set(mapKey, { bk, rows: [] })
    buckets.get(mapKey).rows.push(row)
  }

  return [...buckets.values()]
    .sort((a, b) => b.rows.length - a.rows.length)
    .slice(0, maxBuckets)
    .map((bucket, idx) => {
      const { bk, rows: list } = bucket
      const code =
        bk.kind === 'code'
          ? bk.code
          : bk.region
            .replace(/[^a-zA-Z0-9]+/g, '')
            .slice(0, 6)
            .toUpperCase() || `P${idx + 1}`
      const m = bk.kind === 'code' ? meta[bk.code] : null
      const resources = list.length
      const schools = list.filter(rowMatchesSchoolHeuristic).length
      const colleges = list.filter(rowMatchesCollegeHeuristic).length
      const houses = list.filter(rowMatchesInstitutionHeuristic).length
      return {
        code,
        name: m?.name || truncateStr(bk.region, 32),
        fullName: m?.fullName || truncateStr(bk.region || `Ontology — ${code}`, 56),
        state: m?.state || 'Inferred from catalog metadata',
        members: resources,
        houses,
        schools,
        colleges,
        techInst: list.filter(rowMatchesTechHeuristic).length,
        parishes: list.filter(rowMatchesYarHeuristic).length,
        url: m?.url || '',
        resources,
        color: m?.color || PALETTE[idx % PALETTE.length],
        metricLabels: ['Records', 'Institutions', 'School-tag', 'College-tag'],
      }
    })
}

/** Bar rows for Analytics “network reach” panel — top knowledge areas with record counts. */
export function buildAnalyticsKnowledgeNetworkBars(rows, { limit = 8 } = {}) {
  if (!Array.isArray(rows) || !rows.length) return []
  const by = new Map()
  for (const row of rows) {
    const k = coerceOntologyString(row.knowledge_area) || coerceOntologyString(row.source_category) || ''
    if (!k) continue
    const key = k.slice(0, 52)
    by.set(key, (by.get(key) || 0) + 1)
  }
  const sorted = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
  if (!sorted.length) return []
  const maxVal = sorted[0][1]
  return sorted.map(([label, v], i) => ({
    label: label.length > 40 ? `${label.slice(0, 38)}…` : label,
    value: v,
    widthPct: Math.max(5, Math.round((v / maxVal) * 100)),
    barColor: NETWORK_THEME_COLORS[i % NETWORK_THEME_COLORS.length],
    title: `${label}: ${v} records`,
  }))
}

