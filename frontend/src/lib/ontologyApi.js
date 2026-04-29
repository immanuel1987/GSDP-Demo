/** Base URL for backend (e.g. `VITE_API_BASE_URL` in `.env.development`). */
// export function apiBase() {
//   const raw = import.meta.env.VITE_API_BASE_URL
//   const s = raw === undefined || raw === null ? '' : String(raw).trim()
//   if (s) return s.replace(/\/$/, '')
//   return 'http://127.0.0.1:2005'
// }


export function apiBase() {
  const raw = import.meta.env.VITE_API_BASE_URL
  const s = raw === undefined || raw === null ? '' : String(raw).trim()
  if (s) return s.replace(/\/$/, '')
  return 'http://3.111.23.138:2005'
}

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

export async function fetchOntologyRows({ limit = 80, offset = 0, q = '' } = {}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  if (q.trim()) params.set('q', q.trim())
  const url = `${apiBase()}/data/ontology?${params.toString()}`
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
  const directKeys = ['url', 'path', 'attachment', 'image', 'feature_image', 'hasLinkedMedia', 'hasPhoto']

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
  const ff = String(row?.file_format || '').toLowerCase()
  const mt = String(row?.media_type || '').toLowerCase()
  const tp = String(row?.type || '').toLowerCase()
  const blob = `${ff} ${mt} ${tp}`
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
  const s = String(val).trim()
  if (!s || s === '[]' || s === '{}' || s.toLowerCase() === 'null') return ''
  if ((s.startsWith('[') || s.startsWith('{')) && s.length < 500000) {
    try {
      const j = JSON.parse(s)
      if (Array.isArray(j)) return j.map((x) => String(x).trim()).filter(Boolean).join(', ')
      if (j && typeof j === 'object') return Object.values(j).map((x) => String(x).trim()).filter(Boolean).join(', ')
    } catch {
      /* leave as raw string */
    }
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
  if (src) return humanizeSourceTableLabel(src) || 'Catalog record'

  return 'Resource'
}

export async function fetchOntologySummary() {
  const url = `${apiBase()}/data/ontology/summary`
  const res = await apiFetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json()
}

/**
 * Map a row from ontology.bronze.final_table_ontology to Resource Library card shape.
 */
export function mapOntologyRowToResource(row, index) {
  const title = row.title || row.hasTitle || row.name || row.subject || row.slug || 'Untitled'
  const author =
    coerceOntologyString(row.author) ||
    coerceOntologyString(row.authors) ||
    coerceOntologyString(row.contributors) ||
    (row.contacts ? coerceOntologyString(row.contacts).slice(0, 120) : '') ||
    '—'
  const publisher = row.publisher || ''
  const area = row.knowledge_area || row.ministry || row.charism_dimension || row.source_category || ''
  const docUrl = pickDocumentUrlFromOntologyRow(row)
  const docKind = inferDocumentKindFromOntology(docUrl, row)
  const type = resolveResourceCardType(row, docKind)
  const lang = coerceOntologyString(row.languages || row.translation_available) || '—'
  const province = row.province_region || ''
  const region = province || row.diocese || ''
  const yRaw = row.date_published || row.publish_date || row.date_created || row.created_at || ''
  const year = typeof yRaw === 'string' && yRaw.length >= 4 ? yRaw.slice(0, 4) : yRaw ? String(yRaw).slice(0, 4) : ''
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
    'linear-gradient(135deg,#003A75,#0057A8)',
    'linear-gradient(135deg,#B84D00,#E8600A)',
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

