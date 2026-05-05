import { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { englishCountryDisplayName } from '../../lib/ontologyApi'
import './PastoralWorksMap.css'

/**
 * Basemap: Esri World Street Map first — labels are English-oriented (OSM.org tiles use local scripts).
 * If Esri tiles fail repeatedly (e.g. firewall), fall back to OpenStreetMap.
 */
const TILE_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const TILE_ESRI =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'

/**
 * Esri World Street Map serves grey “Map data not yet available” tiles at z0–z2 for many x/y.
 * Keep the map at z3+ so only real basemap tiles load.
 */
const MAP_MIN_ZOOM = 3

/** One world copy: no repeating Asia when panning horizontally. */
const TILE_WRAP_OPTS = { noWrap: true, minZoom: MAP_MIN_ZOOM, maxZoom: 19 }

/** Keep the map on a single South Asia frame (still allows pan/zoom inside). */
const SOUTH_ASIA_PAN_LIMIT = L.latLngBounds(
  [1.5, 61],
  [38.5, 104],
)
/** Default “home” framing after reset (India, neighbours, Sri Lanka). */
const SOUTH_ASIA_RESET_VIEW = L.latLngBounds(
  [5.5, 66.5],
  [34.5, 99.5],
)

function addWorkingBasemap(map) {
  const esri = L.tileLayer(TILE_ESRI, {
    attribution:
      '&copy; Esri, Maxar, Earthstar Geographics &mdash; <a href="https://www.esri.com/">Esri</a>',
    ...TILE_WRAP_OPTS,
  })
  esri.addTo(map)

  let switched = false
  let failCount = 0
  esri.on('tileerror', () => {
    if (switched) return
    failCount += 1
    if (failCount < 6) return
    switched = true
    try {
      map.removeLayer(esri)
    } catch {
      /* ignore */
    }
    L.tileLayer(TILE_OSM, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      ...TILE_WRAP_OPTS,
    }).addTo(map)
  })
}

/** Approximate HQ / centroid per Salesian province code (South Asia + neighbours) for catalog pins. */
const PROVINCE_COORDS = {
  INK: [12.9716, 77.5946],
  INM: [13.0827, 80.2707],
  INH: [17.385, 78.4867],
  INB: [19.076, 72.8777],
  INN: [28.6139, 77.209],
  INP: [15.4989, 73.8278],
  INC: [22.5726, 88.3639],
  INS: [25.5788, 91.8933],
  INT: [10.7905, 78.7047],
  IND: [25.9117, 93.7267],
  ING: [26.1158, 91.7086],
  LKC: [6.9271, 79.8612],
}

/** English labels for Salesian province codes (map UI). */
const PROVINCE_CODE_ENGLISH = {
  INK: 'Bangalore',
  INM: 'Chennai',
  INH: 'Hyderabad',
  INB: 'Mumbai',
  INN: 'New Delhi',
  INP: 'Panjim',
  INC: 'Kolkata',
  INS: 'Shillong',
  INT: 'Tiruchirappalli',
  IND: 'Dimapur',
  ING: 'Guwahati',
  LKC: 'Colombo',
}

function extractProvinceCode(inst) {
  const raw = String(inst.province || '').trim().toUpperCase()
  const m = raw.match(/\b(IN[A-Z]{1,2}|LKC)\b/)
  if (m) return m[1]
  if (raw.length <= 4 && /^(IN[A-Z]+|LKC)$/i.test(raw)) return raw
  return null
}

function englishProvinceLine(inst) {
  const code = extractProvinceCode(inst)
  if (code && PROVINCE_CODE_ENGLISH[code]) {
    return `${PROVINCE_CODE_ENGLISH[code]} (${code})`
  }
  const p = String(inst.province || '').trim()
  return p || '—'
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Only allow http(s) URLs in popup anchors. */
function safeUrlForAttr(u) {
  const s = String(u || '').trim()
  if (!/^https?:\/\//i.test(s)) return ''
  return escapeHtml(s)
}

function jitter([lat, lng], index, spread = 0.035) {
  const a = (index * 2.39996322972865332) % (Math.PI * 2)
  const r = spread * (0.35 + (index % 9) * 0.12)
  return [lat + Math.cos(a) * r, lng + Math.sin(a) * r]
}

function coordsForInstitution(inst, index) {
  const raw = String(inst.province || '').trim().toUpperCase()
  const m = raw.match(/\b(IN[A-Z]{1,2}|LKC)\b/)
  const code = m ? m[1] : raw.length <= 4 && /^IN[A-Z]+|LKC$/i.test(raw) ? raw : null
  if (code && PROVINCE_COORDS[code]) {
    return jitter(PROVINCE_COORDS[code], index)
  }
  const c = String(inst.country || '').toLowerCase()
  if (c.includes('sri lanka')) return jitter([7.8731, 80.7718], index)
  if (c.includes('nepal')) return jitter([27.7172, 85.324], index)
  if (c.includes('bangladesh')) return jitter([23.8103, 90.4125], index)
  return jitter([22.5, 79.0], index)
}

const TYPE_COLORS = {
  'High School': '#1a6b3c',
  'Higher Education': '#5b21b6',
  'Technical Institute': '#004a99',
  'Social Work': '#b45309',
  'Youth Centre': '#0e7490',
  'Formation Centre': '#6d28d9',
  'Province HQ': '#0f766e',
  default: '#004a99',
}

function colorForType(type) {
  const t = String(type || '')
  return TYPE_COLORS[t] || TYPE_COLORS.default
}

/**
 * Live Leaflet map: markers follow `institutions` (e.g. filtered pastoral works). Updates when props change.
 * @param {object} [opts]
 * @param {boolean} [opts.embed] — compact rounded frame for public homepage / inline cards (not dashboard footer radius).
 * @param {string} [opts.className] — extra classes on the outer shell.
 * @param {boolean} [opts.showPinCount] — show bottom-left pin count strip (default true).
 * @param {string} [opts.emptyTitle] — copy when there are no institutions.
 * @param {string} [opts.emptyHint] — secondary line for empty state.
 */
export function PastoralWorksMap({
  institutions,
  loading,
  embed = false,
  className = '',
  showPinCount = true,
  emptyTitle = 'No locations for current filters',
  emptyHint = 'Adjust search or filters to show institutions on the map.',
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const groupRef = useRef(null)

  /** Restore the standard single South Asia framing (after panning/zooming away). */
  const resetSouthAsiaView = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    map.closePopup()
    map.flyToBounds(SOUTH_ASIA_RESET_VIEW, { padding: [28, 28], duration: 0.55, maxZoom: 6 })
  }, [])

  useEffect(() => {
    if (loading) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        groupRef.current = null
      }
      return
    }
    if (institutions.length === 0) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        groupRef.current = null
      }
      return
    }
    if (!containerRef.current) return

    if (!mapRef.current) {
      const el = containerRef.current
      el.style.background = '#dce8f7'
      const map = L.map(el, {
        scrollWheelZoom: false,
        zoomControl: false,
        attributionControl: true,
        preferCanvas: false,
        minZoom: MAP_MIN_ZOOM,
        maxZoom: 19,
        maxBounds: SOUTH_ASIA_PAN_LIMIT,
        maxBoundsViscosity: 0.85,
      })
      mapRef.current = map
      L.control
        .zoom({
          zoomInTitle: 'Zoom in',
          zoomOutTitle: 'Zoom out',
        })
        .addTo(map)
      addWorkingBasemap(map)
      groupRef.current = L.layerGroup().addTo(map)
      map.setView([16.5, 78.5], 5)
      map.whenReady(() => {
        map.invalidateSize()
        window.requestAnimationFrame(() => map.invalidateSize())
      })
    }

    const map = mapRef.current
    const group = groupRef.current
    if (!map || !group) return

    group.clearLayers()
    const latlngs = []

    institutions.forEach((inst, i) => {
      const [lat, lng] = coordsForInstitution(inst, i)
      latlngs.push([lat, lng])
      const fill = colorForType(inst.type)
      const marker = L.circleMarker([lat, lng], {
        radius: 8,
        stroke: true,
        weight: 2,
        color: '#ffffff',
        opacity: 0.95,
        fillColor: fill,
        fillOpacity: 0.92,
      })
      const prov = escapeHtml(englishProvinceLine(inst))
      const typ = escapeHtml(inst.type || '')
      const name = escapeHtml(inst.name || 'Record')
      const country = escapeHtml(englishCountryDisplayName(inst.country || ''))
      const href = safeUrlForAttr(inst.urlHref)
      const link = href
        ? `<p style="margin-top:10px"><a href="${href}" target="_blank" rel="noreferrer" style="font-weight:600;color:#c2410c;text-decoration:none">Open link ↗</a></p>`
        : ''
      const detailBlock = `<div style="font-size:13px;line-height:1.45;color:#1e293b;min-width:0">
          <div style="font-weight:700;color:#003559">${name}</div>
          <div style="margin-top:6px;font-size:11px;color:#475569">${prov} · ${typ}</div>
          ${country ? `<div style="margin-top:4px;font-size:11px;color:#64748b">${country}</div>` : ''}
          ${link}
        </div>`
      const tipBlock = `<div style="font-size:12px;line-height:1.4;color:#1e293b;min-width:0">
          <div style="font-weight:700;color:#003559">${name}</div>
          <div style="margin-top:4px;font-size:11px;color:#475569">${prov} · ${typ}</div>
          ${country ? `<div style="margin-top:2px;font-size:11px;color:#64748b">${country}</div>` : ''}
        </div>`
      marker.bindTooltip(tipBlock, {
        sticky: true,
        direction: 'top',
        opacity: 1,
        className: 'pastoral-map-tip',
      })
      marker.bindPopup(detailBlock, { maxWidth: 280 })
      marker.addTo(group)
    })

    if (latlngs.length === 1) {
      map.setView(latlngs[0], Math.max(MAP_MIN_ZOOM, 7), { animate: false })
    } else if (latlngs.length > 1) {
      map.fitBounds(L.latLngBounds(latlngs).pad(0.18), { animate: false, maxZoom: 8 })
    } else {
      map.setView([16.5, 78.5], Math.max(MAP_MIN_ZOOM, 5), { animate: false })
    }
    if (map.getZoom() < MAP_MIN_ZOOM) {
      map.setZoom(MAP_MIN_ZOOM, { animate: false })
    }

    const t1 = window.setTimeout(() => map.invalidateSize(), 50)
    const t2 = window.setTimeout(() => map.invalidateSize(), 400)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [institutions, loading])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        groupRef.current = null
      }
    }
  }, [])

  const radius = embed ? 'rounded-[14px]' : 'rounded-b-xl'
  const minH = embed ? 'min-h-[240px]' : 'min-h-[280px]'
  const mapH = embed ? 'h-[272px]' : 'h-[min(360px,55vh)]'

  if (loading) {
    return (
      <div
        className={`flex ${minH} flex-col items-center justify-center gap-3 ${radius} bg-gradient-to-b from-slate-100 to-slate-200/90 px-4 ${className}`}
        aria-busy="true"
      >
        <div className="size-10 animate-pulse rounded-full bg-slate-300/80" />
        <p className="text-sm font-medium text-slate-500">Loading map…</p>
      </div>
    )
  }

  if (!institutions.length) {
    return (
      <div
        className={`flex ${minH} flex-col items-center justify-center gap-2 ${radius} bg-gradient-to-b from-[#eef5fc] to-[#d6e8f7] px-6 text-center ${className}`}
      >
        <span className="text-2xl" aria-hidden>
          🗺
        </span>
        <p className="text-sm font-semibold text-sdb-blue-deep">{emptyTitle}</p>
        <p className="max-w-sm text-xs text-mid">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className={`relative z-0 ${mapH} ${minH} w-full overflow-hidden ${radius} bg-[#dce8f7] ${className}`}>
      {/* Explicit block height so Leaflet can request tiles; absolute-only parents often break tile layout */}
      <div ref={containerRef} className={`h-full ${minH} w-full`} />
      <div className="pointer-events-auto absolute top-2 right-2 z-[400]">
        <button
          type="button"
          onClick={resetSouthAsiaView}
          className="rounded-md border border-white/70 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-sdb-blue-deep shadow-sm backdrop-blur-sm hover:bg-white"
          title="Reset map to South Asia overview"
        >
          South Asia view
        </button>
      </div>
      {showPinCount ? (
        <div className="pointer-events-none absolute bottom-2 left-2 z-[400] max-w-[min(100%,20rem)] rounded-md border border-white/60 bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
          {institutions.length} pin{institutions.length !== 1 ? 's' : ''} · province centroids (approx.)
        </div>
      ) : null}
    </div>
  )
}
