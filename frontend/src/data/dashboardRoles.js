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
    name: 'Library viewer',
    label: '👁 Library viewer',
    av: 'V',
  },
  admin: {
    name: 'Administrator',
    label: '🛡 Platform administrator',
    av: 'A',
  },
  editor: {
    name: 'Editor',
    label: '✏️ Department editor',
    av: 'E',
  },
  liaison: {
    name: 'Liaison',
    label: '🌐 Provincial liaison',
    av: 'L',
  },
  registered: {
    name: 'Member',
    label: '🎓 Member',
    av: 'M',
  },
  public: {
    name: 'Guest',
    label: '👤 Guest',
    av: 'G',
  },
}

/** KPI strip per role (first four from HTML wireframe) */
export const ROLE_STATS = {
  rector_major: [
    { icon: '🌍', bg: '#fef3c7', val: '92', lbl: 'Salesian provinces', tr: 'Congregation scope' },
    { icon: '📚', bg: '#d1fae5', val: '12,847', lbl: 'Total resources', tr: '+12% this month' },
    { icon: '📅', bg: '#eef5fc', val: '0', lbl: 'Events listed', tr: 'Calendar not connected' },
    { icon: '🏛', bg: '#ede9fe', val: '0', lbl: 'Mission locations', tr: 'Countries in corpus' },
  ],
  provincial: [
    { icon: '📚', bg: '#fef3c7', val: '—', lbl: 'Resources in scope', tr: 'Region-scoped' },
    { icon: '📈', bg: '#d1fae5', val: '—', lbl: 'Analytics', tr: 'Dashboards (read-only)' },
    { icon: '🗂', bg: '#eef5fc', val: '—', lbl: 'Collections', tr: 'Curated' },
    { icon: '📍', bg: '#ede9fe', val: '—', lbl: 'Your region', tr: 'From your profile' },
  ],
  viewer: [
    { icon: '📚', bg: '#fef3c7', val: '12,847', lbl: 'Resources available', tr: '+12%' },
    { icon: '📂', bg: '#d1fae5', val: '47', lbl: 'Saved items', tr: 'My library' },
    { icon: '✦', bg: '#eef5fc', val: '23', lbl: 'AI queries', tr: 'This month' },
    { icon: '👁', bg: '#ede9fe', val: '—', lbl: 'Analytics', tr: 'Not enabled for this role' },
  ],
  admin: [
    { icon: '🌍', bg: '#fef3c7', val: '92', lbl: 'Salesian provinces', tr: 'Congregation scope' },
    { icon: '📚', bg: '#d1fae5', val: '12,847', lbl: 'Total resources', tr: '+12% this month' },
    { icon: '📅', bg: '#eef5fc', val: '0', lbl: 'Events listed', tr: 'Calendar not connected' },
    { icon: '🏛', bg: '#ede9fe', val: '0', lbl: 'Mission locations', tr: 'Countries in corpus' },
  ],
  editor: [
    { icon: '📝', bg: '#fef3c7', val: '234', lbl: 'Resources curated', tr: '+28 this month' },
    { icon: '🗂', bg: '#d1fae5', val: '12', lbl: 'Collections managed', tr: 'Youth Ministry' },
    { icon: '⏳', bg: '#fee2e2', val: '8', lbl: 'Awaiting review', tr: 'Action needed' },
    { icon: '🌍', bg: '#eef5fc', val: '14', lbl: 'Regions contributed', tr: 'This quarter' },
  ],
  liaison: [
    { icon: '⬆️', bg: '#fef3c7', val: '18', lbl: 'Submitted this month', tr: '+6' },
    { icon: '✅', bg: '#d1fae5', val: '5', lbl: 'Pending validation', tr: 'Action needed' },
    { icon: '📊', bg: '#eef5fc', val: '94%', lbl: 'Metadata compliance', tr: '+2%' },
    { icon: '🏅', bg: '#ede9fe', val: 'South Asia', lbl: 'Region', tr: 'Your province' },
  ],
  registered: [
    { icon: '📚', bg: '#fef3c7', val: '12,847', lbl: 'Resources available', tr: '+12%' },
    { icon: '📂', bg: '#d1fae5', val: '47', lbl: 'Saved items', tr: 'My library' },
    { icon: '✦', bg: '#eef5fc', val: '23', lbl: 'AI queries', tr: 'This month' },
    { icon: '🌐', bg: '#ede9fe', val: '3', lbl: 'Languages', tr: 'EN, IT, ES' },
  ],
  public: [
    { icon: '📚', bg: '#fef3c7', val: '10,000+', lbl: 'Open resources', tr: '+5%' },
    { icon: '🏛', bg: '#d1fae5', val: '10', lbl: 'Institutions', tr: 'Global' },
    { icon: '📅', bg: '#eef5fc', val: '10,523', lbl: 'Events', tr: 'Live' },
    { icon: '🌐', bg: '#ede9fe', val: '5', lbl: 'Languages', tr: 'EN+' },
  ],
}
