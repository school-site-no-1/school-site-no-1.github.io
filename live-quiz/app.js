// ==== 1. Настройки ====
const SUPABASE_URL  = 'ВСТАВЬТЕ_ВАШ_URL';
const SUPABASE_KEY  = 'ВСТАВЬТЕ_ВАШ_ANON_KEY';
const ROOM          = 'live-1';           // ID эфира (можно менять в URL)
const QUESTION_ID   = 'q1';               // ID текущего вопроса

const supabase = window.supabase.createClient('https://wwspemquprfjggytfhno.supabase.co, sb_publishable_KGg69p8Px9QaJt80DgKaag_zvWdE_aE');

// ==== 2. DOM ====
const chatEl      = document.getElementById('chat');
const reactionsEl = document.getElementById('reactions');
const form        = document.getElementById('form');
const nickEl      = document.getElementById('nickname');
const textEl      = document.getElementById('text');

// Сохраняем имя в localStorage, чтобы не вводить заново
nickEl.value = localStorage.getItem('nick') || '';
nickEl.addEventListener('input', () => localStorage.setItem('nick', nickEl.value));

// ==== 3. Загрузка истории из БД ====
async function loadHistory() {
  const { data, error } = await supabase
    .from('answers')
    .select('*')
    .eq('room', ROOM)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) { console.error(error); return; }
  data.forEach(addMessageToChat);
}

// ==== 4. Realtime-подписка ====
const channel = supabase
  .channel(`room:${ROOM}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'answers', filter: `room=eq.${ROOM}` },
    (payload) => addMessageToChat(payload.new)
  )
  .on('broadcast', { event: 'reaction' }, ({ payload }) => {
    spawnReaction(payload.emoji);
  })
  .subscribe();

// ==== 5. Отрисовка сообщения ====
function addMessageToChat(row) {
  // не дублируем своё сообщение (оно уже добавлено локально после отправки)
  if (document.querySelector(`[data-id="${row.id}"]`)) return;

  const div = document.createElement('div');
  div.className = 'msg';
  div.dataset.id = row.id;
  div.innerHTML = `<b>${escapeHtml(row.nickname)}</b>: ${escapeHtml(row.text)}`;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// ==== 6. Отправка ответа ====
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nickname = nickEl.value.trim() || 'Аноним';
  const text     = textEl.value.trim();
  if (!text) return;

  const { data, error } = await supabase
    .from('answers')
    .insert({ room: ROOM, nickname, text, question_id: QUESTION_ID })
    .select()
    .single();

  if (error) { alert('Ошибка: ' + error.message); return; }

  // Показываем сразу, чтобы не ждать Realtime
  addMessageToChat(data);
  textEl.value = '';
  textEl.focus();
});

// ==== 7. Реакции ====
document.querySelectorAll('#reaction-bar button').forEach(btn => {
  btn.addEventListener('click', () => {
    // Локально сразу
    spawnReaction(btn.dataset.emoji);
    // Всем остальным через Broadcast (не пишем в БД — реакции эфемерны)
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
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ==== 9. Старт ====
loadHistory();
