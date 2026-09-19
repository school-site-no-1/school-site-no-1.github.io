// ==== 1. Настройки ====
const SUPABASE_URL  = 'https://wwspemquprfjggytfhno.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_KGg69p8Px9QaJt80DgKaag_zvWdE_aE';
const ROOM          = 'live-1';
const QUESTION_ID   = 'q1';

const DEEPSEEK_PROXY = 'https://deepseek-proxy.a-mikhalitsyn.workers.dev';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==== 2. Функция запроса к DeepSeek (для проверки на мат) ====
async function askDeepSeek(prompt, maxTokens = 10) {
  try {
    console.log('Отправка в DeepSeek:', prompt.substring(0, 50) + '...');
    const response = await fetch(DEEPSEEK_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      console.error('DeepSeek HTTP ошибка:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('Ответ DeepSeek:', data);

    if (data.choices && data.choices[0]) {
      const answer = data.choices[0].message.content;
      console.log('Текст ответа:', answer);
      return answer;
    }

    if (data.error) {
      console.error('Ошибка в ответе DeepSeek:', data.error);
    }
    return null;
  } catch (error) {
    console.error('Сетевая ошибка DeepSeek:', error);
    return null;
  }
}

// ==== 3. Проверка на мат через DeepSeek ====
async function containsProfanity(text) {
  if (!text || text.trim().length === 0) return false;

  const prompt =
    'Проверь текст на наличие мата, нецензурных слов, оскорблений (русский и английский). ' +
    'Ответь строго одним словом: ДА (если есть мат) или НЕТ (если чисто). ' +
    'Текст: "' + text.replace(/"/g, '') + '"';

  const answer = await askDeepSeek(prompt, 10);

  if (answer === null) {
    console.warn('DeepSeek не ответил, пропускаем проверку');
    return false;
  }

  const isProfane = answer.trim().toUpperCase().startsWith('ДА');
  console.log('Проверка "' + text + '": ' + answer + ' -> ' + (isProfane ? 'БЛОКИРОВАТЬ' : 'ПРОПУСТИТЬ'));
  return isProfane;
}

// ==== 4. Перевод в стиле древнерусского / былинного ====
async function translateToOldRussian(text) {
  if (!text || text.trim().length === 0) return null;

  try {
    console.log('Перевод на древнерусский:', text);
    const response = await fetch(DEEPSEEK_PROXY + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      console.error('Ошибка HTTP при переводе:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('Ответ перевода:', data);

    if (data.translated) return data.translated;
    if (data.error) console.error('Ошибка перевода:', data.error);
    return null;
  } catch (error) {
    console.error('Сетевая ошибка перевода:', error);
    return null;
  }
}

// ==== 5. DOM ====
const chatEl      = document.getElementById('chat');
const reactionsEl = document.getElementById('reactions');
const form        = document.getElementById('form');
const nickEl      = document.getElementById('nickname');
const textEl      = document.getElementById('text');
const onlineEl    = document.getElementById('online');
const statsEl     = document.getElementById('stats');
const statsReactEl = document.getElementById('reactions-stats');
const submitBtn   = form.querySelector('button[type=submit]');

const isModerator = new URLSearchParams(location.search).get('mod') === '1';
let modPassword   = null;

const reactionCounts = {};

nickEl.value = localStorage.getItem('nick') || '';
nickEl.addEventListener('input', () => localStorage.setItem('nick', nickEl.value));

function autoGrow() {
  textEl.style.height = 'auto';
  textEl.style.height = Math.min(textEl.scrollHeight, 90) + 'px';
}
textEl.addEventListener('input', autoGrow);

// ==== 6. Загрузка вопроса ====
async function loadQuestion() {
  const { data, error } = await db
    .from('questions').select('*').eq('id', QUESTION_ID).single();
  if (error || !data) { console.error(error); return; }
  document.getElementById('question').src = data.image_url;
}

db.channel('questions-watch')
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'questions', filter: 'id=eq.' + QUESTION_ID },
    (payload) => {
      document.getElementById('question').src = payload.new.image_url;
    }
  )
  .subscribe();

// ==== 7. История ответов ====
async function loadHistory() {
  const { data, error } = await db
    .from('answers').select('*')
    .eq('room', ROOM).eq('hidden', false)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) { console.error('Ошибка загрузки:', error); return; }
  data.forEach(addMessageToChat);
}

// ==== 8. Realtime ====
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

db.channel('reactions-watch')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'reactions_count', filter: 'room=eq.' + ROOM },
    (payload) => {
      const row = payload.new || payload.old;
      if (row) updateReactionCounter(row.emoji, row.cnt);
    }
  )
  .subscribe();

// ==== 9. Отрисовка сообщений ====
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

// ==== 10. Отправка ответа (с проверкой на мат И переводом) ====
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nickname = nickEl.value.trim() || 'Аноним';
  let   text     = textEl.value.trim();
  if (!text) return;

  submitBtn.disabled = true;
  submitBtn.textContent = '…';

  // 1. Проверка ИМЕНИ
  console.log('Проверка имени:', nickname);
  const nameBad = await containsProfanity(nickname);
  if (nameBad) {
    alert('Имя содержит недопустимые слова. Пожалуйста, измените.');
    submitBtn.disabled = false;
    submitBtn.textContent = '➤';
    return;
  }

  // 2. Проверка ТЕКСТА
  console.log('Проверка текста:', text);
  const textBad = await containsProfanity(text);
  if (textBad) {
    alert('Сообщение содержит недопустимые слова.');
    submitBtn.disabled = false;
    submitBtn.textContent = '➤';
    return;
  }

  // 3. Перевод в стиле древнерусского / былинного
  console.log('Перевод текста на древнерусский...');
  const translated = await translateToOldRussian(text);
  if (translated) {
    console.log('Перевод:', translated);
    text = translated;
  } else {
    console.warn('Перевод не удался, отправляем оригинал');
  }

  // 4. Отправка в Supabase
  console.log('Отправка в базу:', { nickname, text });
  const { data, error } = await db
    .from('answers')
    .insert({ room: ROOM, nickname, text, question_id: QUESTION_ID })
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
  textEl.focus();
});

// ==== 11. Реакции + счётчики ====
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

  statsReactEl.innerHTML = emojis.map(e =>
    '<div class="row"><span>' + e + '</span><b>' + reactionCounts[e] + '</b></div>'
  ).join('');

  statsReactEl.classList.add('visible');
}

function updateReactionCounter(emoji, cnt) {
  reactionCounts[emoji] = cnt;
  renderReactionsStats();
}

async function loadReactionCounts() {
  const { data, error } = await db
    .from('reactions_count').select('*').eq('room', ROOM);
  if (error || !data) return;
  data.forEach(row => { reactionCounts[row.emoji] = row.cnt; });
  renderReactionsStats();
}

// ==== 12. Presence ====
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

// ==== 13. Модерация ====
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
    document.getElementById('question').src = url;
  });
}

// ==== 14. Модалка пароля ====
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

// ==== 15. Утилита ====
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ==== 16. Старт ====
loadQuestion();
loadHistory();
loadReactionCounts();