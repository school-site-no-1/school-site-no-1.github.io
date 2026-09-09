/**
 * clock14.js — отдельный модуль для часов в стиле #14
 * Цвета: время RGB(43,108,176) · дата/день RGB(79,122,156)
 * 
 * Использование:
 *   1. Подключите этот файл в HTML: <script src="clock14.js"></script>
 *   2. Вызовите initClock14(containerId) с ID контейнера
 *   3. Функция создаст внутри контейнера структуру часов и запустит обновление
 * 
 * Возвращает объект { update, destroy, setColors } для управления
 */

(function(global) {
  "use strict";

  // Цвета по заданию
  const DEFAULT_TIME_COLOR = '#2b6cb0';   // RGB(43,108,176)
  const DEFAULT_DATE_COLOR = '#4f7a9c';   // RGB(79,122,156)

  // Массив дней недели (полные названия)
  const DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

  // Хранилище активных экземпляров (для возможности управления)
  const instances = [];

  /**
   * Основная функция инициализации часов
   * @param {string} containerId - ID элемента, куда будут вставлены часы
   * @param {object} options - опциональные настройки
   * @param {string} options.timeColor - цвет времени (hex)
   * @param {string} options.dateColor - цвет даты и дня (hex)
   * @param {string} options.label - текст метки (по умолчанию '#14')
   * @returns {object} API для управления экземпляром
   */
  function initClock14(containerId, options) {
    options = options || {};

    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`clock14.js: контейнер с id "${containerId}" не найден`);
      return null;
    }

    // Очищаем контейнер (на случай повторной инициализации)
    container.innerHTML = '';

    // Создаём структуру
    const labelEl = document.createElement('div');
    labelEl.className = 'clock-label';
    labelEl.textContent = options.label || '#14';

    const timeEl = document.createElement('div');
    timeEl.className = 'clock-time';
    timeEl.textContent = '00:00:00';

    const dayDateEl = document.createElement('div');
    dayDateEl.className = 'clock-daydate';

    const datePart = document.createElement('span');
    datePart.className = 'date-part';
    datePart.textContent = '01.01.2026';

    const dayPart = document.createElement('span');
    dayPart.className = 'day-part';
    dayPart.textContent = 'Понедельник';

    dayDateEl.appendChild(datePart);
    dayDateEl.appendChild(dayPart);

    container.appendChild(labelEl);
    container.appendChild(timeEl);
    container.appendChild(dayDateEl);

    // Применяем цвета
    const timeColor = options.timeColor || DEFAULT_TIME_COLOR;
    const dateColor = options.dateColor || DEFAULT_DATE_COLOR;
    timeEl.style.color = timeColor;
    datePart.style.color = dateColor;
    dayPart.style.color = dateColor;

    // Переменные для управления интервалом
    let intervalId = null;
    let isDestroyed = false;

    // Функция обновления
    function update() {
      if (isDestroyed) return;

      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const timeStr = `${h}:${m}:${s}`;

      const dayName = DAYS_FULL[now.getDay()];
      const d = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${d}.${month}.${year}`;

      timeEl.textContent = timeStr;
      datePart.textContent = dateStr;
      dayPart.textContent = dayName;
    }

    // Запускаем обновление
    update();
    intervalId = setInterval(update, 1000);

    // API для управления экземпляром
    const instanceApi = {
      /**
       * Обновить цвета
       * @param {string} newTimeColor - цвет времени (hex)
       * @param {string} newDateColor - цвет даты и дня (hex)
       */
      setColors: function(newTimeColor, newDateColor) {
        if (newTimeColor) {
          timeEl.style.color = newTimeColor;
        }
        if (newDateColor) {
          datePart.style.color = newDateColor;
          dayPart.style.color = newDateColor;
        }
      },

      /**
       * Принудительно обновить отображение
       */
      update: function() {
        update();
      },

      /**
       * Остановить часы и очистить контейнер
       */
      destroy: function() {
        if (isDestroyed) return;
        isDestroyed = true;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        container.innerHTML = '';
        // Удаляем из списка экземпляров
        const idx = instances.indexOf(instanceApi);
        if (idx !== -1) {
          instances.splice(idx, 1);
        }
      },

      /**
       * Получить текущие элементы DOM (для отладки)
       */
      getElements: function() {
        return {
          container: container,
          time: timeEl,
          date: datePart,
          day: dayPart,
          label: labelEl
        };
      }
    };

    // Сохраняем экземпляр
    instances.push(instanceApi);

    return instanceApi;
  }

  // Экспортируем в глобальную область
  global.initClock14 = initClock14;

  // Для совместимости с модулями (если используется)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = initClock14;
  }

})(typeof window !== 'undefined' ? window : this);