// ==== 1. Настройки ====
const SUPABASE_URL  = 'https://wwspemquprfjggytfhno.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_KGg69p8Px9QaJt80DgKaag_zvWdE_aE';
const ROOM          = 'live-1';
const QUESTION_ID   = 'q1';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==== 2. Дата по Москве ====
function todayMoscow() {
  const now = new Date();
  const moscow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  return moscow.toISOString().slice(0, 10);
}

// ==== 3. DOM ====
const reactionsEl  = document.getElementById('reactions');
const onlineEl     = document.getElementById('online');
const statsReactEl = document.getElementById('reactions-stats');

const isModerator = new URLSearchParams(location.search).get('mod') === '1';
let modPassword   = null;

const reactionCounts = {};

// ==== 4. Realtime ====
const channel = db
  .channel('room:' + ROOM)
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

// ==== 5. Загрузка вопроса ====
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

// ==== 6. Реакции ====
document.querySelectorAll('#reaction-bar button').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const emoji = btn.dataset.emoji;
    spawnReaction(emoji);
    await db.rpc('bump_reaction', { p_room: ROOM, p_emoji: emoji });
    channel.send({ type: 'broadcast', event: 'reaction', payload: { emoji } });
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
  if (emojis.length === 0) { statsReactEl.classList.remove('visible'); return; }

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
    .from('reactions_count').select('*').eq('room', ROOM).eq('day', day);
  if (error || !data) return;

  Object.keys(reactionCounts).forEach(k => delete reactionCounts[k]);
  data.forEach(row => { reactionCounts[row.emoji] = row.cnt; });
  renderReactionsStats();
}

// ==== 7. Presence + статистика посещений ====
let visitLogged = false;

const presence = db.channel('presence:' + ROOM, {
  config: { presence: { key: crypto.randomUUID() } }
});

presence
  .on('presence', { event: 'sync' }, async () => {
    const state = presence.presenceState();
    const count = Object.keys(state).length;
    onlineEl.textContent = 'Онлайн: ' + count;

    try {
      await db.rpc('bump_online', { p_room: ROOM, p_current_online: count });
    } catch (e) {
      console.warn('Ошибка bump_online:', e);
    }
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presence.track({ joined_at: Date.now() });

      if (!visitLogged) {
        visitLogged = true;
        try {
          const state = presence.presenceState();
          const count = Object.keys(state).length;
          await db.rpc('visit_room', { p_room: ROOM, p_current_online: count });
          console.log('Посещение зафиксировано, онлайн:', count);
        } catch (e) {
          console.warn('Ошибка visit_room:', e);
        }
      }
    }
  });

// ==== 8. Модерация ====
if (isModerator) {
  document.getElementById('mod-actions').classList.add('visible');

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

async function getModPassword() {
  if (!modPassword) modPassword = await askPassword();
  return modPassword;
}

// ==== 9. Модалка пароля ====
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

// ==== 10. Автосброс в 00:00 ====
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
    console.log('00:00 по Москве — сбрасываем счётчики');
    loadReactionCounts();
    scheduleReset();
  }, ms);
}

scheduleReset();

// ==== 11. Старт ====
loadQuestion();
loadReactionCounts();