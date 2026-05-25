/**
 * Default hero slider photos when the catalog API is unavailable or a slide has no image.
 */

export const HOME_HERO_STATIC_IMAGES = [
  'https://archive.sdb.org/images/headers/cabeceraInterior3.jpg',
  'https://archive.sdb.org/images/headers/cabeceraInterior2.jpg',
  'https://archive.sdb.org/images/headers/cabeceraInterior5.jpg',
]

const IMAGE_URL_RE = /\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i

export function isUsableDynamicSlideImage(url) {
  if (!url || typeof url !== 'string') return false
  const u = url.trim()
  if (!/^https?:\/\//i.test(u)) return false
  if (/\.(pdf|docx?|xlsx?|zip|mp4|webm)(\?|#|$)/i.test(u)) return false
  return IMAGE_URL_RE.test(u) || /\/images?\//i.test(u) || /thumbnail|photo|media/i.test(u)
}

export function staticHeroImageAt(index) {
  return HOME_HERO_STATIC_IMAGES[index % HOME_HERO_STATIC_IMAGES.length]
}

/** Corpus photo when valid; otherwise archive header for this slide index. */
export function heroSlideImageSrc(slide, index) {
  const dynamic = slide?.bg || slide?.image
  if (isUsableDynamicSlideImage(dynamic)) return dynamic.trim()
  return staticHeroImageAt(index)
}

export function applyHeroSlideImages(slides) {
  if (!Array.isArray(slides) || !slides.length) return slides
  return slides.map((s, i) => ({
    ...s,
    bg: heroSlideImageSrc(s, i),
    bgPos: s.bgPos || 'center center',
  }))
}
