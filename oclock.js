/**
 * oclock.js — цифровые часы + день недели + дата
 * Версия: 3.2.1
 *
 * Время (ЧЧ:ММ:СС) → #clockContainer (по центру шапки)
 * День недели + дата → #clockSubRight (справа в шапке)
 *
 * Подключение:
 *   <div id="clockContainer"></div>
 *   <div id="clockSubRight"></div>
 *   <script src="oclock.js?v=3.2.1"></script>
 *   initClock('clockContainer', 'clockSubRight');
 */

(function (global) {
    'use strict';

    var DAY_NAMES_FULL = [
        'Воскресенье',
        'Понедельник',
        'Вторник',
        'Среда',
        'Четверг',
        'Пятница',
        'Суббота'
    ];

    var _intervalId = null;
    var _clockId = null;
    var _subId = null;
    var _offsetMs = 0;
    var _freezeTime = false;
    var _frozenTime = null;

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    function getNow() {
        if (_freezeTime && _frozenTime !== null) {
            return new Date(_frozenTime);
        }
        return new Date(Date.now() + _offsetMs);
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

    function tick() {
        var d = getNow();

        var clockContainer = document.getElementById(_clockId);
        if (clockContainer) {
            var timeEl = clockContainer.querySelector('.clock-time');
            if (timeEl) {
                var t = formatTime(d);
                if (timeEl.textContent !== t) timeEl.textContent = t;
            }
        }

        var subRight = document.getElementById(_subId);
        if (subRight) {
            var dayEl  = subRight.querySelector('.clock-day');
            var dateEl = subRight.querySelector('.clock-date');
            if (dayEl) {
                var dayText = getDayFull(d);
                if (dayEl.textContent !== dayText) dayEl.textContent = dayText;
            }
            if (dateEl) {
                var dateText = formatDate(d);
                if (dateEl.textContent !== dateText) dateEl.textContent = dateText;
            }
        }
    }

    function initClock(clockContainerId, subRightId) {
        var clockId = clockContainerId || 'clockContainer';
        var subId = subRightId || 'clockSubRight';

        var clockContainer = document.getElementById(clockId);
        var subRight = document.getElementById(subId);

        if (!clockContainer) {
            console.warn('oclock.js: контейнер #' + clockId + ' не найден');
            return null;
        }
        if (!subRight) {
            console.warn('oclock.js: контейнер #' + subId + ' не найден');
        }

        if (_intervalId !== null) {
            clearInterval(_intervalId);
            _intervalId = null;
        }

        _clockId = clockId;
        _subId = subId;

        clockContainer.innerHTML =
            '<span class="clock-time">--:--:--</span>';

        if (subRight) {
            subRight.innerHTML =
                '<span class="clock-day">—</span>' +
                '<span class="clock-date">--.--.----</span>';
        }

        tick();

        _intervalId = setInterval(tick, 1000);

        return clockContainer;
    }

    global.initClock = initClock;

    global.__clockModule = {
        init: initClock,

        stop: function () {
            if (_intervalId !== null) {
                clearInterval(_intervalId);
                _intervalId = null;
            }
        },

        setTimeOffset: function (ms) {
            _offsetMs = Number(ms) || 0;
            _freezeTime = false;
            _frozenTime = null;
            tick();
        },

        freezeAt: function (timestampMs) {
            _freezeTime = true;
            _frozenTime = Number(timestampMs) || Date.now();
            tick();
        },

        unfreeze: function () {
            _freezeTime = false;
            _frozenTime = null;
            tick();
        },

        getTimeOffset: function () {
            return _offsetMs;
        },

        isFrozen: function () {
            return _freezeTime;
        }
    };

})(typeof window !== 'undefined' ? window : this);