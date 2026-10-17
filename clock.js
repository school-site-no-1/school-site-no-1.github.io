/* clock.js — часы + панель тестирования времени
 *
 * URL-параметры:
 *   ?test=1            — показать панель
 *   ?now=HH:MM         — стартовое время
 *   ?speed=N           — стартовая скорость (×N)
 *   ?vdow=0..6         — стартовый день недели (0=ПН … 6=СБ)
 *
 * Панель: ползунок времени, ползунок скорости, выбор дня недели,
 *         Play/Pause, «Сейчас», индикатор.
 */
(function installVirtualTime() {
    'use strict';

    var DOW_LABELS = ['ПН','ВТ','СР','ЧТ','ПТ','СБ'];

    var params     = new URLSearchParams(window.location.search);
    var nowParam   = params.get('now');
    var speedParam = parseFloat(params.get('speed') || '0');
    var vdowParam  = params.get('vdow');
    var showPanel  = params.get('test') === '1' || !!nowParam || speedParam > 1 ||
                     (vdowParam !== null);

    var RealDate  = Date;
    var realStart = RealDate.now();

    // ---- реальный «сегодняшний» понедельник как точка отсчёта ----
    // Нам нужно уметь сдвигать дату так, чтобы getDay() возвращал нужный день.
    var realToday = new RealDate();
    // 0=Вс..6=Сб в JS → приводим к 0=Пн..5=Сб (всё остальное = Вс → -1)
    var realDowMon0 = (realToday.getDay() + 6) % 7; // 0=Пн, 6=Вс
    if (realDowMon0 > 5) realDowMon0 = 5;           // если воскресенье — считаем «Сб» для UI

    // ---- состояние ----
    var state = {
        minutesOfDay: (function () {
            if (nowParam && /^\d{1,2}:\d{2}$/.test(nowParam)) {
                var p = nowParam.split(':');
                return Math.min(1439, Math.max(0, (+p[0]) * 60 + (+p[1])));
            }
            var d = new RealDate();
            return d.getHours() * 60 + d.getMinutes();
        })(),
        speed: (speedParam > 1) ? speedParam : 1,
        running: showPanel,
        // 0=Пн … 5=Сб. Если не задан — берём реальный день (или Сб, если Вс)
        vdow: (function () {
            if (vdowParam !== null) {
                var n = parseInt(vdowParam, 10);
                if (!isNaN(n) && n >= 0 && n <= 5) return n;
            }
            return realDowMon0;
        })(),
        baseRealMs: realStart,
        baseVirtualMs: 0
    };

    // Сдвиг даты (в днях) относительно реальной, чтобы getDay()==нужный день
    function dowShiftDays() {
        return state.vdow - realDowMon0;
    }

    // Виртуальная дата-объект на «сегодня» (полночь) с учётом vdow
    function virtualTodayMs() {
        var d = new RealDate();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + dowShiftDays());
        return d.getTime() + state.minutesOfDay * 60000;
    }
    state.baseVirtualMs = virtualTodayMs();

    function virtualNowMs() {
        if (!state.running) return state.baseVirtualMs;
        var elapsedReal = RealDate.now() - state.baseRealMs;
        return state.baseVirtualMs + elapsedReal * state.speed;
    }

    function recalcBase() {
        state.baseVirtualMs = virtualTodayMs();
        state.baseRealMs = RealDate.now();
    }

    function setMinutes(min) {
        min = Math.min(1439, Math.max(0, min));
        var vNow = new RealDate(virtualNowMs());
        // сохраняем секунды/миллисекунды, меняем только часы/минуты
        state.minutesOfDay = min;
        var d = new RealDate();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + dowShiftDays());
        state.baseVirtualMs = d.getTime() + min * 60000 +
                              vNow.getSeconds() * 1000 + vNow.getMilliseconds();
        state.baseRealMs = RealDate.now();
    }

    function setSpeed(sp) {
        sp = Math.min(3600, Math.max(1, sp));
        var v = virtualNowMs();
        state.speed = sp;
        state.baseVirtualMs = v;
        state.baseRealMs = RealDate.now();
    }

    function setDow(dow) {
        dow = Math.min(5, Math.max(0, dow));
        if (dow === state.vdow) return;
        state.vdow = dow;
        recalcBase();
        emitChange();
    }

    function play() {
        if (state.running) return;
        state.baseVirtualMs = virtualNowMs();
        state.baseRealMs = RealDate.now();
        state.running = true;
    }
    function pause() {
        if (!state.running) return;
        state.baseVirtualMs = virtualNowMs();
        state.running = false;
    }
    function resetToReal() {
        var d = new RealDate();
        state.running = false;
        state.speed = 1;
        state.minutesOfDay = d.getHours() * 60 + d.getMinutes();
        state.vdow = realDowMon0;
        recalcBase();
        emitChange();
    }

    // ---- подмена Date ----
    function FakeDate() {
        if (arguments.length === 0) return new RealDate(virtualNowMs());
        var args = Array.prototype.slice.call(arguments);
        return new (Function.prototype.bind.apply(RealDate, [null].concat(args)))();
    }
    FakeDate.prototype = RealDate.prototype;
    FakeDate.now   = virtualNowMs;
    FakeDate.parse = RealDate.parse;
    FakeDate.UTC   = RealDate.UTC;
    window.Date = FakeDate;

    // ---- событие для страницы ----
    function emitChange() {
        try {
            document.dispatchEvent(new CustomEvent('virtualtime:change', {
                detail: window.__virtualTime.getState()
            }));
        } catch (e) { /* старые браузеры — игнорируем */ }
    }

    // ---- публичное API ----
    window.__virtualTime = {
        isActive: function () { return showPanel; },
        getState: function () {
            var now = new RealDate(virtualNowMs());
            return {
                minutesOfDay: state.minutesOfDay,
                speed: state.speed,
                running: state.running,
                vdow: state.vdow,
                dowLabel: DOW_LABELS[state.vdow],
                now: now
            };
        },
        setMinutes: function (m) { setMinutes(m); emitChange(); },
        setSpeed:   function (s) { setSpeed(s); },
        setDow:     function (d) { setDow(d); },
        play:       play,
        pause:      pause,
        toggle:     function () { state.running ? pause() : play(); emitChange(); },
        reset:      resetToReal
    };

    // ---- утилиты форматирования ----
    function pad(n){ return String(n).padStart(2,'0'); }
    function fmtHM(ms){ var d=new RealDate(ms); return pad(d.getHours())+':'+pad(d.getMinutes()); }
    function fmtHMS(ms){ var d=new RealDate(ms);
        return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()); }

    // ---- панель ----
    function buildPanel() {
        if (!showPanel) return;
        if (document.getElementById('vtime-panel')) return;

        var css = ''
            + '#vtime-panel{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);'
            +   'z-index:99999;background:#1a202c;color:#fff;border-radius:10px;'
            +   'padding:8px 12px 6px;box-shadow:0 6px 24px rgba(0,0,0,.35);'
            +   'font:600 12px/1.2 "Segoe UI",Arial,sans-serif;'
            +   'display:flex;flex-direction:column;gap:6px;min-width:360px;max-width:96vw;'
            +   'border:1px solid #2d3748;user-select:none;}'
            + '#vtime-panel .row{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;}'
            + '#vtime-panel input[type=range]{-webkit-appearance:none;appearance:none;'
            +   'height:6px;border-radius:3px;background:#4a5568;outline:none;flex:1 1 auto;'
            +   'cursor:pointer;min-width:80px;}'
            + '#vtime-panel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;'
            +   'appearance:none;width:16px;height:16px;border-radius:50%;background:#f6ad55;'
            +   'border:2px solid #fff;cursor:pointer;box-shadow:0 0 0 2px rgba(246,173,85,.4);}'
            + '#vtime-panel input[type=range]::-moz-range-thumb{width:16px;height:16px;'
            +   'border-radius:50%;background:#f6ad55;border:2px solid #fff;cursor:pointer;}'
            + '#vtime-panel .time{font-family:"Courier New",monospace;font-weight:700;'
            +   'font-size:14px;letter-spacing:.5px;color:#f6ad55;min-width:72px;text-align:center;}'
            + '#vtime-panel button{background:#4a5568;color:#fff;border:none;border-radius:6px;'
            +   'padding:5px 10px;font:600 12px/1 "Segoe UI",Arial,sans-serif;cursor:pointer;'
            +   'transition:background .15s;white-space:nowrap;}'
            + '#vtime-panel button:hover{background:#2d3748;}'
            + '#vtime-panel button.play{background:#38a169;}'
            + '#vtime-panel button.play:hover{background:#2f855a;}'
            + '#vtime-panel button.pause{background:#dd6b20;}'
            + '#vtime-panel button.pause:hover{background:#c05621;}'
            + '#vtime-panel .label{font-size:11px;color:#a0aec0;min-width:60px;text-align:right;}'
            + '#vtime-panel .hint{font-size:10px;color:#718096;text-align:center;}'
            + '#vtime-panel .close{position:absolute;top:6px;right:8px;background:none;'
            +   'color:#a0aec0;font-size:14px;padding:0 4px;line-height:1;}'
            + '#vtime-panel .close:hover{color:#fff;background:none;}'
            + '#vtime-panel .dow{display:flex;gap:4px;flex:1;justify-content:flex-start;}'
            + '#vtime-panel .dow button{flex:0 0 auto;min-width:34px;padding:4px 0;'
            +   'background:#2d3748;border:1px solid #4a5568;}'
            + '#vtime-panel .dow button.active{background:#3182ce;border-color:#63b3ed;'
            +   'box-shadow:0 0 0 2px rgba(99,179,237,.35);}'
            + 'body.has-vtime-panel{padding-bottom:140px;}';

        var styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        var speedPresets = [1, 10, 30, 60, 300, 1800, 3600];
        var speedIdx = speedPresets.indexOf(state.speed);
        if (speedIdx < 0) speedIdx = 0;

        var panel = document.createElement('div');
        panel.id = 'vtime-panel';
        panel.innerHTML =
            '<button class="close" title="Скрыть">✕</button>'
          + '<div class="row">'
          +   '<span class="label">День:</span>'
          +   '<div class="dow" id="vt-dow">'
          +     ['ПН','ВТ','СР','ЧТ','ПТ','СБ'].map(function(l,i){
                    return '<button data-dow="'+i+'"'+
                           (i===state.vdow?' class="active"':'')+'>'+l+'</button>';
                }).join('')
          +   '</div>'
          + '</div>'
          + '<div class="row">'
          +   '<span class="label">Время:</span>'
          +   '<input type="range" id="vt-range" min="0" max="1439" step="1" value="'+state.minutesOfDay+'">'
          +   '<span class="time" id="vt-clock">00:00</span>'
          + '</div>'
          + '<div class="row">'
          +   '<span class="label">Скорость:</span>'
          +   '<input type="range" id="vt-speed" min="0" max="'+(speedPresets.length-1)+'" step="1" value="'+speedIdx+'">'
          +   '<span class="time" id="vt-speed-val" style="min-width:60px;">×'+state.speed+'</span>'
          + '</div>'
          + '<div class="row">'
          +   '<button class="play" id="vt-play">▶ Играть</button>'
          +   '<button id="vt-reset">🕐 Сейчас</button>'
          +   '<span class="hint" id="vt-hint" style="flex:1;text-align:right;">'
          +     'вирт. время: <b id="vt-info" style="color:#f6ad55;">—</b>'
          +   '</span>'
          + '</div>';

        document.body.appendChild(panel);
        document.body.classList.add('has-vtime-panel');

        var range    = panel.querySelector('#vt-range');
        var clock    = panel.querySelector('#vt-clock');
        var spdRng   = panel.querySelector('#vt-speed');
        var spdVal   = panel.querySelector('#vt-speed-val');
        var playBtn  = panel.querySelector('#vt-play');
        var resetBtn = panel.querySelector('#vt-reset');
        var infoEl   = panel.querySelector('#vt-info');
        var dowBox   = panel.querySelector('#vt-dow');

        function refreshUI() {
            var s = window.__virtualTime.getState();
            var ms = s.now.getTime();
            clock.textContent = fmtHM(ms);
            range.value = s.now.getHours() * 60 + s.now.getMinutes();
            spdVal.textContent = '×' + s.speed;
            playBtn.textContent = s.running ? '⏸ Пауза' : '▶ Играть';
            playBtn.className = s.running ? 'pause' : 'play';
            infoEl.textContent = s.dowLabel + ', ' + fmtHMS(ms) +
                                 ' · ×' + s.speed + (s.running ? ' · ▶' : ' · ⏸');
            // подсветка дня
            Array.prototype.forEach.call(dowBox.children, function(b){
                var i = parseInt(b.dataset.dow, 10);
                b.classList.toggle('active', i === s.vdow);
            });
        }

        range.addEventListener('input', function () {
            window.__virtualTime.setMinutes(parseInt(range.value, 10));
            refreshUI();
        });

        spdRng.addEventListener('input', function () {
            var sp = speedPresets[parseInt(spdRng.value, 10)];
            window.__virtualTime.setSpeed(sp);
            refreshUI();
        });

        dowBox.addEventListener('click', function (e) {
            var btn = e.target.closest('button[data-dow]');
            if (!btn) return;
            window.__virtualTime.setDow(parseInt(btn.dataset.dow, 10));
            refreshUI();
        });

        playBtn.addEventListener('click', function () {
            window.__virtualTime.toggle();
            refreshUI();
        });
        resetBtn.addEventListener('click', function () {
            window.__virtualTime.reset();
            refreshUI();
        });
        panel.querySelector('.close').addEventListener('click', function () {
            panel.remove();
            document.body.classList.remove('has-vtime-panel');
        });

        // Автообновление индикатора
        setInterval(refreshUI, 250);
        refreshUI();
    }

    if (showPanel) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', buildPanel);
        } else {
            buildPanel();
        }
    }
})();

/* ===== Часы в шапке ===== */
function initClock(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var svg = ''
        + '<svg viewBox="0 0 24 24" fill="none" stroke="#2d3748" stroke-width="2" '
        + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        +   '<circle cx="12" cy="12" r="9"></circle>'
        +   '<polyline points="12 7 12 12 15 14"></polyline>'
        + '</svg>';

    function tick() {
        var now = new Date();
        var hh = String(now.getHours()).padStart(2,'0');
        var mm = String(now.getMinutes()).padStart(2,'0');
        var ss = String(now.getSeconds()).padStart(2,'0');
        var dateStr = now.toLocaleDateString('ru-RU');
        el.innerHTML =
            '<div class="clock-wrapper">'
          +   svg
          +   '<div class="clock-text">'
          +     '<div class="date">' + dateStr + '</div>'
          +     '<div class="digital-time">' + hh + ':' + mm + ':' + ss + '</div>'
          +   '</div>'
          + '</div>';
    }
    tick();
    setInterval(tick, 1000);
}