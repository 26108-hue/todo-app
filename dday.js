/* ====================================================
   D-Day Counter — App Logic
   ==================================================== */

const MAX_EVENTS = 20;

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

/* ── Modal ── */
function openModal() {
  const modal = document.getElementById('modal');
  document.getElementById('modalTitle').textContent = 'D-Day 추가';
  document.getElementById('submitBtn').textContent = '추가하기';
  document.getElementById('ddayForm').reset();
  document.getElementById('charCount').textContent = '0 / 30';
  document.getElementById('titleInput').classList.remove('is-invalid');
  document.getElementById('dateInput').classList.remove('is-invalid');
  document.getElementById('titleError').hidden = true;
  document.getElementById('dateError').hidden = true;

  // Set default category to first
  const btns = document.querySelectorAll('.cat-btn');
  btns.forEach((b, i) => b.classList.toggle('active', i === 0));

  // Default date to today
  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('dateInput').value =
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

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

  state.events.push({
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
    title: title.trim(),
    date,
    category,
    isAnnual,
    createdAt: Date.now(),
  });

  saveState();
  render();
  showSnack(`"${title}" D-Day가 추가됐어요 ✅`);
}

function deleteEvent(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  state.events = state.events.filter(e => e.id !== id);
  saveState();
  render();
  showSnack(`"${ev.title}"이(가) 삭제됐어요`);
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
    scheduleMidnight();
  }, ms);
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
  const dateInput = document.getElementById('dateInput');
  const titleError = document.getElementById('titleError');
  const dateError = document.getElementById('dateError');

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

  if (!dateInput.value) {
    dateInput.classList.add('is-invalid');
    dateError.hidden = false;
    if (valid) dateInput.focus();
    valid = false;
  } else {
    dateInput.classList.remove('is-invalid');
    dateError.hidden = true;
  }

  if (!valid) return;

  addEvent({
    title: titleInput.value.trim(),
    date: dateInput.value,
    category: getSelectedCat(),
    isAnnual: document.getElementById('annualCheck').checked,
  });

  closeModal();
});

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
loadState();
applyTheme(state.theme);
document.getElementById('sortSelect').value = state.sortBy;
buildCatPicker();
render();
scheduleMidnight();
