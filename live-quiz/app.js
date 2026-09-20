// ==== 1. Настройки ====
const SUPABASE_URL  = 'https://wwspemquprfjggytfhno.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_KGg69p8Px9QaJt80DgKaag_zvWdE_aE';
const ROOM          = 'live-1';
const QUESTION_ID   = 'q1';
const MAX_LEN       = 150;

const DEEPSEEK_PROXY = 'https://deepseek-proxy.a-mikhalitsyn.workers.dev';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==== 2. Дата по Москве ====
function todayMoscow() {
  const now = new Date();
  const moscow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  return moscow.toISOString().slice(0, 10);
}

// ==== 3. Fetch с таймаутом ====
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      console.warn('Запрос превысил таймаут ' + timeoutMs + ' мс');
      return null;
    }
    throw error;
  }
}

// ==== 4. Запрос к DeepSeek ====
async function askDeepSeek(prompt, maxTokens = 10) {
  try {
    const response = await fetchWithTimeout(DEEPSEEK_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: maxTokens
      })
    }, 8000);

    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.choices && data.choices[0]) return data.choices[0].message.content;
    return null;
  } catch (error) {
    console.error('DeepSeek error:', error);
    return null;
  }
}

// ==== 5. Проверка на мат ====
async function checkProfanity(nickname, text) {
  const prompt =
    'Проверь ИМЯ и ТЕКСТ на наличие мата, нецензурных слов, оскорблений (русский и английский). ' +
    'Ответь строго одним словом: ДА (если есть мат хотя бы где-то) или НЕТ (если чисто). ' +
    'ИМЯ: "' + nickname.replace(/"/g, '') + '". ' +
    'ТЕКСТ: "' + text.replace(/"/g, '') + '".';

  const answer = await askDeepSeek(prompt, 10);
  if (answer === null) {
    console.warn('DeepSeek не ответил, пропускаем проверку');
    return false;
  }

  const isBad = answer.trim().toUpperCase().startsWith('ДА');
  console.log('Проверка -> ' + answer + ' -> ' + (isBad ? 'БЛОКИРОВАТЬ' : 'ПРОПУСТИТЬ'));
  return isBad;
}

// ==== 6. Перевод в стиле былин (с учётом пола) ====
async function translateToOldRussian(text, gender) {
  if (!text || text.trim().length === 0) return null;

  try {
    const response = await fetchWithTimeout(DEEPSEEK_PROXY + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, gender })
    }, 20000);

    if (!response || !response.ok) return null;

    const data = await response.json();
    if (data.translated) return data.translated;
    return null;
  } catch (error) {
    console.error('Сетевая ошибка перевода:', error);
    return null;
  }
}

// ==== 7. DOM ====
const chatEl      = document.getElementById('chat');
const reactionsEl = document.getElementById('reactions');
const form        = document.getElementById('form');
const nickEl      = document.getElementById('nickname');
const genderEl    = document.getElementById('gender');
const textEl      = document.getElementById('text');
const onlineEl    = document.getElementById('online');
const statsEl     = document.getElementById('stats');
const statsReactEl = document.getElementById('reactions-stats');
const charCounterEl = document.getElementById('char-counter');
const submitBtn   = form.querySelector('button[type=submit]');

const isModerator = new URLSearchParams(location.search).get('mod') === '1';
let modPassword   = null;

const reactionCounts = {};

// Восстанавливаем имя и пол
nickEl.value = localStorage.getItem('nick') || '';
genderEl.value = localStorage.getItem('gender') || '';
nickEl.addEventListener('input', () => localStorage.setItem('nick', nickEl.value));
genderEl.addEventListener('change', () => localStorage.setItem('gender', genderEl.value));

// ==== 8. Счётчик символов ====
function autoGrow() {
  textEl.style.height = 'auto';
  textEl.style.height = Math.min(textEl.scrollHeight, 90) + 'px';
  updateCharCounter();
}

function updateCharCounter() {
  const len = textEl.value.length;
  charCounterEl.textContent = len + '/' + MAX_LEN;
  charCounterEl.classList.remove('warn', 'danger');
  if (len >= MAX_LEN) charCounterEl.classList.add('danger');
  else if (len > MAX_LEN - 25) charCounterEl.classList.add('warn');
}

textEl.addEventListener('input', () => {
  if (textEl.value.length > MAX_LEN) {
    textEl.value = textEl.value.slice(0, MAX_LEN);
  }
  autoGrow();
});

textEl.addEventListener('paste', (e) => {
  const pasted = (e.clipboardData || window.clipboardData).getData('text');
  if (textEl.value.length + pasted.length > MAX_LEN) {
    e.preventDefault();
    const allowed = MAX_LEN - textEl.value.length;
    textEl.value += pasted.slice(0, allowed);
    updateCharCounter();
  }
});

updateCharCounter();

// ==== 9. Загрузка вопроса ====
async function loadQuestion() {
  const { data, error } = await db
    .from('questions').select('*').eq('id', QUESTION_ID).single();
  if (error || !data) { console.error(error); return; }

  document.getElementById('question').src    = data.image_url;
  document.getElementById('question-bg').src = data.image_url;
}

db.channel('questions-watch')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'questions', filter: 'id=eq.' + QUESTION_ID },
    (payload) => {
      document.getElementById('question').src    = payload.new.image_url;
      document.getElementById('question-bg').src = payload.new.image_url;
    }
  )
  .subscribe();

// ==== 10. История — только за сегодня ====
async function loadHistory() {
  const day = todayMoscow();
  const { data, error } = await db
    .from('answers').select('*')
    .eq('room', ROOM).eq('hidden', false).eq('day', day)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) { console.error('Ошибка загрузки:', error); return; }
  data.forEach(addMessageToChat);
}

// ==== 11. Realtime ====
const channel = db
  .channel('room:' + ROOM)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'answers', filter: 'room=eq.' + ROOM },
    (payload) => {
      if (payload.new.day === todayMoscow()) addMessageToChat(payload.new);
    }
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'answers', filter: 'room=eq.' + ROOM },
    (payload) => {
      if (payload.new.hidden && payload.new.day === todayMoscow()) {
        removeMessage(payload.new.id);
      }
    }
  )
  .on('broadcast', { event: 'reaction' }, ({ payload }) => spawnReaction(payload.emoji))
  .subscribe(status => console.log('Realtime status:', status));

db.channel('reactions-watch')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'reactions_count', filter: 'room=eq.' + ROOM },
    (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      if (row.day === todayMoscow()) updateReactionCounter(row.emoji, row.cnt);
    }
  )
  .subscribe();

// ==== 12. Отрисовка сообщений ====
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
  const pwd = await getModPassword();
  if (!pwd) return;
  const { error } = await db.rpc('hide_answer', {
    answer_id: id, password: pwd
  });
  if (error) { alert(error.message); modPassword = null; return; }
  removeMessage(id);
}

async function getModPassword() {
  if (!modPassword) modPassword = await askPassword();
  return modPassword;
}

// ==== 13. Отправка ====
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nickname = nickEl.value.trim() || 'Аноним';
  const gender   = genderEl.value || null;   // 'male' | 'female' | null
  let   originalText = textEl.value.trim();
  if (!originalText) return;

  if (originalText.length > MAX_LEN) {
    originalText = originalText.slice(0, MAX_LEN);
    textEl.value = originalText;
    updateCharCounter();
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '…';

  console.log('Проверка на мат...');
  const isBad = await checkProfanity(nickname, originalText);
  if (isBad) {
    alert('Имя или сообщение содержит недопустимые слова.');
    submitBtn.disabled = false;
    submitBtn.textContent = '➤';
    return;
  }

  console.log('Перевод... Пол:', gender || 'не указан');
  const translated = await translateToOldRussian(originalText, gender);
  const finalText = translated || originalText;

  console.log('Отправка в базу:', {
    nickname, gender, original_text: originalText, text: finalText
  });

  const { data, error } = await db
    .from('answers')
    .insert({
      room: ROOM,
      nickname,
      gender,
      text: finalText,
      original_text: originalText,
      question_id: QUESTION_ID,
      day: todayMoscow()
    })
    .select().single();

  submitBtn.disabled = false;
  submitBtn.textContent = '➤';

  if (error) {
    console.error('Ошибка Supabase:', error);
    alert('Ошибка: ' + error.message);
    return;
  }

  addMessageToChat(data);
  textEl.value = '';
  autoGrow();
  updateCharCounter();
  textEl.focus();
});

// ==== 14. Реакции ====
document.querySelectorAll('#reaction-bar button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const emoji = btn.dataset.emoji;
    spawnReaction(emoji);
    await db.rpc('bump_reaction', { p_room: ROOM, p_emoji: emoji });
    channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji },
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

function renderReactionsStats() {
  const emojis = Object.keys(reactionCounts);
  if (emojis.length === 0) {
    statsReactEl.classList.remove('visible');
    return;
  }

  emojis.sort((a, b) => reactionCounts[b] - reactionCounts[a]);

  const rowsHtml = emojis.map(e =>
    '<div class="row"><span class="emoji">' + e + '</span><b>' + reactionCounts[e] + '</b></div>'
  ).join('');

  statsReactEl.innerHTML = '<div class="title">Сегодня</div>' + rowsHtml;
  statsReactEl.classList.add('visible');
}

function updateReactionCounter(emoji, cnt) {
  reactionCounts[emoji] = cnt;
  renderReactionsStats();
}

async function loadReactionCounts() {
  const day = todayMoscow();
  const { data, error } = await db
    .from('reactions_count').select('*')
    .eq('room', ROOM).eq('day', day);
  if (error || !data) return;

  Object.keys(reactionCounts).forEach(k => delete reactionCounts[k]);
  data.forEach(row => { reactionCounts[row.emoji] = row.cnt; });
  renderReactionsStats();
}

// ==== 15. Presence ====
const presence = db.channel('presence:' + ROOM, {
  config: { presence: { key: crypto.randomUUID() } }
});

presence
  .on('presence', { event: 'sync' }, () => {
    const state = presence.presenceState();
    onlineEl.textContent = 'Онлайн: ' + Object.keys(state).length;
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await presence.track({ joined_at: Date.now() });
  });

// ==== 16. Модерация ====
async function refreshStats() {
  const { data, error } = await db.rpc('answer_stats', { p_room: ROOM });
  if (error || !data) return;
  statsEl.innerHTML = '<b>Топ ответов</b><br>' + data.map(r =>
    escapeHtml(r.answer_text) + ' — <b>' + r.cnt + '</b>'
  ).join('<br>');
}

if (isModerator) {
  statsEl.classList.add('visible');
  document.getElementById('mod-actions').classList.add('visible');
  setInterval(refreshStats, 3000);
  refreshStats();

  document.getElementById('new-question').addEventListener('click', async () => {
    const url = prompt('URL картинки вопроса:', document.getElementById('question').src);
    if (!url) return;
    const pwd = await getModPassword();
    if (!pwd) return;
    const { error } = await db.rpc('new_question_image', {
      q_id: QUESTION_ID, new_url: url, password: pwd
    });
    if (error) { alert(error.message); return; }
    document.getElementById('question').src    = url;
    document.getElementById('question-bg').src = url;
  });
}

// ==== 17. Модалка пароля ====
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

// ==== 18. Утилита ====
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ==== 19. Автосброс в 00:00 по Москве ====
function msUntilMidnightMoscow() {
  const now = new Date();
  const moscow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  const midnight = new Date(moscow);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - moscow.getTime();
}

function scheduleReset() {
  const ms = msUntilMidnightMoscow();
  console.log('Сброс в 00:00 через ' + Math.round(ms / 1000 / 60) + ' минут');

  setTimeout(() => {
    console.log('00:00 по Москве — сбрасываем чат и счётчики');
    chatEl.innerHTML = '';
    loadHistory();
    loadReactionCounts();
    scheduleReset();
  }, ms);
}

scheduleReset();

// ==== 20. Старт ====
loadQuestion();
loadHistory();
loadReactionCounts();