/** @typedef {{ href: string, title: string, url: string }} FooterHrefLink */
/** @typedef {{ badge: string, title: string, url: string, href: string, badgeClass?: string }} FooterProvince */

/** @type {FooterHrefLink[]} */
export const footerQuickLinks = [
  {
    href: 'https://www.donboscosouthasia.org',
    title: 'Don Bosco South Asia',
    url: 'South Asia regional site',
  },
  {
    href: 'https://www.sdb.org',
    title: 'Salesians of Don Bosco',
    url: 'Worldwide congregation',
  },
  {
    href: 'https://www.sdb.org/en/who-we-are/becoming-a-salesian',
    title: 'Becoming a Salesian',
    url: 'Worldwide site · vocations',
  },
  {
    href: 'https://www.donboscosouthasia.org/SocialMediaIndex',
    title: 'Social Media Index',
    url: 'South Asia · social channels',
  },
  {
    href: 'https://www.subscribepage.com/donboscosouthasia',
    title: 'Subscribe Newsletter',
    url: 'Email updates',
  },
  {
    href: 'https://donboscosouthasia.org/Catalogue-List?category=all',
    title: 'Resource Catalogue',
    url: 'South Asia · full catalogue',
  },
  {
    href: 'https://open.spotify.com/show/6xwGk1B4ccKPhzpi4sjpSg',
    title: 'Podcast: Don Bosco in a Year',
    url: 'Streaming · 365 episodes',
  },
  {
    href: 'https://infoans.org/en/',
    title: 'Salesian News Agency',
    url: 'International Salesian news',
  },
]

/**
 * Public home footer "Discover" column and About → Official websites (href set aligned with `footerQuickLinks`).
 * @type {{ label: string, href: string, badge?: string }[]}
 */
export const publicDiscoverLinks = [
  { label: 'Salesian News Agency', href: 'https://infoans.org/en/' },
  { label: 'Resource Catalogue', href: 'https://donboscosouthasia.org/Catalogue-List?category=all' },
  {
    label: 'Don Bosco in a Year',
    href: 'https://open.spotify.com/show/6xwGk1B4ccKPhzpi4sjpSg',
    badge: 'PODCAST',
  },
  { label: 'Becoming a Salesian', href: 'https://www.sdb.org/en/who-we-are/becoming-a-salesian' },
  { label: 'Social Media Index', href: 'https://www.donboscosouthasia.org/SocialMediaIndex' },
]

/**
 * Public home footer "Network" column (href set aligned with `footerGlobalLinks`).
 * @type {{ label: string, href: string }[]}
 */
export const publicNetworkFooterLinks = [
  { label: 'Salesians of Don Bosco', href: 'https://www.sdb.org' },
  { label: 'FMA · Daughters of Mary', href: 'https://www.cgfmanet.org/' },
  { label: 'Salesian Family · Cooperators', href: 'https://famigliasalesiana.org/en' },
  { label: 'IUS · Universities', href: 'https://ius-sdb.com/' },
  { label: 'Past Pupils · Exallievi', href: 'http://www.exallievi.org/' },
]

/** @type {FooterProvince[]} */
export const footerProvinces = [
  {
    badge: 'INK',
    href: 'https://dbbangalore.org',
    title: 'Bangalore Province',
    url: 'dbbangalore.org · Fr. Jose Koyickal',
  },
  {
    badge: 'INM',
    href: 'https://www.donboscochennai.org',
    title: 'Chennai Province',
    url: 'donboscochennai.org · Fr. Don Bosco Lourdusamy',
  },
  {
    badge: 'IND',
    href: 'https://www.donboscodimapur.org',
    title: 'Dimapur Province',
    url: 'donboscodimapur.org · Fr. Joseph Pampackal',
  },
  {
    badge: 'ING',
    href: 'https://donboscoguwahati.org',
    title: 'Guwahati Province',
    url: 'donboscoguwahati.org · Fr. Sebastian Kuricheal',
  },
  {
    badge: 'INH',
    href: 'https://www.donboscohyderabad.org',
    title: 'Hyderabad Province',
    url: 'donboscohyderabad.org · Fr. Thomas Santhiagu',
  },
  {
    badge: 'INC',
    href: 'https://www.donboscosouthasia.org/Provinces/Kolkata-Province',
    title: 'Kolkata Province',
    url: 'donboscosouthasia.org · Fr. Sunil Kerketta',
  },
  {
    badge: 'INB',
    href: 'https://www.sdbinb.in',
    title: 'Mumbai Province',
    url: 'Mumbai province site · Fr. Ashley Miranda',
  },
  {
    badge: 'INN',
    href: 'https://www.donboscosouthasia.org/Provinces/New-Delhi-Province',
    title: 'New Delhi Province',
    url: 'donboscosouthasia.org · Fr. Davis Maniparamben',
  },
  {
    badge: 'INP',
    href: 'https://sdbpanjim.org',
    title: 'Panjim Province',
    url: 'Panjim province site · Fr. Clive Justin Telles',
  },
  {
    badge: 'INS',
    href: 'https://donboscoshillong.org',
    title: 'Shillong Province',
    url: 'donboscoshillong.org · Fr. John Zosiama',
  },
  {
    badge: 'INT',
    href: 'https://www.donboscotiruchy.org',
    title: 'Tiruchy Province',
    url: 'donboscotiruchy.org · Fr. Doss Kennedy',
  },
  {
    badge: 'LKC',
    badgeClass: 'bg-orange-text',
    href: 'https://www.donbosco.lk',
    title: 'Sri Lanka Vice Province',
    url: 'donbosco.lk · Fr. Roshan Miranda',
  },
]

/** @type {FooterHrefLink[]} */
export const footerRegionalNetworks = [
  {
    href: 'https://www.donboscosouthasia.org/What-we-do/Youth-Focus/Salesian-youth-movement',
    title: 'Don Bosco Youth Animation',
    url: 'Youth animation · Chennai province',
  },
  {
    href: 'https://donboscoschoolsindia.in',
    title: 'Don Bosco Schools India',
    url: 'donboscoschoolsindia.in · 261 schools',
  },
  {
    href: 'https://dbhei.org',
    title: 'DB Higher Education India',
    url: 'Higher education network · 51 colleges',
  },
  {
    href: 'https://www.donboscosouthasia.org/What-we-do/Youth-Focus/Young-at-risk',
    title: 'Young at Risk Forum',
    url: 'donboscosouthasia.org · 174 centres',
  },
  {
    href: 'http://www.donboscojobs.org',
    title: 'Don Bosco Job Placement Network',
    url: 'donboscojobs.org · JPN India',
  },
  {
    href: 'https://dbtech.in/',
    title: 'Don Bosco Technical network',
    url: 'dbtech.in · 138 institutes',
  },
  {
    href: 'https://dbcic.org/',
    title: 'Don Bosco Indigenous Cultures',
    url: 'North East India · cultural centre',
  },
  {
    href: 'https://www.donboscosouthasia.org/What-we-do/Youth-Focus/Boarding-and-Hostels',
    title: 'Don Bosco Renewal Centre',
    url: 'Young people programme · 192 hostels',
  },
  {
    href: 'https://www.bosconet.in/',
    title: 'Don Bosco Network',
    url: 'National network · Panjim province',
  },
  {
    href: 'https://www.donboscosouthasia.org/What-we-do/Social-Communication',
    title: 'Don Bosco Communications',
    url: 'Communications · 18 centres · Mumbai',
  },
  {
    href: 'https://www.donboscosouthasia.org',
    title: 'Child Friendly Cities',
    url: 'donboscosouthasia.org',
  },
]

/** @type {FooterHrefLink[]} */
export const footerGlobalLinks = [
  { href: 'https://www.sdb.org', title: 'Salesians of Don Bosco', url: 'Worldwide congregation' },
  { href: 'https://infoans.org/en/', title: 'Salesian news service', url: 'International agency' },
  {
    href: 'https://www.donboscogreen.org/',
    title: 'Don Bosco Green Alliance',
    url: 'donboscogreen.org · Ecology',
  },
  {
    href: 'https://famigliasalesiana.org/en',
    title: 'Salesian Family',
    url: 'famigliasalesiana.org · 32 groups',
  },
  { href: 'https://www.cgfmanet.org/', title: 'FMA (Daughters of Mary)', url: 'cgfmanet.org' },
  {
    href: 'https://ius-sdb.com/',
    title: 'International Union of Salesian Universities',
    url: 'Worldwide university network',
  },
  {
    href: 'https://www.admadonbosco.org/',
    title: 'ADMA · Salesian Cooperators',
    url: 'admadonbosco.org',
  },
  { href: 'http://www.exallievi.org/', title: 'Past Pupils (Exallievi)', url: 'exallievi.org' },
  { href: 'https://www.bosco.link/', title: 'Bosco Link · Austral Asia', url: 'bosco.link' },
]
