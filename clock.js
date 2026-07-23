// clock.js - Файл с часами для расписания учителей и админки
// Версия: 1.0.17
(function() {
    // Функция для создания и отображения часов
    window.initClock = function(containerId) {
        var container = document.getElementById(containerId);
        if (!container) {
            console.warn('Контейнер для часов не найден:', containerId);
            return;
        }
        
        // Очищаем контейнер
        container.innerHTML = '';
        
        // Создаем HTML для часов
        var clockDiv = document.createElement('div');
        clockDiv.style.display = 'flex';
        clockDiv.style.flexDirection = 'column';
        clockDiv.style.alignItems = 'flex-end';
        clockDiv.style.fontFamily = "'Segoe UI', Arial, sans-serif";
        clockDiv.style.gap = '2px';
        
        // Блок с циферблатом и временем
        var clockBlock = document.createElement('div');
        clockBlock.style.display = 'flex';
        clockBlock.style.alignItems = 'center';
        clockBlock.style.gap = '8px';
        
        // SVG циферблат
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '50');
        svg.setAttribute('height', '50');
        svg.setAttribute('viewBox', '0 0 55 55');
        svg.style.flexShrink = '0';
        svg.innerHTML = 
            '<circle cx="27.5" cy="27.5" r="23" fill="none" stroke="#2b6cb0" stroke-width="2"/>' +
            '<circle cx="27.5" cy="27.5" r="2" fill="#2b6cb0"/>' +
            '<line id="clockHourHand_' + containerId + '" x1="27.5" y1="27.5" x2="27.5" y2="13" stroke="#1a365d" stroke-width="2.5" stroke-linecap="round"/>' +
            '<line id="clockMinuteHand_' + containerId + '" x1="27.5" y1="27.5" x2="27.5" y2="11" stroke="#2b6cb0" stroke-width="2" stroke-linecap="round"/>' +
            '<line id="clockSecondHand_' + containerId + '" x1="27.5" y1="27.5" x2="27.5" y2="8" stroke="#e53e3e" stroke-width="1" stroke-linecap="round"/>' +
            '<line x1="27.5" y1="4.5" x2="27.5" y2="7.5" stroke="#a0aec0" stroke-width="1"/>' +
            '<line x1="27.5" y1="47.5" x2="27.5" y2="50.5" stroke="#a0aec0" stroke-width="1"/>' +
            '<line x1="4.5" y1="27.5" x2="7.5" y2="27.5" stroke="#a0aec0" stroke-width="1"/>' +
            '<line x1="47.5" y1="27.5" x2="50.5" y2="27.5" stroke="#a0aec0" stroke-width="1"/>';
        clockBlock.appendChild(svg);
        
        // Блок с цифровым временем и датой
        var textBlock = document.createElement('div');
        textBlock.style.display = 'flex';
        textBlock.style.flexDirection = 'column';
        textBlock.style.alignItems = 'flex-start';
        
        var timeDiv = document.createElement('div');
        timeDiv.style.display = 'flex';
        timeDiv.style.alignItems = 'center';
        timeDiv.style.gap = '0px';
        timeDiv.innerHTML = 
            '<span id="clockTimeDisplay_' + containerId + '" style="font-size:1.6em;font-weight:700;color:#2b6cb0;letter-spacing:1px;line-height:1.1;">00:00</span>' +
            '<span id="clockSecondsDisplay_' + containerId + '" style="font-size:1.6em;font-weight:700;color:#2b6cb0;letter-spacing:1px;line-height:1.1;">:00</span>';
        textBlock.appendChild(timeDiv);
        
        var dateDiv = document.createElement('div');
        dateDiv.style.fontSize = '0.9em';
        dateDiv.style.color = '#718096';
        dateDiv.style.lineHeight = '1';
        dateDiv.innerHTML = '<span id="clockDateDisplay_' + containerId + '">00.00.0000</span>';
        textBlock.appendChild(dateDiv);
        
        clockBlock.appendChild(textBlock);
        clockDiv.appendChild(clockBlock);
        container.appendChild(clockDiv);
        
        // Функция обновления часов
        function updateClock() {
            var now = new Date();
            var hours = now.getHours();
            var minutes = now.getMinutes();
            var seconds = now.getSeconds();
            
            var timeEl = document.getElementById('clockTimeDisplay_' + containerId);
            if (timeEl) {
                timeEl.textContent = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
            }
            
            var secondsEl = document.getElementById('clockSecondsDisplay_' + containerId);
            if (secondsEl) {
                secondsEl.textContent = ':' + String(seconds).padStart(2, '0');
            }
            
            var dateEl = document.getElementById('clockDateDisplay_' + containerId);
            if (dateEl) {
                dateEl.textContent = String(now.getDate()).padStart(2, '0') + '.' + 
                    String(now.getMonth() + 1).padStart(2, '0') + '.' + 
                    now.getFullYear();
            }
            
            var daysFull = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
            var dayEl = document.getElementById('clockTodayDay_' + containerId);
            if (dayEl) {
                dayEl.textContent = daysFull[now.getDay()];
            }
            
            // Вычисляем углы для стрелок
            var hourAngle = (hours % 12) * 30 + minutes * 0.5;
            var minuteAngle = minutes * 6 + seconds * 0.1;
            var secondAngle = seconds * 6;
            
            var hourHand = document.getElementById('clockHourHand_' + containerId);
            var minuteHand = document.getElementById('clockMinuteHand_' + containerId);
            var secondHand = document.getElementById('clockSecondHand_' + containerId);
            
            if (hourHand) {
                hourHand.setAttribute('transform', 'rotate(' + hourAngle + ', 27.5, 27.5)');
            }
            if (minuteHand) {
                minuteHand.setAttribute('transform', 'rotate(' + minuteAngle + ', 27.5, 27.5)');
            }
            if (secondHand) {
                secondHand.setAttribute('transform', 'rotate(' + secondAngle + ', 27.5, 27.5)');
            }
        }
        
        // Запускаем обновление
        updateClock();
        setInterval(updateClock, 1000);
    };
    
    // Если контейнер уже существует - инициализируем сразу
    if (document.getElementById('clockContainer')) {
        window.initClock('clockContainer');
    }
})();