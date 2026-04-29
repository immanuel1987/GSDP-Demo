/** Top bar titles — same keys as reference HTML `showPage` */
export const DASHBOARD_PAGE_TITLES = {
  dashboard: 'Dashboard',
  resources: 'Resource Library',
  collections: 'Collections',
  institutions: 'Pastoral Works',
  networks: 'Salesian Networks',
  events: 'Events',
  persons: 'Persons Directory',
  ai: 'AI Assistant',
  owl: 'OWL Ontology Update',
  analytics: 'Analytics & Platform Insights',
  governance: 'Governance & Policy',
  access: 'Access Control',
}

/** Which app pages each role may open — aligned with reference HTML `ROLES.*.pages` */
export const ROLE_PAGES = {
  public: ['dashboard', 'resources', 'collections', 'institutions', 'networks', 'events'],
  registered: [
    'dashboard',
    'resources',
    'collections',
    'institutions',
    'networks',
    'events',
    'persons',
    'ai',
  ],
  liaison: [
    'dashboard',
    'resources',
    'collections',
    'institutions',
    'networks',
    'events',
    'persons',
    'ai',
    'owl',
  ],
  editor: [
    'dashboard',
    'resources',
    'collections',
    'institutions',
    'networks',
    'events',
    'persons',
    'ai',
    'owl',
    'analytics',
  ],
  admin: [
    'dashboard',
    'resources',
    'collections',
    'institutions',
    'networks',
    'events',
    'persons',
    'ai',
    'owl',
    'analytics',
    'governance',
    'access',
  ],
  /** Congregation-wide: same module list as admin (all data, analytics, governance). */
  rector_major: [
    'dashboard',
    'resources',
    'collections',
    'institutions',
    'networks',
    'events',
    'persons',
    'ai',
    'owl',
    'analytics',
    'governance',
    'access',
  ],
  /** Province / region scope: discover + analytics (read-only dashboards); no governance, access, OWL. */
  provincial: [
    'dashboard',
    'resources',
    'collections',
    'institutions',
    'networks',
    'events',
    'persons',
    'ai',
    'analytics',
  ],
  /** Read-only browse: same as registered — no analytics, OWL, governance, or access admin. */
  viewer: [
    'dashboard',
    'resources',
    'collections',
    'institutions',
    'networks',
    'events',
    'persons',
    'ai',
  ],
}

/** Routes reachable via quick actions etc. but not listed in the sidebar — reference HTML behaviour */
export const ROLE_EXTRA_ROUTES = {
  liaison: ['analytics'],
}

/** All dashboard module ids a role may open (includes `ROLE_EXTRA_ROUTES` where defined). */
export function allowedPageIdsForRoleKey(roleKey) {
  const base = ROLE_PAGES[roleKey] || ROLE_PAGES.registered
  const extra = ROLE_EXTRA_ROUTES[roleKey] || []
  return new Set([...base, ...extra])
}

/** Ontology / admin sidebar sections — reference uses `canV || canA` */
export const ROLE_FLAGS = {
  public: { canV: false, canA: false },
  registered: { canV: false, canA: false },
  liaison: { canV: true, canA: false },
  editor: { canV: true, canA: false },
  admin: { canV: true, canA: true },
  rector_major: { canV: true, canA: true },
  provincial: { canV: false, canA: false },
  viewer: { canV: false, canA: false },
}

/**
 * Platform-wide KPI row on dashboard home (static in reference HTML before `#stats-row`).
 */
export const PLATFORM_KPI_STRIP = [
  {
    icon: '📚',
    bg: '#fef3c7',
    trend: '+12%',
    val: '12,847',
    lbl: 'Total Resources',
    orangeTop: true,
  },
  {
    icon: '🏛',
    bg: '#d1fae5',
    trend: '+3%',
    val: '7,240',
    lbl: 'Institutions',
    orangeTop: false,
  },
  {
    icon: '📅',
    bg: '#eef5fc',
    trend: '+8%',
    val: '174',
    lbl: 'YaR Centres',
    orangeTop: false,
  },
  {
    icon: '✦',
    bg: '#fef3c7',
    trend: '+41%',
    val: '3,891',
    lbl: 'AI Queries/Mo',
    orangeTop: true,
  },
]

/** Activity feed — `html` matches reference copy (trusted static strings). */
export const ROLE_ACTIVITY = {
  rector_major: [
    {
      dot: 'dot-green',
      html: '<strong>System:</strong> 47 new resources indexed into Gold Layer overnight',
      time: '2 hours ago',
    },
    {
      dot: 'dot-blue',
      html: '<strong>CristO–Religio sync</strong> completed — 23 institutions updated',
      time: '4 hours ago',
    },
    {
      dot: 'dot-gold',
      html: '<strong>Province INS</strong> submitted 18 resources — 5 pending validation',
      time: '6 hours ago',
    },
    {
      dot: 'dot-red',
      html: '<strong>Compliance alert:</strong> Province BGS — metadata below 80%',
      time: 'Yesterday',
    },
  ],
  provincial: [
    {
      dot: 'dot-gold',
      html: '<strong>Province report:</strong> new pastoral resources awaiting your review',
      time: '2 hours ago',
    },
    {
      dot: 'dot-blue',
      html: '<strong>Regional collection</strong> updated for your territory',
      time: 'Yesterday',
    },
    {
      dot: 'dot-green',
      html: '<strong>Published:</strong> formation materials shared with your province',
      time: '2 days ago',
    },
  ],
  admin: [
    {
      dot: 'dot-green',
      html: '<strong>System:</strong> 47 new resources indexed into Gold Layer overnight',
      time: '2 hours ago',
    },
    {
      dot: 'dot-blue',
      html: '<strong>CristO–Religio sync</strong> completed — 23 institutions updated',
      time: '4 hours ago',
    },
    {
      dot: 'dot-gold',
      html: '<strong>Province INS</strong> submitted 18 resources — 5 pending validation',
      time: '6 hours ago',
    },
    {
      dot: 'dot-red',
      html: '<strong>Compliance alert:</strong> Province BGS — metadata below 80%',
      time: 'Yesterday',
    },
  ],
  editor: [
    {
      dot: 'dot-gold',
      html: '<strong>Approved:</strong> "Youth Ministry Toolkit 2025 — Africa" → Gold Layer',
      time: '1 hour ago',
    },
    {
      dot: 'dot-blue',
      html: 'New collection: <strong>"Preventive System Resources 2025"</strong>',
      time: '3 hours ago',
    },
    {
      dot: 'dot-red',
      html: '<strong>Rejected:</strong> "INK Province Report" — incomplete taxonomy',
      time: '5 hours ago',
    },
  ],
  liaison: [
    {
      dot: 'dot-gold',
      html: '<strong>Validation needed:</strong> "INS Annual Youth Report 2025"',
      time: '30 min ago',
    },
    {
      dot: 'dot-blue',
      html: 'AI tagged metadata for: <strong>"Oratory Guidelines — INS Province"</strong>',
      time: '2 hours ago',
    },
    {
      dot: 'dot-green',
      html: 'Published: <strong>"Catechesis Workshop Materials 2025"</strong>',
      time: 'Yesterday',
    },
  ],
  viewer: [
    {
      dot: 'dot-blue',
      html: '<strong>Browse mode:</strong> resources and directories — analytics and admin tools are not enabled for your role',
      time: 'Just now',
    },
    {
      dot: 'dot-green',
      html: 'You viewed: <strong>"Preventive System in Digital Age"</strong>',
      time: '1 hour ago',
    },
    {
      dot: 'dot-gold',
      html: 'Saved: <strong>"Youth at Risk Pastoral Guide — Africa 2024"</strong>',
      time: 'Yesterday',
    },
  ],
  registered: [
    {
      dot: 'dot-blue',
      html: 'You viewed: <strong>"Preventive System in Digital Age"</strong> — Summarized via AI',
      time: '1 hour ago',
    },
    {
      dot: 'dot-green',
      html: 'Saved: <strong>"Youth at Risk Pastoral Guide — Africa 2024"</strong>',
      time: '3 hours ago',
    },
    {
      dot: 'dot-gold',
      html: 'Translation requested: <strong>"Missione Salesiana 2025"</strong> → English',
      time: 'Yesterday',
    },
  ],
  public: [
    {
      dot: 'dot-blue',
      html: '<strong>New resource</strong> published: "Youth Ministry Annual Report 2025 — South Asia"',
      time: '2 hours ago',
    },
    {
      dot: 'dot-green',
      html: '<strong>Event added:</strong> World Youth Day 2026 — Rome, Italy',
      time: '5 hours ago',
    },
    {
      dot: 'dot-gold',
      html: '<strong>Collection updated:</strong> Formation Materials — FMA 2025',
      time: 'Yesterday',
    },
  ],
}

/** Quick actions — `page` is dashboard sub-route key */
export const ROLE_QUICK_ACTIONS = {
  rector_major: [
    { icon: '⚖️', t: 'Governance', s: 'Policy & audit', page: 'governance' },
    { icon: '📈', t: 'Analytics', s: 'Global dashboards', page: 'analytics' },
    { icon: '📅', t: 'Events', s: 'Global calendar', page: 'events' },
    { icon: '🏛', t: 'Pastoral Works', s: 'Institution map', page: 'institutions' },
  ],
  provincial: [
    { icon: '📚', t: 'Resource Library', s: 'Your region', page: 'resources' },
    { icon: '📈', t: 'Analytics', s: 'Regional dashboards', page: 'analytics' },
    { icon: '🗂', t: 'Collections', s: 'Curated paths', page: 'collections' },
    { icon: '✦', t: 'AI Assistant', s: 'Semantic search', page: 'ai' },
  ],
  viewer: [
    { icon: '✦', t: 'AI Search', s: 'Semantic query', page: 'ai' },
    { icon: '📚', t: 'My Library', s: 'Saved resources', page: 'resources' },
    { icon: '👥', t: 'Find Authors', s: 'Person directory', page: 'persons' },
    { icon: '📅', t: 'Events', s: 'Upcoming', page: 'events' },
  ],
  admin: [
    { icon: '⚖️', t: 'Governance', s: 'Policy & audit', page: 'governance' },
    { icon: '📈', t: 'Analytics', s: 'Global dashboards', page: 'analytics' },
    { icon: '📅', t: 'Events', s: 'Global calendar', page: 'events' },
    { icon: '🏛', t: 'Pastoral Works', s: 'Institution map', page: 'institutions' },
  ],
  editor: [
    { icon: '✅', t: 'Review Submissions', s: 'Check recent content', page: 'resources' },
    { icon: '🗂', t: 'Edit Collections', s: 'Curated sets', page: 'collections' },
    { icon: '🦉', t: 'OWL Update', s: 'Ontology pipeline', page: 'owl' },
    { icon: '📈', t: 'Dept. Stats', s: 'Usage analytics', page: 'analytics' },
  ],
  liaison: [
    { icon: '🦉', t: 'Trigger OWL Update', s: 'Update ontology', page: 'owl' },
    { icon: '📚', t: 'My Submissions', s: 'Track status', page: 'resources' },
    { icon: '📊', t: 'Province Report', s: 'Contribution stats', page: 'analytics' },
    { icon: '📅', t: 'Events', s: 'Upcoming', page: 'events' },
  ],
  registered: [
    { icon: '✦', t: 'AI Search', s: 'Semantic query', page: 'ai' },
    { icon: '📚', t: 'My Library', s: 'Saved resources', page: 'resources' },
    { icon: '👥', t: 'Find Authors', s: 'Person directory', page: 'persons' },
    { icon: '📅', t: 'Events', s: 'Upcoming', page: 'events' },
  ],
  public: [
    { icon: '🔍', t: 'Browse Resources', s: 'Explore the library', page: 'resources' },
    { icon: '🗂', t: 'Collections', s: 'Curated paths', page: 'collections' },
    { icon: '🏛', t: 'Pastoral Works', s: 'Find institutions', page: 'institutions' },
    { icon: '📅', t: 'Events', s: 'Global calendar', page: 'events' },
  ],
}

/** Pending queue (reference HTML) — shown when `canV` */
export const PENDING_ITEMS = [
  {
    icon: '📄',
    title: 'INS Annual Youth Report 2025',
    meta: 'Province INS · 30 min ago',
    status: 'Pending',
    statusClass: 'bg-amber-100 text-amber-900',
  },
  {
    icon: '📋',
    title: 'Oratory Best Practices — Brazil',
    meta: 'Metadata: 94% complete',
    status: 'In Review',
    statusClass: 'bg-sky-100 text-sky-900',
  },
  {
    icon: '🎬',
    title: 'FMA Documentary 2025',
    meta: 'AI-tagged · awaiting approval',
    status: 'In Review',
    statusClass: 'bg-sky-100 text-sky-900',
  },
]
