/**
 * Hero slider only — current-generation youth group photos.
 * Use {@link applyHeroSlideImages} on the public homepage slider; do not use for trending or resource cards.
 */

/** @type {{ url: string, bgPos: string, alt: string }[]} */
export const HOME_HERO_STATIC_SLIDES = [
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8f/ZCAS-U_Graduation.jpg',
    bgPos: 'center center',
    alt: 'University graduation — graduates and families together',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/Square_academic_cap_%28graduation_hats%29.JPG',
    bgPos: 'center 40%',
    alt: 'Graduates throwing mortarboards — celebration with youth',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e6/12th_Convocation_2023_Top_Group_pic.jpg',
    bgPos: 'center 32%',
    alt: 'Convocation — large group of graduates in academic regalia',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Salesian_Institute_Youth_Project.jpg',
    bgPos: 'center center',
    alt: 'Salesian Institute youth project — young people together',
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/07/Arm_wrestling_in_India.jpg',
    bgPos: 'center center',
    alt: 'Young people at a campus activity — peer community',
  },
]

export const HOME_HERO_STATIC_IMAGES = HOME_HERO_STATIC_SLIDES.map((s) => s.url)

const IMAGE_URL_RE = /\.(jpe?g|png|gif|webp|avif|svg)(\?|#|$)/i

/** Block buildings, low-res banners, historical oratory, and non-group shots. */
const BLOCKED_IMAGE_RE =
  /Reka-|Oratory-in-192|Oratory-192|Giovanni_Bosco-Giovanni_Battista|Parish_Church|Youth_Centre|Colegio_Salesianos|Shrine_at_Matunga|Main_building|Building_of_Don|cabeceraInterior|youth_focus\.jpg|education\.jpg|donboscosouthasia|Mabalact|High_School|Matunga_Mumbai|Lasallian|San_Lorenzo_John_Bosco_Parish|dbu-graduation|Academic.?Block.?II|don.?bosco.?university.*graduat/i

export function isBlockedHomeImage(url) {
  if (!url || typeof url !== 'string') return true
  return BLOCKED_IMAGE_RE.test(url)
}

export function isUsableDynamicSlideImage(url) {
  if (!url || typeof url !== 'string') return false
  if (isBlockedHomeImage(url)) return false
  const u = url.trim()
  if (u.startsWith('/images/') && IMAGE_URL_RE.test(u)) return true
  if (!/^https?:\/\//i.test(u)) return false
  if (/\.(pdf|docx?|xlsx?|zip|mp4|webm)(\?|#|$)/i.test(u)) return false
  return IMAGE_URL_RE.test(u) || /\/images?\//i.test(u) || /thumbnail|photo|media/i.test(u)
}

export function staticHeroSlideMetaAt(index) {
  return HOME_HERO_STATIC_SLIDES[index % HOME_HERO_STATIC_SLIDES.length]
}

export function staticHeroImageAt(index) {
  return staticHeroSlideMetaAt(index).url
}

export function heroSlideImageSrc(slide, index) {
  const dynamic = slide?.bg || slide?.image
  if (isUsableDynamicSlideImage(dynamic) && HOME_HERO_STATIC_IMAGES.includes(dynamic.trim())) {
    return dynamic.trim()
  }
  return staticHeroImageAt(index)
}

export function applyHeroSlideImages(slides, opts = {}) {
  if (!Array.isArray(slides) || !slides.length) return slides
  const preferStatic = opts.preferStaticTheme !== false
  return slides.map((s, i) => {
    const meta = staticHeroSlideMetaAt(i)
    const bg = preferStatic ? meta.url : heroSlideImageSrc(s, i)
    return {
      ...s,
      bg,
      bgPos: preferStatic ? meta.bgPos : s.bgPos || meta.bgPos || 'center center',
      imageAlt: s.imageAlt || meta.alt,
    }
  })
}

