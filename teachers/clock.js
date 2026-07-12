// clock.js - Аналоговые часы без секундной стрелки

function initClock(containerSelector) {
    // Если передан селектор, вставляем HTML в указанный контейнер
    if (containerSelector) {
        var container = document.querySelector(containerSelector);
        if (container) {
            container.innerHTML = 
                '<div style="display:flex;flex-direction:column;align-items:flex-end;font-family:\'Segoe UI\',Arial,sans-serif;gap:2px;">' +
                    '<div style="font-size:0.7em;color:#4a5568;font-weight:500;">' +
                        '📅 Сегодня: <span id="todayDayFull">Понедельник</span>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                        '<svg width="60" height="60" viewBox="0 0 60 60" style="flex-shrink:0;">' +
                            '<circle cx="30" cy="30" r="26" fill="none" stroke="#2b6cb0" stroke-width="2"/>' +
                            '<circle cx="30" cy="30" r="2" fill="#2b6cb0"/>' +
                            '<line id="hourHand" x1="30" y1="30" x2="30" y2="14" stroke="#1a365d" stroke-width="3" stroke-linecap="round"/>' +
                            '<line id="minuteHand" x1="30" y1="30" x2="30" y2="11" stroke="#2b6cb0" stroke-width="2" stroke-linecap="round"/>' +
                            '<line x1="30" y1="4" x2="30" y2="7" stroke="#a0aec0" stroke-width="1"/>' +
                            '<line x1="30" y1="53" x2="30" y2="56" stroke="#a0aec0" stroke-width="1"/>' +
                            '<line x1="4" y1="30" x2="7" y2="30" stroke="#a0aec0" stroke-width="1"/>' +
                            '<line x1="53" y1="30" x2="56" y2="30" stroke="#a0aec0" stroke-width="1"/>' +
                        '</svg>' +
                        '<div style="display:flex;flex-direction:column;align-items:flex-start;">' +
                            '<div style="font-size:1.6em;font-weight:700;color:#2b6cb0;letter-spacing:1px;">' +
                                '<span id="clockTime">00:00</span>' +
                            '</div>' +
                            '<div style="font-size:0.6em;color:#718096;">' +
                                '<span id="clockDateShort">00.00.0000</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }
    }

    function updateClock() {
        var now = new Date();
        var hours = now.getHours();
        var minutes = now.getMinutes();
        
        // Обновление цифрового времени
        var timeEl = document.getElementById('clockTime');
        if (timeEl) {
            timeEl.textContent = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
        }
        
        // Обновление даты
        var dateEl = document.getElementById('clockDateShort');
        if (dateEl) {
            dateEl.textContent = String(now.getDate()).padStart(2, '0') + '.' + 
                                 String(now.getMonth() + 1).padStart(2, '0') + '.' + 
                                 now.getFullYear();
        }
        
        // Обновление "Сегодня:"
        var dayEl = document.getElementById('todayDayFull');
        if (dayEl) {
            var daysFull = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
            dayEl.textContent = daysFull[now.getDay()];
        }
        
        // Обновление стрелок аналоговых часов (без секундной)
        var hourAngle = (hours % 12) * 30 + minutes * 0.5;
        var minuteAngle = minutes * 6;
        
        var hourHand = document.getElementById('hourHand');
        var minuteHand = document.getElementById('minuteHand');
        
        if (hourHand) {
            hourHand.setAttribute('transform', 'rotate(' + hourAngle + ', 30, 30)');
        }
        if (minuteHand) {
            minuteHand.setAttribute('transform', 'rotate(' + minuteAngle + ', 30, 30)');
        }
    }

    updateClock();
    setInterval(updateClock, 1000);
}