/** Display fields per role — aligned with reference HTML `ROLES` */
export const ROLE_DISPLAY = {
  rector_major: {
    name: 'Rector Major',
    label: '🌐 Rector Major',
    av: 'RM',
  },
  provincial: {
    name: 'Provincial',
    label: '📍 Provincial',
    av: 'P',
  },
  viewer: {
    name: 'Viewer',
    label: '👁 Dashboard viewer',
    av: 'V',
  },
  admin: {
    name: "Rev. Fr. Paul D'Souza",
    label: '🛡 Generalate Administrator',
    av: 'P',
  },
  editor: {
    name: 'Sr. Lucia Ferraro',
    label: '✏️ Department Editor',
    av: 'L',
  },
  liaison: {
    name: 'Bro. James Rodrigues',
    label: '🌐 Provincial Liaison',
    av: 'J',
  },
  registered: {
    name: 'Fr. Thomas Antony',
    label: '🎓 Registered User',
    av: 'T',
  },
  public: {
    name: 'Public User',
    label: '👤 Public Viewer',
    av: 'P',
  },
}

/** KPI strip per role (first four from HTML wireframe) */
export const ROLE_STATS = {
  rector_major: [
    { icon: '🌍', bg: '#fef3c7', val: '92', lbl: 'Provinces Active', tr: 'Full coverage' },
    { icon: '📚', bg: '#d1fae5', val: '12,847', lbl: 'Total Resources', tr: '+12% this month' },
    { icon: '📅', bg: '#eef5fc', val: '10,523', lbl: 'Events Indexed', tr: 'ANS + Provinces' },
    { icon: '🏛', bg: '#ede9fe', val: '7,240', lbl: 'Institutions Mapped', tr: 'CristO–Religio' },
  ],
  provincial: [
    { icon: '📚', bg: '#fef3c7', val: '—', lbl: 'Resources in scope', tr: 'Region-scoped' },
    { icon: '📈', bg: '#d1fae5', val: '—', lbl: 'Analytics', tr: 'Dashboards (read-only)' },
    { icon: '🗂', bg: '#eef5fc', val: '—', lbl: 'Collections', tr: 'Curated' },
    { icon: '📍', bg: '#ede9fe', val: '—', lbl: 'Your region', tr: 'From your profile' },
  ],
  viewer: [
    { icon: '📚', bg: '#fef3c7', val: '12,847', lbl: 'Resources Available', tr: '+12%' },
    { icon: '📂', bg: '#d1fae5', val: '47', lbl: 'Saved Items', tr: 'My Library' },
    { icon: '✦', bg: '#eef5fc', val: '23', lbl: 'AI Queries', tr: 'This month' },
    { icon: '👁', bg: '#ede9fe', val: '—', lbl: 'Analytics', tr: 'Not enabled for viewer' },
  ],
  admin: [
    { icon: '🌍', bg: '#fef3c7', val: '92', lbl: 'Provinces Active', tr: 'Full coverage' },
    { icon: '📚', bg: '#d1fae5', val: '12,847', lbl: 'Total Resources', tr: '+12% this month' },
    { icon: '📅', bg: '#eef5fc', val: '10,523', lbl: 'Events Indexed', tr: 'ANS + Provinces' },
    { icon: '🏛', bg: '#ede9fe', val: '7,240', lbl: 'Institutions Mapped', tr: 'CristO–Religio' },
  ],
  editor: [
    { icon: '📝', bg: '#fef3c7', val: '234', lbl: 'Resources Curated', tr: '+28 this month' },
    { icon: '🗂', bg: '#d1fae5', val: '12', lbl: 'Collections Managed', tr: 'Youth Ministry' },
    { icon: '⏳', bg: '#fee2e2', val: '8', lbl: 'Awaiting Review', tr: 'Action needed' },
    { icon: '🌍', bg: '#eef5fc', val: '14', lbl: 'Regions Contributed', tr: 'This quarter' },
  ],
  liaison: [
    { icon: '⬆️', bg: '#fef3c7', val: '18', lbl: 'Submitted This Month', tr: '+6' },
    { icon: '✅', bg: '#d1fae5', val: '5', lbl: 'Pending Validation', tr: 'Action needed' },
    { icon: '📊', bg: '#eef5fc', val: '94%', lbl: 'Metadata Compliance', tr: '+2%' },
    { icon: '🏅', bg: '#ede9fe', val: 'South Asia', lbl: 'Region', tr: 'INS Province' },
  ],
  registered: [
    { icon: '📚', bg: '#fef3c7', val: '12,847', lbl: 'Resources Available', tr: '+12%' },
    { icon: '📂', bg: '#d1fae5', val: '47', lbl: 'Saved Items', tr: 'My Library' },
    { icon: '✦', bg: '#eef5fc', val: '23', lbl: 'AI Queries', tr: 'This month' },
    { icon: '🌐', bg: '#ede9fe', val: '3', lbl: 'Languages Active', tr: 'EN, IT, ES' },
  ],
  public: [
    { icon: '📚', bg: '#fef3c7', val: '10,000+', lbl: 'Public Resources', tr: '+5%' },
    { icon: '🏛', bg: '#d1fae5', val: '7,240', lbl: 'Institutions', tr: 'Global' },
    { icon: '📅', bg: '#eef5fc', val: '10,523', lbl: 'Events', tr: 'Live' },
    { icon: '🌐', bg: '#ede9fe', val: '5', lbl: 'Languages', tr: 'EN+' },
  ],
}
