// ==== 1. Настройки ====
const SUPABASE_URL  = 'https://wwspemquprfjggytfhno.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_KGg69p8Px9QaJt80DgKaag_zvWdE_aE';
const ROOM          = 'live-1';
const QUESTION_ID   = 'q1';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==== 2. DOM ====
const chatEl      = document.getElementById('chat');
const reactionsEl = document.getElementById('reactions');
const form        = document.getElementById('form');
const nickEl      = document.getElementById('nickname');
const textEl      = document.getElementById('text');

nickEl.value = localStorage.getItem('nick') || '';
nickEl.addEventListener('input', () => localStorage.setItem('nick', nickEl.value));

// ==== 3. Загрузка истории ====
async function loadHistory() {
  const { data, error } = await db
    .from('answers')
    .select('*')
    .eq('room', ROOM)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    console.error('Ошибка загрузки:', error);
    return;
  }
  data.forEach(addMessageToChat);
}

// ==== 4. Realtime ====
const channel = db
  .channel('room:' + ROOM)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'answers', filter: 'room=eq.' + ROOM },
    (payload) => addMessageToChat(payload.new)
  )
  .on('broadcast', { event: 'reaction' }, ({ payload }) => {
    spawnReaction(payload.emoji);
  })
  .subscribe((status) => {
    console.log('Realtime status:', status);
  });

// ==== 5. Отрисовка сообщения ====
function addMessageToChat(row) {
  if (document.querySelector('[data-id="' + row.id + '"]')) return;

  const div = document.createElement('div');
  div.className = 'msg';
  div.dataset.id = row.id;
  div.innerHTML = '<b>' + escapeHtml(row.nickname) + '</b>: ' + escapeHtml(row.text);
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// ==== 6. Отправка ====
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nickname = nickEl.value.trim() || 'Аноним';
  const text     = textEl.value.trim();
  if (!text) return;

  const { data, error } = await db
    .from('answers')
    .insert({ room: ROOM, nickname: nickname, text: text, question_id: QUESTION_ID })
    .select()
    .single();

  if (error) {
    alert('Ошибка: ' + error.message);
    console.error(error);
    return;
  }

  addMessageToChat(data);
  textEl.value = '';
  textEl.focus();
});

// ==== 7. Реакции ====
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
  el.style.left = Math.random() * 85 + 5 + '%';
  reactionsEl.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ==== 8. Утилита ====
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ==== 9. Старт ====
loadHistory();