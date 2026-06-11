// ─────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'my-tasks';
const MAX_CHARS   = 200;
const MAX_ITEMS   = 500;

const CATEGORIES = {
  work:     { label: '업무' },
  personal: { label: '개인' },
  study:    { label: '공부' },
};

const MOTIVATIONS = [
  { max: 0,   msg: '오늘의 할 일을 시작해볼까요? 💪' },
  { max: 24,  msg: '좋은 시작이에요! 계속 해봐요 ✨' },
  { max: 49,  msg: '잘 하고 있어요! 순조롭게 진행 중 🎯' },
  { max: 74,  msg: '절반 이상 완료! 훌륭해요 🚀' },
  { max: 99,  msg: '거의 다 됐어요! 조금만 더! 🔥' },
  { max: 100, msg: '모두 완료! 오늘 하루 정말 대단해요! 🎉' },
];

// ─────────────────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────────────────

let todos        = [];
let activeFilter = 'all';
let sortOrder    = 'default';
let searchQuery  = '';
let lastAddedId  = null;
let snackTimer   = null;

// 캐시된 DOM 참조 (init() 에서 할당)
let EL = {};

// ─────────────────────────────────────────────────────────
// 유효성 검사 & 데이터 정제
// ─────────────────────────────────────────────────────────

function validateShape(obj) {
  return obj
    && typeof obj === 'object'
    && typeof obj.text === 'string'
    && obj.text.trim().length > 0;
}

function sanitizeItem(obj) {
  if (!validateShape(obj)) return null;
  return {
    id:        typeof obj.id === 'string' && obj.id ? obj.id : crypto.randomUUID(),
    text:      String(obj.text).trim().slice(0, MAX_CHARS),
    category:  Object.prototype.hasOwnProperty.call(CATEGORIES, obj.category)
                 ? obj.category : 'personal',
    completed: Boolean(obj.completed),
    createdAt: Number.isFinite(obj.createdAt) && obj.createdAt > 0
                 ? obj.createdAt : Date.now(),
  };
}

// ─────────────────────────────────────────────────────────
// 저장 / 불러오기
// ─────────────────────────────────────────────────────────

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { todos = []; return; }
    const parsed = JSON.parse(raw);
    todos = Array.isArray(parsed)
      ? parsed.map(sanitizeItem).filter(Boolean)
      : [];
  } catch {
    todos = [];
    // 스낵바는 EL 초기화 후 호출되므로 render 시 처리
    console.warn('My Tasks: 저장 데이터 파싱 실패, 초기화됨');
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (e) {
    const isQuota = e instanceof DOMException
      && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    showSnackbar(
      isQuota
        ? '저장 공간이 부족합니다. 완료된 항목을 삭제해 공간을 확보해주세요.'
        : '저장 중 오류가 발생했습니다.',
      { duration: 6000 }
    );
  }
}

// ─────────────────────────────────────────────────────────
// 테마
// ─────────────────────────────────────────────────────────

function applyTheme(isDark) {
  document.body.classList.toggle('dark', isDark);
  EL.themeCheckbox.checked = isDark;
  EL.themeIcon.textContent = isDark ? '☀️' : '🌙';
}

function loadTheme() {
  applyTheme(localStorage.getItem('theme') === 'dark');
}

function toggleDarkMode() {
  const isDark = !document.body.classList.contains('dark');
  try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch {}
  applyTheme(isDark);
}

// ─────────────────────────────────────────────────────────
// 스낵바 (알림 + 되돌리기 버튼)
// ─────────────────────────────────────────────────────────

function showSnackbar(message, { action, actionLabel = '되돌리기', duration = 4000 } = {}) {
  if (!EL.snackbar) return; // EL 미초기화 시 무시

  EL.snackbarMsg.textContent = message;

  if (action) {
    EL.snackbarAction.textContent = actionLabel;
    EL.snackbarAction.onclick     = () => { action(); hideSnackbar(); };
    EL.snackbarAction.hidden      = false;
  } else {
    EL.snackbarAction.hidden = true;
  }

  EL.snackbar.hidden = false;

  if (snackTimer) clearTimeout(snackTimer);
  snackTimer = setTimeout(hideSnackbar, duration);
}

function hideSnackbar() {
  if (snackTimer) { clearTimeout(snackTimer); snackTimer = null; }
  if (EL.snackbar) EL.snackbar.hidden = true;
}

// ─────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────

function addTodo(text, category) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (trimmed.length > MAX_CHARS) {
    showSnackbar(`할 일은 ${MAX_CHARS}자 이내로 입력해주세요.`);
    return false;
  }
  if (todos.length >= MAX_ITEMS) {
    showSnackbar(`할 일은 최대 ${MAX_ITEMS}개까지 추가할 수 있습니다.`);
    return false;
  }

  const newItem = {
    id:        crypto.randomUUID(),
    text:      trimmed,
    category,
    completed: false,
    createdAt: Date.now(),
  };

  todos.unshift(newItem);
  lastAddedId = newItem.id;
  save();
  render();
  lastAddedId = null;
  return true;
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  save();
  render();
}

function deleteTodo(id) {
  const idx = todos.findIndex(t => t.id === id);
  if (idx === -1) return;
  const [deleted] = todos.splice(idx, 1);
  save();
  render();

  const preview = deleted.text.length > 22
    ? deleted.text.slice(0, 22) + '…'
    : deleted.text;

  showSnackbar(`"${preview}" 삭제됨`, {
    action: () => {
      const at = Math.min(idx, todos.length);
      todos.splice(at, 0, deleted);
      save();
      render();
    },
    duration: 5000,
  });
}

function updateTodo(id, newText) {
  const trimmed = newText.trim().slice(0, MAX_CHARS);
  if (!trimmed) return;
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  todo.text = trimmed;
  save();
  render();
}

function clearCompleted() {
  const count = todos.filter(t => t.completed).length;
  if (count === 0) {
    showSnackbar('삭제할 완료 항목이 없어요.');
    return;
  }
  if (!confirm(`완료된 항목 ${count}개를 삭제할까요?`)) return;

  const snapshot = todos.slice(); // undo 용 스냅샷
  todos = todos.filter(t => !t.completed);
  save();
  render();

  showSnackbar(`완료된 항목 ${count}개 삭제됨`, {
    action: () => {
      todos = snapshot;
      save();
      render();
    },
    duration: 6000,
  });
}

// ─────────────────────────────────────────────────────────
// 내보내기 / 가져오기
// ─────────────────────────────────────────────────────────

function exportTodos() {
  if (todos.length === 0) {
    showSnackbar('내보낼 데이터가 없습니다.');
    return;
  }
  try {
    const payload = JSON.stringify({ version: 1, exportedAt: Date.now(), todos }, null, 2);
    const blob    = new Blob([payload], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = Object.assign(document.createElement('a'), {
      href:     url,
      download: `my-tasks-${new Date().toISOString().slice(0, 10)}.json`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSnackbar(`${todos.length}개 항목을 내보냈습니다 📁`);
  } catch {
    showSnackbar('내보내기에 실패했습니다. 브라우저 설정을 확인해주세요.', { duration: 5000 });
  }
}

function importFromFile(file) {
  if (!file) return;

  const isJson = file.name.toLowerCase().endsWith('.json')
    || file.type === 'application/json'
    || file.type === 'text/plain';

  if (!isJson) {
    showSnackbar('JSON 파일(.json)만 가져올 수 있습니다.', { duration: 4000 });
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showSnackbar('파일 크기가 5MB를 초과합니다.', { duration: 4000 });
    return;
  }

  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const parsed  = JSON.parse(e.target.result);
      const rawList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.todos)
          ? parsed.todos
          : null;

      if (!rawList) throw new Error('배열 형식이 아닙니다.');

      const valid = rawList.map(sanitizeItem).filter(Boolean);
      if (valid.length === 0) {
        showSnackbar('가져올 수 있는 항목이 없습니다.', { duration: 4000 });
        return;
      }

      const existingIds = new Set(todos.map(t => t.id));
      const fresh       = valid.filter(t => !existingIds.has(t.id));
      const dupeCount   = valid.length - fresh.length;

      if (fresh.length === 0) {
        showSnackbar('모든 항목이 이미 존재합니다.');
        return;
      }

      const msg = dupeCount > 0
        ? `${fresh.length}개를 가져오고 중복 ${dupeCount}개는 건너뜁니다. 계속할까요?`
        : `${fresh.length}개 항목을 가져올까요? 기존 항목은 유지됩니다.`;

      if (!confirm(msg)) return;

      const room     = MAX_ITEMS - todos.length;
      const toAdd    = fresh.slice(0, room);
      const overflow = fresh.length - toAdd.length;

      if (overflow > 0) {
        showSnackbar(`최대 ${MAX_ITEMS}개 제한으로 ${overflow}개는 추가하지 않았습니다.`, { duration: 5000 });
      }

      if (toAdd.length === 0) return;

      todos = [...toAdd, ...todos];
      save();
      render();
      showSnackbar(`${toAdd.length}개 항목을 가져왔어요! ✅`);
    } catch {
      showSnackbar('가져오기 실패: 올바른 My Tasks JSON 파일을 선택해주세요.', { duration: 5000 });
    }
  };

  reader.onerror = () =>
    showSnackbar('파일을 읽을 수 없습니다.', { duration: 4000 });

  reader.readAsText(file, 'utf-8');
}

// ─────────────────────────────────────────────────────────
// 인라인 편집
// ─────────────────────────────────────────────────────────

function startInlineEdit(li, todo) {
  const textSpan = li.querySelector('.todo-text');
  if (!textSpan) return;

  const input      = document.createElement('input');
  input.type       = 'text';
  input.className  = 'todo-edit-input';
  input.value      = todo.text;
  input.maxLength  = MAX_CHARS;

  textSpan.replaceWith(input);
  input.focus();
  input.select();

  let settled = false;

  const commit = () => {
    if (settled) return;
    settled = true;
    const newText = input.value.trim();
    if (newText && newText !== todo.text) updateTodo(todo.id, newText);
    else render();
  };

  const cancel = () => {
    if (settled) return;
    settled = true;
    render();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
  input.addEventListener('blur', commit);
}

// ─────────────────────────────────────────────────────────
// 정렬
// ─────────────────────────────────────────────────────────

function sortItems(items) {
  switch (sortOrder) {
    case 'oldest':
      return [...items].sort((a, b) => a.createdAt - b.createdAt);

    case 'category': {
      const order = Object.keys(CATEGORIES).reduce((acc, k, i) => {
        acc[k] = i; return acc;
      }, {});
      return [...items].sort(
        (a, b) => (order[a.category] ?? 99) - (order[b.category] ?? 99)
               || b.createdAt - a.createdAt
      );
    }

    case 'alpha':
      return [...items].sort((a, b) =>
        a.text.localeCompare(b.text, 'ko', { sensitivity: 'base' })
      );

    default:
      return items; // unshift 순서 유지 (최신순)
  }
}

function getVisible() {
  let filtered = activeFilter === 'all'
    ? todos
    : todos.filter(t => t.category === activeFilter);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t => t.text.toLowerCase().includes(q));
  }

  return [
    ...sortItems(filtered.filter(t => !t.completed)),
    ...sortItems(filtered.filter(t =>  t.completed)),
  ];
}

// ─────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!Number.isFinite(ts)) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff <    60) return '방금 전';
  if (diff <  3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

function highlightText(text, query) {
  if (!query) return document.createTextNode(text);

  const frag   = document.createDocumentFragment();
  const lower  = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  let   pos    = 0;

  while (pos < text.length) {
    const idx = lower.indexOf(lowerQ, pos);
    if (idx === -1) { frag.appendChild(document.createTextNode(text.slice(pos))); break; }
    if (idx > pos)    frag.appendChild(document.createTextNode(text.slice(pos, idx)));
    const mark     = document.createElement('mark');
    mark.className = 'highlight';
    mark.textContent = text.slice(idx, idx + query.length);
    frag.appendChild(mark);
    pos = idx + query.length;
  }
  return frag;
}

function getMotivationMsg(pct, total) {
  if (total === 0) return '할 일을 추가하면 진행률이 표시돼요 ✍️';
  return (MOTIVATIONS.find(m => pct <= m.max) ?? MOTIVATIONS.at(-1)).msg;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ─────────────────────────────────────────────────────────
// 대시보드
// ─────────────────────────────────────────────────────────

function updateDashboard() {
  const total = todos.length;
  const done  = todos.filter(t => t.completed).length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  EL.overallStat.textContent    = `${done} / ${total} 완료`;
  EL.overallFill.style.width    = `${pct}%`;
  EL.progressBar.setAttribute('aria-valuenow', String(pct));
  EL.motivationMsg.textContent  = getMotivationMsg(pct, total);

  const frag = document.createDocumentFragment();
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    const items   = todos.filter(t => t.category === key);
    const catDone = items.filter(t => t.completed).length;
    const catPct  = items.length === 0 ? 0 : Math.round((catDone / items.length) * 100);

    const cell = document.createElement('div');
    cell.className = 'cat-cell';
    cell.setAttribute('aria-label', `${cat.label} ${catDone}/${items.length} 완료`);
    // innerHTML safe: only controlled strings (key is a CATEGORIES key, values are numbers)
    cell.innerHTML = `
      <div class="cat-cell-top">
        <span class="badge badge-${key}">${cat.label}</span>
        <span class="cat-cell-count">${catDone} / ${items.length}</span>
      </div>
      <div class="progress-track progress-sm" role="presentation">
        <div class="progress-fill fill-${key}" style="width:${catPct}%"></div>
      </div>`;
    frag.appendChild(cell);
  });

  EL.catGrid.innerHTML = '';
  EL.catGrid.appendChild(frag);
}

// ─────────────────────────────────────────────────────────
// DOM 생성
// ─────────────────────────────────────────────────────────

function createTodoEl(todo) {
  const cat    = CATEGORIES[todo.category] ?? CATEGORIES.personal;
  const status = todo.completed ? '완료' : '미완료';

  const li = document.createElement('li');
  li.className = 'todo-item'
    + (todo.completed        ? ' done'   : '')
    + (todo.id === lastAddedId ? ' is-new' : '');
  li.dataset.id = todo.id;
  li.setAttribute('aria-label', `${todo.text}, ${cat.label}, ${status}`);

  const checkbox     = document.createElement('input');
  checkbox.type      = 'checkbox';
  checkbox.className = 'todo-checkbox';
  checkbox.checked   = todo.completed;
  checkbox.setAttribute('aria-label', `${todo.text} — ${status}로 전환`);

  const body = document.createElement('div');
  body.className = 'todo-body';

  const textSpan = document.createElement('span');
  textSpan.className = 'todo-text';
  textSpan.appendChild(highlightText(todo.text, searchQuery));
  if (!todo.completed) textSpan.title = '더블클릭하여 수정';

  const meta = document.createElement('div');
  meta.className = 'todo-meta';

  const badge       = document.createElement('span');
  badge.className   = `badge badge-${todo.category}`;
  badge.textContent = cat.label;

  const time       = document.createElement('span');
  time.className   = 'todo-time';
  time.textContent = timeAgo(todo.createdAt);

  meta.append(badge, time);
  body.append(textSpan, meta);

  const delBtn = document.createElement('button');
  delBtn.className   = 'delete-btn';
  delBtn.textContent = '✕';
  delBtn.setAttribute('aria-label', `${todo.text} 삭제`);

  li.append(checkbox, body, delBtn);
  return li;
}

// ─────────────────────────────────────────────────────────
// 렌더링  (DocumentFragment로 배치 삽입 → 100개+ 성능)
// ─────────────────────────────────────────────────────────

function render() {
  const visible = getVisible();
  const frag    = document.createDocumentFragment();
  visible.forEach(todo => frag.appendChild(createTodoEl(todo)));

  EL.todoList.innerHTML = '';
  EL.todoList.appendChild(frag);

  EL.emptyMsg.hidden = visible.length > 0;
  EL.emptyMsg.textContent =
    todos.length  === 0 ? '할 일이 없습니다. 추가해보세요!'
    : searchQuery       ? `"${searchQuery}"에 대한 검색 결과가 없습니다.`
                        : '해당 카테고리에 항목이 없습니다.';

  updateDashboard();
}

// ─────────────────────────────────────────────────────────
// 중복 확인
// ─────────────────────────────────────────────────────────

function checkDuplicate(text) {
  const t = text.trim().toLowerCase();
  const isDupe = t.length > 0 && todos.some(todo => todo.text.toLowerCase() === t);
  EL.dupeWarning.hidden = !isDupe;
}

// ─────────────────────────────────────────────────────────
// 이벤트 핸들러
// ─────────────────────────────────────────────────────────

function handleAdd() {
  const text     = EL.todoInput.value;
  const category = EL.categorySelect.value;
  if (addTodo(text, category)) {
    EL.todoInput.value    = '';
    EL.dupeWarning.hidden = true;
    EL.todoInput.focus();
  }
}

const debouncedSearch = debounce(() => render(), 150);

// ─────────────────────────────────────────────────────────
// 초기화
// ─────────────────────────────────────────────────────────

function init() {
  // DOM 참조 캐싱 (render 시 getElementById 반복 방지)
  EL = {
    todoList:          document.getElementById('todoList'),
    emptyMsg:          document.getElementById('emptyMsg'),
    overallStat:       document.getElementById('overallStat'),
    overallFill:       document.getElementById('overallFill'),
    progressBar:       document.getElementById('progressBar'),
    motivationMsg:     document.getElementById('motivationMsg'),
    catGrid:           document.getElementById('catGrid'),
    todoInput:         document.getElementById('todoInput'),
    categorySelect:    document.getElementById('categorySelect'),
    addBtn:            document.getElementById('addBtn'),
    searchInput:       document.getElementById('searchInput'),
    sortSelect:        document.getElementById('sortSelect'),
    clearCompletedBtn: document.getElementById('clearCompletedBtn'),
    filterBar:         document.getElementById('filterBar'),
    themeCheckbox:     document.getElementById('themeCheckbox'),
    themeIcon:         document.getElementById('themeIcon'),
    exportBtn:         document.getElementById('exportBtn'),
    importBtn:         document.getElementById('importBtn'),
    importFile:        document.getElementById('importFile'),
    dupeWarning:       document.getElementById('dupeWarning'),
    snackbar:          document.getElementById('snackbar'),
    snackbarMsg:       document.getElementById('snackbarMsg'),
    snackbarAction:    document.getElementById('snackbarAction'),
    snackbarDismiss:   document.getElementById('snackbarDismiss'),
  };

  // 테마
  loadTheme();
  EL.themeCheckbox.addEventListener('change', toggleDarkMode);

  // 할 일 추가
  EL.addBtn.addEventListener('click', handleAdd);
  EL.todoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleAdd();
  });
  EL.todoInput.addEventListener('input', e => checkDuplicate(e.target.value));

  // 검색 (디바운스)
  EL.searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    debouncedSearch();
  });

  // 정렬
  EL.sortSelect.addEventListener('change', e => {
    sortOrder = e.target.value;
    render();
  });

  // 완료 항목 삭제
  EL.clearCompletedBtn.addEventListener('click', clearCompleted);

  // 내보내기 / 가져오기
  EL.exportBtn.addEventListener('click', exportTodos);
  EL.importBtn.addEventListener('click', () => {
    EL.importFile.value = ''; // 같은 파일 재선택 허용
    EL.importFile.click();
  });
  EL.importFile.addEventListener('change', e => importFromFile(e.target.files[0]));

  // 할 일 목록 — 이벤트 위임
  EL.todoList.addEventListener('change', e => {
    if (!e.target.matches('.todo-checkbox')) return;
    toggleTodo(e.target.closest('.todo-item').dataset.id);
  });

  EL.todoList.addEventListener('click', e => {
    if (!e.target.matches('.delete-btn')) return;
    const li = e.target.closest('.todo-item');
    li.classList.add('removing');
    setTimeout(() => deleteTodo(li.dataset.id), 220);
  });

  EL.todoList.addEventListener('dblclick', e => {
    const span = e.target.closest('.todo-text');
    if (!span) return;
    const li   = span.closest('.todo-item');
    const todo = todos.find(t => t.id === li.dataset.id);
    if (!todo || todo.completed) return;
    startInlineEdit(li, todo);
  });

  // 필터 탭
  EL.filterBar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    EL.filterBar.querySelectorAll('.filter-btn').forEach(b => {
      const on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    render();
  });

  // 스낵바 닫기
  EL.snackbarDismiss.addEventListener('click', hideSnackbar);

  // 키보드 단축키
  document.addEventListener('keydown', e => {
    // 입력 중인 textarea/input에서는 Alt+N 무시하지 않음 (의도적으로 포커스 이동)
    if (e.altKey && e.code === 'KeyN') {
      e.preventDefault();
      EL.todoInput.focus();
      EL.todoInput.select();
    }
    if (e.altKey && e.code === 'KeyD') {
      e.preventDefault();
      toggleDarkMode();
    }
  });

  // 데이터 로드 + 최초 렌더링
  load();
  render();
}

document.addEventListener('DOMContentLoaded', init);
