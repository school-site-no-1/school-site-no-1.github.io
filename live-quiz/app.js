// ==== 1. Настройки ====
const SUPABASE_URL  = 'https://wwspemquprfjggytfhno.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_KGg69p8Px9QaJt80DgKaag_zvWdE_aE';
const ROOM          = 'live-1';
const QUESTION_ID   = 'q1';
const QUESTION_DURATION_MS = 5 * 60 * 1000;   // 5 минут
const RATE_LIMIT_MS        = 2000;            // 1 сообщение в 2 сек

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==== 2. DOM ====
const chatEl      = document.getElementById('chat');
const reactionsEl = document.getElementById('reactions');
const form        = document.getElementById('form');
const nickEl      = document.getElementById('nickname');
const textEl      = document.getElementById('text');
const timerEl     = document.getElementById('timer');
const onlineEl    = document.getElementById('online');
const statsEl     = document.getElementById('stats');
const submitBtn   = form.querySelector('button[type=submit]');

const isModerator = new URLSearchParams(location.search).get('mod') === '1';
let modPassword   = null;

// Восстанавливаем имя
nickEl.value = localStorage.getItem('nick') || '';
nickEl.addEventListener('input', () => localStorage.setItem('nick', nickEl.value));

// Автовысота textarea
function autoGrow() {
  textEl.style.height = 'auto';
  textEl.style.height = Math.min(textEl.scrollHeight, 90) + 'px';
}
textEl.addEventListener('input', autoGrow);

// ==== 3. Загрузка вопроса и таймера ====
let questionStartedAt = null;

async function loadQuestion() {
  const { data, error } = await db
    .from('questions').select('*').eq('id', QUESTION_ID).single();
  if (error || !data) { console.error(error); return; }

  document.getElementById('question').src = data.image_url;
  questionStartedAt = new Date(data.started_at).getTime();

  const duration = data.duration_ms || QUESTION_DURATION_MS;
  updateTimer(duration);
  setInterval(() => updateTimer(duration), 1000);
}

function updateTimer(duration) {
  const left = Math.max(0, questionStartedAt + duration - Date.now());
  const sec  = Math.floor(left / 1000);
  const mm   = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss   = String(sec % 60).padStart(2, '0');
  timerEl.textContent = mm + ':' + ss;

  const ended = left === 0;
  textEl.disabled    = ended;
  submitBtn.disabled = ended;
  document.querySelectorAll('#reaction-bar button').forEach(b => b.disabled = ended);
}

// ==== 4. Загрузка истории ====
async function loadHistory() {
  const { data, error } = await db
    .from('answers').select('*')
    .eq('room', ROOM).eq('hidden', false)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) { console.error('Ошибка загрузки:', error); return; }
  data.forEach(addMessageToChat);
}

// ==== 5. Realtime ====
const channel = db
  .channel('room:' + ROOM)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'answers', filter: 'room=eq.' + ROOM },
    (payload) => addMessageToChat(payload.new)
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'answers', filter: 'room=eq.' + ROOM },
    (payload) => { if (payload.new.hidden) removeMessage(payload.new.id); }
  )
  .on('broadcast', { event: 'reaction' }, ({ payload }) => spawnReaction(payload.emoji))
  .subscribe(status => console.log('Realtime status:', status));

// ==== 6. Отрисовка ====
function addMessageToChat(row) {
  if (row.hidden) return;
  if (document.querySelector('[data-id="' + row.id + '"]')) return;

  const div = document.createElement('div');
  div.className = 'msg';
  div.dataset.id = row.id;
  div.innerHTML =
    '<b>' + escapeHtml(row.nickname) + '</b>: ' +
    escapeHtml(row.text).replace(/\n/g, '<br>');

  if (isModerator) {
    const btn = document.createElement('button');
    btn.className = 'hide-btn';
    btn.textContent = '✕';
    btn.onclick = () => hideMessage(row.id);
    div.appendChild(btn);
  }

  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function removeMessage(id) {
  const el = document.querySelector('[data-id="' + id + '"]');
  if (el) el.remove();
}

async function hideMessage(id) {
  if (!modPassword) {
    modPassword = await askPassword();
    if (!modPassword) return;
  }
  const { error } = await db.rpc('hide_answer', {
    answer_id: id, password: modPassword
  });
  if (error) {
    alert(error.message);
    modPassword = null;
    return;
  }
  removeMessage(id);
}

// ==== 7. Отправка ответа ====
let lastSentAt = 0;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const now = Date.now();
  if (now - lastSentAt < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (now - lastSentAt)) / 1000);
    alert('Подождите ' + wait + ' сек');
    return;
  }

  const nickname = nickEl.value.trim() || 'Аноним';
  const text     = textEl.value.trim();
  if (!text) return;

  lastSentAt = now;
  submitBtn.disabled = true;
  setTimeout(() => { submitBtn.disabled = false; }, RATE_LIMIT_MS);

  const { data, error } = await db
    .from('answers')
    .insert({ room: ROOM, nickname, text, question_id: QUESTION_ID })
    .select().single();

  if (error) {
    alert('Ошибка: ' + error.message);
    lastSentAt = 0;
    return;
  }

  addMessageToChat(data);
  textEl.value = '';
  autoGrow();
  textEl.focus();
});

// ==== 8. Реакции ====
document.querySelectorAll('#reaction-bar button').forEach((btn) => {
  btn.addEventListener('click', () => {
    spawnReaction(btn.dataset.emoji);
    channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji: btn.dataset.emoji },
    });
  });
});

function spawnReaction(emoji) {
  const el = document.createElement('span');
  el.className = 'reaction';
  el.textContent = emoji;
  el.style.left = Math.random() * 80 + 10 + '%';
  reactionsEl.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==== 9. Presence (онлайн) ====
const presence = db.channel('presence:' + ROOM, {
  config: { presence: { key: crypto.randomUUID() } }
});

presence
  .on('presence', { event: 'sync' }, () => {
    const state = presence.presenceState();
    onlineEl.textContent = 'Онлайн: ' + Object.keys(state).length;
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presence.track({ joined_at: Date.now() });
    }
  });

// ==== 10. Статистика (только модератор) ====
async function refreshStats() {
  const { data, error } = await db.rpc('answer_stats', { p_room: ROOM });
  if (error || !data) return;
  statsEl.innerHTML = '<b>Топ ответов</b><br>' + data.map(r =>
    escapeHtml(r.answer_text) + ' — <b>' + r.cnt + '</b>'
  ).join('<br>');
}

if (isModerator) {
  statsEl.classList.add('visible');
  setInterval(refreshStats, 3000);
  refreshStats();
}

// ==== 11. Пароль модератора ====
function askPassword() {
  return new Promise(resolve => {
    const modal = document.getElementById('mod-prompt');
    const input = document.getElementById('mod-password');
    const cancel = document.getElementById('mod-cancel');
    modal.classList.add('visible');
    input.value = '';
    input.focus();

    function cleanup() {
      modal.classList.remove('visible');
      input.removeEventListener('keydown', onKey);
      cancel.removeEventListener('click', onCancel);
    }
    function onKey(e) {
      if (e.key === 'Enter') { const v = input.value; cleanup(); resolve(v); }
      if (e.key === 'Escape') { cleanup(); resolve(null); }
    }
    function onCancel() { cleanup(); resolve(null); }

    input.addEventListener('keydown', onKey);
    cancel.addEventListener('click', onCancel);
  });
}

// ==== 12. Утилита ====
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ==== 13. Старт ====
loadQuestion();
loadHistory();