/* ====================================================
   D-Day Counter — App Logic
   ==================================================== */

const MAX_EVENTS = 20;

/* ── Supabase ── */
const SUPABASE_URL = 'https://nluhqgaqvxxriwcqxxyk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sdWhxZ2Fxdnh4cml3Y3F4eHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNTQwNDQsImV4cCI6MjA5NjczMDA0NH0.bYcfs4eWp3v-tFLesQZJIfH0vFQi9pdp1JnOU9eTQm4';
let db = null;

function initSupabase() {
  if (window.supabase) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}

async function loadEventsFromDB() {
  if (!db) return false;
  try {
    const { data, error } = await db
      .from('dday_events')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    state.events = data.map(r => ({
      id: r.id,
      title: r.title,
      date: r.date,
      category: r.category,
      isAnnual: r.is_annual,
      createdAt: r.created_at,
    }));
    saveState();
    return true;
  } catch (e) {
    console.warn('Supabase 로드 실패, localStorage 사용:', e);
    return false;
  }
}

async function insertEventToDB(event) {
  if (!db) return;
  const { error } = await db.from('dday_events').insert({
    id: event.id,
    title: event.title,
    date: event.date,
    category: event.category,
    is_annual: event.isAnnual,
    created_at: event.createdAt,
  });
  if (error) console.error('Supabase insert 실패:', error);
}

async function removeEventFromDB(id) {
  if (!db) return;
  const { error } = await db.from('dday_events').delete().eq('id', id);
  if (error) console.error('Supabase delete 실패:', error);
}

const CATEGORIES = [
  { id: 'exam',        emoji: '📝', label: '시험' },
  { id: 'study',       emoji: '📚', label: '공부' },
  { id: 'birthday',    emoji: '🎂', label: '생일' },
  { id: 'anniversary', emoji: '💕', label: '기념일' },
  { id: 'travel',      emoji: '✈️', label: '여행' },
  { id: 'health',      emoji: '❤️', label: '건강' },
  { id: 'work',        emoji: '💼', label: '업무' },
  { id: 'meeting',     emoji: '🤝', label: '약속' },
  { id: 'holiday',     emoji: '🎉', label: '공휴일' },
  { id: 'sports',      emoji: '🏃', label: '운동' },
  { id: 'hobby',       emoji: '🎮', label: '취미' },
  { id: 'personal',    emoji: '⭐', label: '개인' },
];

/* ── State ── */
let state = {
  events: [],
  theme: 'system',
  sortBy: 'dday',
};

let deletingId = null;
let snackTimer = null;
let midnightTimer = null;

/* ── Persistence ── */
function loadState() {
  try {
    const raw = localStorage.getItem('dday-counter-v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.events = Array.isArray(parsed.events) ? parsed.events : [];
      state.theme = parsed.theme || 'system';
      state.sortBy = parsed.sortBy || 'dday';
    }
  } catch { /* ignore corrupt data */ }
}

function saveState() {
  localStorage.setItem('dday-counter-v1', JSON.stringify(state));
}

/* ── D-Day Calculation ── */
function getToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseLocalDate(str) {
  // "YYYY-MM-DD" → local midnight Date
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function computeDiff(event) {
  const today = getToday();
  let target = parseLocalDate(event.date);

  if (event.isAnnual) {
    const thisYear = today.getFullYear();
    target.setFullYear(thisYear);
    if (target < today) target.setFullYear(thisYear + 1);
  }

  return Math.round((target - today) / 86400000);
}

function formatDday(diff) {
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function getDdayColor(diff) {
  if (diff === 0) return 'var(--col-today)';
  if (diff < 0)  return 'var(--col-past)';
  if (diff <= 7) return 'var(--col-urgent)';
  if (diff <= 30) return 'var(--col-near)';
  return 'var(--col-far)';
}

function formatDisplayDate(dateStr, isAnnual) {
  if (isAnnual) {
    const [, m, d] = dateStr.split('-');
    return `매년 ${parseInt(m)}월 ${parseInt(d)}일`;
  }
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

/* ── Sort ── */
function sortedAndFiltered(query) {
  const q = query.trim().toLowerCase();
  let list = state.events.filter(e =>
    !q || e.title.toLowerCase().includes(q) || getCatLabel(e.category).includes(q)
  );

  if (state.sortBy === 'dday') {
    list.sort((a, b) => {
      const da = computeDiff(a), db = computeDiff(b);
      const absA = da < 0 ? Infinity : da;
      const absB = db < 0 ? Infinity : db;
      return absA - absB;
    });
  } else if (state.sortBy === 'recent') {
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (state.sortBy === 'oldest') {
    list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  } else if (state.sortBy === 'alpha') {
    list.sort((a, b) => a.title.localeCompare(b.title, 'ko'));
  }

  return list;
}

function getCatEmoji(id) {
  return CATEGORIES.find(c => c.id === id)?.emoji ?? '⭐';
}

function getCatLabel(id) {
  return CATEGORIES.find(c => c.id === id)?.label ?? '';
}

/* ── Render ── */
function render() {
  const query = document.getElementById('searchInput').value;
  const list = sortedAndFiltered(query);
  const grid = document.getElementById('cardGrid');
  const emptyEl = document.getElementById('emptyState');
  const noResultEl = document.getElementById('noResult');
  const limitMsg = document.getElementById('limitMsg');
  const fabBtn = document.getElementById('fabBtn');

  const hasEvents = state.events.length > 0;
  const maxReached = state.events.length >= MAX_EVENTS;

  limitMsg.hidden = !maxReached;
  fabBtn.disabled = maxReached;

  if (!hasEvents) {
    grid.innerHTML = '';
    emptyEl.hidden = false;
    noResultEl.hidden = true;
    return;
  }

  emptyEl.hidden = true;

  if (list.length === 0) {
    grid.innerHTML = '';
    noResultEl.hidden = false;
    return;
  }

  noResultEl.hidden = true;

  grid.innerHTML = list.map(event => {
    const diff = computeDiff(event);
    const ddayStr = formatDday(diff);
    const color = getDdayColor(diff);
    const emoji = getCatEmoji(event.category);
    const dateLabel = formatDisplayDate(event.date, event.isAnnual);
    const isToday = diff === 0;

    return `
      <article
        class="dday-card${isToday ? ' is-today' : ''}"
        role="listitem"
        style="--card-color: ${color}"
        data-id="${event.id}"
        aria-label="${event.title}, ${ddayStr}"
      >
        <div class="card-top">
          <div class="card-meta">
            <span class="card-cat-icon" aria-hidden="true">${emoji}</span>
            <span class="card-title">${escHtml(event.title)}</span>
          </div>
          <button
            class="card-delete icon-btn"
            aria-label="${escHtml(event.title)} 삭제"
            data-delete="${event.id}"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>

        <div class="card-dday" aria-label="${ddayStr}">${ddayStr}</div>

        <div class="card-bottom">
          <span class="card-date">${dateLabel}</span>
          <div class="card-badges">
            ${event.isAnnual ? '<span class="badge badge--annual" aria-label="매년 반복">↺ 매년</span>' : ''}
          </div>
        </div>
      </article>
    `.trim();
  }).join('');
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── Theme ── */
function applyTheme(theme) {
  const root = document.documentElement;
  const icon = document.getElementById('themeIcon');

  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    icon.textContent = '☀️';
  } else if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
    icon.textContent = '🌙';
  } else {
    root.removeAttribute('data-theme');
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    icon.textContent = isDark ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  const current = state.theme;
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
    (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

  state.theme = isDark ? 'light' : 'dark';
  applyTheme(state.theme);
  saveState();
}

/* ── Date Picker Helpers ── */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function updateDayOptions() {
  const daySelect = document.getElementById('daySelect');
  const year = parseInt(document.getElementById('yearInput').value) || new Date().getFullYear();
  const month = parseInt(document.getElementById('monthSelect').value);
  const prevDay = parseInt(daySelect.value) || 0;

  const max = month ? getDaysInMonth(year, month) : 31;
  daySelect.innerHTML = '<option value="">일</option>';
  for (let d = 1; d <= max; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${d}일`;
    if (d === prevDay) opt.selected = true;
    daySelect.appendChild(opt);
  }
}

function getDateValue() {
  const y = document.getElementById('yearInput').value.trim();
  const m = document.getElementById('monthSelect').value;
  const d = document.getElementById('daySelect').value;
  if (!y || !m || !d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function setDateInputs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  document.getElementById('yearInput').value = y;
  document.getElementById('monthSelect').value = m;
  updateDayOptions();
  document.getElementById('daySelect').value = d;
}

/* ── Modal ── */
function openModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modalTitle').textContent = 'D-Day 추가';
  document.getElementById('submitBtn').textContent = '추가하기';
  document.getElementById('ddayForm').reset();
  document.getElementById('charCount').textContent = '0 / 30';
  document.getElementById('titleInput').classList.remove('is-invalid');
  ['yearInput', 'monthSelect', 'daySelect'].forEach(id =>
    document.getElementById(id).classList.remove('is-invalid')
  );
  document.getElementById('titleError').hidden = true;
  document.getElementById('dateError').hidden = true;

  // Set default category to first
  const btns = document.querySelectorAll('.cat-btn');
  btns.forEach((b, i) => b.classList.toggle('active', i === 0));

  // Default date to today
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  setDateInputs(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);

  modal.hidden = false;
  requestAnimationFrame(() => document.getElementById('titleInput').focus());
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').hidden = true;
  document.body.style.overflow = '';
  document.getElementById('fabBtn').focus();
}

function openDeleteModal(id) {
  deletingId = id;
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  document.getElementById('deleteDesc').textContent = `"${ev.title}"을(를) 삭제할까요?`;
  document.getElementById('deleteModal').hidden = false;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => document.getElementById('deleteConfirmBtn').focus());
}

function closeDeleteModal() {
  document.getElementById('deleteModal').hidden = true;
  document.body.style.overflow = '';
  deletingId = null;
}

/* ── Category Picker ── */
function buildCatPicker() {
  const picker = document.getElementById('catPicker');
  picker.innerHTML = CATEGORIES.map((c, i) => `
    <button type="button" class="cat-btn${i === 0 ? ' active' : ''}" data-cat="${c.id}" role="radio" aria-checked="${i === 0 ? 'true' : 'false'}">
      <span aria-hidden="true">${c.emoji}</span> ${c.label}
    </button>
  `).join('');
}

function getSelectedCat() {
  return document.querySelector('.cat-btn.active')?.dataset.cat ?? CATEGORIES[0].id;
}

/* ── CRUD ── */
function addEvent({ title, date, category, isAnnual }) {
  if (state.events.length >= MAX_EVENTS) return;

  const newEvent = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    title: title.trim(),
    date,
    category,
    isAnnual,
    createdAt: Date.now(),
  };

  state.events.push(newEvent);
  saveState();
  render();
  showSnack(`"${title}" D-Day가 추가됐어요 ✅`);
  insertEventToDB(newEvent);

  if (computeDiff(newEvent) === 0) {
    setTimeout(() => FW.launch(title), 400);
  }
}

function deleteEvent(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  state.events = state.events.filter(e => e.id !== id);
  saveState();
  render();
  showSnack(`"${ev.title}"이(가) 삭제됐어요`);
  removeEventFromDB(id);
}

/* ── Export / Import ── */
function exportJSON() {
  if (!state.events.length) { showSnack('저장된 D-Day가 없어요'); return; }
  const blob = new Blob([JSON.stringify({ events: state.events }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dday-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showSnack('내보내기 완료 📦');
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.events)) throw new Error('invalid');
      const merged = [...state.events];
      let added = 0;
      for (const ev of data.events) {
        if (merged.length >= MAX_EVENTS) break;
        if (!ev.id || !ev.title || !ev.date) continue;
        if (merged.find(x => x.id === ev.id)) continue;
        merged.push(ev);
        added++;
      }
      state.events = merged;
      saveState();
      render();
      showSnack(`${added}개 D-Day를 가져왔어요 ✅`);
    } catch {
      showSnack('파일을 읽을 수 없어요. JSON 형식을 확인해주세요.');
    }
  };
  reader.readAsText(file);
}

/* ── Snackbar ── */
function showSnack(msg) {
  const el = document.getElementById('snackbar');
  document.getElementById('snackbarMsg').textContent = msg;
  el.hidden = false;
  clearTimeout(snackTimer);
  snackTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

/* ── Midnight Refresh ── */
function scheduleMidnight() {
  clearTimeout(midnightTimer);
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const ms = next - now + 1000;
  midnightTimer = setTimeout(() => {
    render();
    checkAndLaunchFireworks();
    scheduleMidnight();
  }, ms);
}

/* ══════════════════════════════════════════
   FIREWORKS ENGINE
══════════════════════════════════════════ */

const FIREWORK_COLORS = [
  '#ff6b6b', '#ffd700', '#4ecdc4', '#ff9f43', '#c44dff',
  '#7efff5', '#ff6bff', '#5ac8fa', '#30d158', '#ff453a',
  '#ff9ff3', '#54a0ff', '#5f27cd', '#01abc9',
];

const FW = {
  canvas: null,
  ctx: null,
  particles: [],
  rockets: [],
  animId: null,
  launchTimer: null,
  bannerTimer: null,

  init() {
    this.canvas = document.getElementById('fireworksCanvas');
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => {
      if (!this.canvas.hidden) this._resize();
    });
  },

  _resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  launch(eventTitle) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this._resize();
    this.canvas.hidden = false;
    this.particles = [];
    this.rockets = [];

    this._showBanner(eventTitle);

    let count = 0;
    clearInterval(this.launchTimer);
    this.launchTimer = setInterval(() => {
      this._spawnRocket();
      if (++count >= 12) clearInterval(this.launchTimer);
    }, 420);

    if (!this.animId) {
      this.animId = requestAnimationFrame(() => this._loop());
    }
  },

  _showBanner(title) {
    const banner = document.getElementById('ddayBanner');
    banner.innerHTML = `
      <div class="dday-banner-inner">
        <span class="dday-banner-emoji">🎉</span>
        <span class="dday-banner-title">D-Day!</span>
        <span class="dday-banner-subtitle">${title ? escHtml(title) + ' 오늘이에요!' : '오늘이 D-Day예요!'}</span>
      </div>
    `;
    banner.hidden = false;
    banner.style.animation = '';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => {
      banner.style.animation = 'banner-out 0.35s ease forwards';
      setTimeout(() => {
        banner.hidden = true;
        banner.style.animation = '';
      }, 360);
    }, 3200);
  },

  _spawnRocket() {
    const w = this.canvas.width, h = this.canvas.height;
    this.rockets.push({
      x: w * (0.1 + Math.random() * 0.8),
      y: h,
      targetY: h * (0.06 + Math.random() * 0.42),
      color: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
      trailTick: 0,
    });
  },

  _explode(x, y, color) {
    const count = 110 + Math.floor(Math.random() * 60);
    const c2 = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
      const speed = Math.random() * 6 + 0.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.45 ? color : c2,
        alpha: 1,
        radius: Math.random() * 3 + 0.7,
        decay: Math.random() * 0.013 + 0.007,
        gravity: 0.055 + Math.random() * 0.04,
        glow: Math.random() > 0.4,
      });
    }

    // Bright center flash
    for (let i = 0; i < 22; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: '#ffffff',
        alpha: 1,
        radius: Math.random() * 1.8 + 0.5,
        decay: 0.06,
        gravity: 0.04,
        glow: true,
      });
    }
  },

  _loop() {
    const { ctx, canvas } = this;
    // Fade trail (not full clear = motion blur effect)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Rockets
    const nextRockets = [];
    for (const r of this.rockets) {
      const totalDist = canvas.height - r.targetY;
      const remaining = r.y - r.targetY;
      const t = 1 - remaining / totalDist;
      const speed = -(totalDist * 0.042) * (1 - t * 0.25);
      r.y += speed;

      r.trailTick++;
      if (r.trailTick % 2 === 0) {
        this.particles.push({
          x: r.x + (Math.random() - 0.5) * 3,
          y: r.y + 8,
          vx: (Math.random() - 0.5) * 0.9,
          vy: Math.random() * 1.8 + 0.5,
          color: r.color,
          alpha: 0.75,
          radius: 2,
          decay: 0.05,
          gravity: 0.03,
          glow: false,
        });
      }

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 14;
      ctx.shadowColor = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (r.y <= r.targetY) {
        this._explode(r.x, r.y, r.color);
      } else {
        nextRockets.push(r);
      }
    }
    this.rockets = nextRockets;

    // Particles
    const nextParticles = [];
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.984;
      p.alpha -= p.decay;

      if (p.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        if (p.glow) {
          ctx.shadowBlur = 9;
          ctx.shadowColor = p.color;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        nextParticles.push(p);
      }
    }
    this.particles = nextParticles;

    if (this.particles.length > 0 || this.rockets.length > 0) {
      this.animId = requestAnimationFrame(() => this._loop());
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.canvas.hidden = true;
      this.animId = null;
    }
  },
};

/* ── Check & launch fireworks for today's D-Days ── */
function checkAndLaunchFireworks() {
  const todayEvents = state.events.filter(e => computeDiff(e) === 0);
  if (!todayEvents.length) return;
  const title = todayEvents.length === 1
    ? todayEvents[0].title
    : `${todayEvents[0].title} 외 ${todayEvents.length - 1}개`;
  FW.launch(title);
}

/* ── Event Delegation ── */
document.addEventListener('click', e => {
  const delBtn = e.target.closest('[data-delete]');
  if (delBtn) {
    openDeleteModal(delBtn.dataset.delete);
    return;
  }

  const catBtn = e.target.closest('.cat-btn');
  if (catBtn) {
    document.querySelectorAll('.cat-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-checked', 'false');
    });
    catBtn.classList.add('active');
    catBtn.setAttribute('aria-checked', 'true');
  }
});

/* ── Form Submission ── */
document.getElementById('ddayForm').addEventListener('submit', e => {
  e.preventDefault();

  const titleInput = document.getElementById('titleInput');
  const titleError = document.getElementById('titleError');
  const dateError = document.getElementById('dateError');
  const dateValue = getDateValue();

  let valid = true;

  if (!titleInput.value.trim()) {
    titleInput.classList.add('is-invalid');
    titleError.hidden = false;
    titleInput.focus();
    valid = false;
  } else {
    titleInput.classList.remove('is-invalid');
    titleError.hidden = true;
  }

  if (!dateValue) {
    if (!document.getElementById('yearInput').value)
      document.getElementById('yearInput').classList.add('is-invalid');
    if (!document.getElementById('monthSelect').value)
      document.getElementById('monthSelect').classList.add('is-invalid');
    if (!document.getElementById('daySelect').value)
      document.getElementById('daySelect').classList.add('is-invalid');
    dateError.hidden = false;
    if (valid) document.getElementById('yearInput').focus();
    valid = false;
  } else {
    ['yearInput', 'monthSelect', 'daySelect'].forEach(id =>
      document.getElementById(id).classList.remove('is-invalid')
    );
    dateError.hidden = true;
  }

  if (!valid) return;

  addEvent({
    title: titleInput.value.trim(),
    date: dateValue,
    category: getSelectedCat(),
    isAnnual: document.getElementById('annualCheck').checked,
  });

  closeModal();
});

/* ── Date Picker Events ── */
document.getElementById('yearInput').addEventListener('input', updateDayOptions);
document.getElementById('monthSelect').addEventListener('change', updateDayOptions);

/* ── Char Counter ── */
document.getElementById('titleInput').addEventListener('input', function () {
  document.getElementById('charCount').textContent = `${this.value.length} / 30`;
  if (this.value.trim()) {
    this.classList.remove('is-invalid');
    document.getElementById('titleError').hidden = true;
  }
});

/* ── Search / Sort ── */
document.getElementById('searchInput').addEventListener('input', render);

document.getElementById('sortSelect').addEventListener('change', function () {
  state.sortBy = this.value;
  saveState();
  render();
});

/* ── Buttons ── */
document.getElementById('fabBtn').addEventListener('click', openModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', closeModal);

document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
document.getElementById('deleteOverlay').addEventListener('click', closeDeleteModal);
document.getElementById('deleteConfirmBtn').addEventListener('click', () => {
  if (deletingId) deleteEvent(deletingId);
  closeDeleteModal();
});

document.getElementById('themeBtn').addEventListener('click', toggleTheme);

document.getElementById('exportBtn').addEventListener('click', exportJSON);
document.getElementById('importBtn').addEventListener('click', () => {
  document.getElementById('importFile').value = '';
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', function () {
  if (this.files[0]) importJSON(this.files[0]);
});

/* ── Keyboard ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('deleteModal').hidden) closeDeleteModal();
    else if (!document.getElementById('modal').hidden) closeModal();
  }
  if ((e.altKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    if (!document.getElementById('fabBtn').disabled) openModal();
  }
});

/* ── System theme change ── */
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (state.theme === 'system') applyTheme('system');
});

/* ── Init ── */
loadState();                // localStorage 먼저 로드 (즉시 표시)
applyTheme(state.theme);
document.getElementById('sortSelect').value = state.sortBy;
buildCatPicker();
FW.init();
initSupabase();
render();

// Supabase에서 최신 데이터 로드 (비동기)
loadEventsFromDB().then(ok => {
  render();
  checkAndLaunchFireworks();
});

scheduleMidnight();
