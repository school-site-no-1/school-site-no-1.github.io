/**
 * oclock.js — цифровые часы + день недели + дата в одну строку
 * Версия: 3.0.0
 *
 * Порядок: ЧЧ:ММ:СС → Понедельник → ДД.ММ.ГГГГ
 *
 * Подключение:
 *   <div id="clockContainer"></div>
 *   <script src="oclock.js"></script>
 *   initClock('clockContainer');
 */

(function (global) {
    'use strict';

    var DAY_NAMES_FULL = [
        'Воскресенье', // 0
        'Понедельник', // 1
        'Вторник',     // 2
        'Среда',       // 3
        'Четверг',     // 4
        'Пятница',     // 5
        'Суббота'      // 6
    ];

    var _intervalId = null;
    var _containerId = null;

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function formatTime(d) {
        return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    }

    function formatDate(d) {
        return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
    }

    function getDayFull(d) {
        return DAY_NAMES_FULL[d.getDay()] || '—';
    }

    function tick(container) {
        var d = new Date();

        var timeEl = container.querySelector('.clock-time');
        var dayEl  = container.querySelector('.clock-day');
        var dateEl = container.querySelector('.clock-date');

        if (timeEl) timeEl.textContent = formatTime(d);
        if (dayEl)  dayEl.textContent  = getDayFull(d);
        if (dateEl) dateEl.textContent = formatDate(d);
    }

    function initClock(containerId) {
        var id = containerId || 'clockContainer';
        var container = document.getElementById(id);

        if (!container) {
            console.warn('oclock.js: контейнер #' + id + ' не найден');
            return null;
        }

        if (_intervalId !== null) {
            clearInterval(_intervalId);
            _intervalId = null;
        }

        _containerId = id;

        // ⭐ Порядок: часы → день недели (полностью) → дата
        container.innerHTML =
            '<div class="clock-line">' +
                '<span class="clock-time">--:--:--</span>' +
                '<span class="clock-day">—</span>' +
                '<span class="clock-date">--.--.----</span>' +
            '</div>';

        tick(container);

        _intervalId = setInterval(function () {
            var c = document.getElementById(_containerId);
            if (c) {
                tick(c);
            } else {
                if (_intervalId !== null) {
                    clearInterval(_intervalId);
                    _intervalId = null;
                }
            }
        }, 1000);

        return container;
    }

    global.initClock = initClock;

    global.__clockModule = {
        init: initClock,
        stop: function () {
            if (_intervalId !== null) {
                clearInterval(_intervalId);
                _intervalId = null;
            }
        }
    };

})(typeof window !== 'undefined' ? window : this);