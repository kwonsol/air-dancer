// ── STORAGE ───────────────────────────────────────────────────────────────────
// Persists dancer configs to localStorage.
// Pre-populates the gallery with sample dancers so it's never empty.

const STORAGE_KEY   = 'airDancer_dancers_v2';
const CURRENT_KEY   = 'airDancer_current';

const SAMPLE_DANCERS = [
  {
    id: 'sample_001', name: 'DANCER #001',
    colorIndex: 0, headStyle: 0, faceStyle: 0,
    decoration: 1, hatStyle: 2, bodyText: 'DANCE',
    x: 180, isSample: true
  },
  {
    id: 'sample_002', name: 'DANCER #002',
    colorIndex: 1, headStyle: 1, faceStyle: 2,
    decoration: 3, hatStyle: 0, bodyText: 'YEAH',
    x: 420, isSample: true
  },
  {
    id: 'sample_003', name: 'DANCER #003',
    colorIndex: 2, headStyle: 2, faceStyle: 1,
    decoration: 2, hatStyle: 3, bodyText: 'FLEX',
    x: 660, isSample: true
  },
  {
    id: 'sample_004', name: 'DANCER #004',
    colorIndex: 5, headStyle: 3, faceStyle: 4,
    decoration: 4, hatStyle: 1, bodyText: 'WOW',
    x: 900, isSample: true
  },
  {
    id: 'sample_005', name: 'DANCER #005',
    colorIndex: 7, headStyle: 4, faceStyle: 3,
    decoration: 5, hatStyle: 4, bodyText: '',
    x: 1140, isSample: true
  },
];

const DancerStorage = {
  // ── USER DANCERS ──────────────────────────────────────────────────────────

  loadUserDancers() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  saveUserDancers(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (e) { console.error('[Storage] save failed', e); }
  },

  getAllDancers() {
    return [...SAMPLE_DANCERS, ...this.loadUserDancers()];
  },

  addDancer(config) {
    const users  = this.loadUserDancers();
    const num    = SAMPLE_DANCERS.length + users.length + 1;
    const dancer = {
      ...config,
      id:        'user_' + Date.now(),
      name:      config.name || ('DANCER #' + String(num).padStart(3, '0')),
      x:         config.x ?? (1400 + users.length * 240),
      isSample:  false,
      createdAt: Date.now(),
    };
    users.push(dancer);
    this.saveUserDancers(users);
    return dancer;
  },

  updatePosition(id, x) {
    const users = this.loadUserDancers();
    const idx   = users.findIndex(d => d.id === id);
    if (idx >= 0) { users[idx].x = x; this.saveUserDancers(users); }
  },

  removeDancer(id) {
    const users = this.loadUserDancers().filter(d => d.id !== id);
    this.saveUserDancers(users);
  },

  // ── CURRENT (work-in-progress) DANCER ─────────────────────────────────────

  getCurrent() {
    try {
      const raw = sessionStorage.getItem(CURRENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  setCurrent(config) {
    try { sessionStorage.setItem(CURRENT_KEY, JSON.stringify(config)); }
    catch (e) { console.error('[Storage] setCurrent failed', e); }
  },

  clearCurrent() {
    sessionStorage.removeItem(CURRENT_KEY);
  },
};
