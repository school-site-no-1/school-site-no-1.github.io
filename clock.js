// clock.js - Часы с днём недели внизу
(function() {
    function initClock(containerId) {
        var container = document.getElementById(containerId);
        if (!container) {
            console.warn('Контейнер для часов не найден:', containerId);
            return;
        }

        container.innerHTML = '';

        var wrapper = document.createElement('div');
        wrapper.className = 'clock-wrapper';

        // SVG циферблат
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('width', '50');
        svg.setAttribute('height', '50');

        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', 'rotate(0, 50, 50)');

        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '50');
        circle.setAttribute('cy', '50');
        circle.setAttribute('r', '45');
        circle.setAttribute('fill', '#f7fafc');
        circle.setAttribute('stroke', '#2b6cb0');
        circle.setAttribute('stroke-width', '3');
        g.appendChild(circle);

        for (var i = 1; i <= 12; i++) {
            var angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
            var x1 = 50 + 38 * Math.cos(angle);
            var y1 = 50 + 38 * Math.sin(angle);
            var x2 = 50 + 32 * Math.cos(angle);
            var y2 = 50 + 32 * Math.sin(angle);
            var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#2d3748');
            line.setAttribute('stroke-width', i % 3 === 0 ? '3' : '1.5');
            line.setAttribute('stroke-linecap', 'round');
            g.appendChild(line);
        }

        svg.appendChild(g);

        var hourHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hourHand.setAttribute('x1', '50');
        hourHand.setAttribute('y1', '50');
        hourHand.setAttribute('x2', '50');
        hourHand.setAttribute('y2', '28');
        hourHand.setAttribute('stroke', '#2b6cb0');
        hourHand.setAttribute('stroke-width', '4');
        hourHand.setAttribute('stroke-linecap', 'round');
        hourHand.setAttribute('id', 'hour-hand');
        svg.appendChild(hourHand);

        var minHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        minHand.setAttribute('x1', '50');
        minHand.setAttribute('y1', '50');
        minHand.setAttribute('x2', '50');
        minHand.setAttribute('y2', '18');
        minHand.setAttribute('stroke', '#2b6cb0');
        minHand.setAttribute('stroke-width', '3');
        minHand.setAttribute('stroke-linecap', 'round');
        minHand.setAttribute('id', 'min-hand');
        svg.appendChild(minHand);

        var center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        center.setAttribute('cx', '50');
        center.setAttribute('cy', '50');
        center.setAttribute('r', '4');
        center.setAttribute('fill', '#2b6cb0');
        svg.appendChild(center);

        wrapper.appendChild(svg);

        // Текстовый блок: время, дата, день недели
        var textBlock = document.createElement('div');
        textBlock.className = 'clock-text';

        // Цифровое время (сверху)
        var digitalSpan = document.createElement('span');
        digitalSpan.className = 'digital-time';
        digitalSpan.id = 'digital-time';
        digitalSpan.textContent = new Date().toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        textBlock.appendChild(digitalSpan);

        // Дата (посередине, увеличенная)
        var dateSpan = document.createElement('span');
        dateSpan.className = 'date';
        dateSpan.id = 'clock-date';
        dateSpan.textContent = new Date().toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        textBlock.appendChild(dateSpan);

        // День недели (внизу)
        var daySpan = document.createElement('span');
        daySpan.className = 'clock-day-row';
        daySpan.id = 'clock-day';
        var days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        daySpan.textContent = days[new Date().getDay()];
        textBlock.appendChild(daySpan);

        wrapper.appendChild(textBlock);
        container.appendChild(wrapper);

        function updateClock() {
            var now = new Date();
            var hours = now.getHours() % 12;
            var minutes = now.getMinutes();
            var seconds = now.getSeconds();

            var hourAngle = (hours * 30) + (minutes * 0.5) - 90;
            var minAngle = (minutes * 6) + (seconds * 0.1) - 90;

            var hourHandEl = document.getElementById('hour-hand');
            var minHandEl = document.getElementById('min-hand');

            if (hourHandEl) {
                hourHandEl.setAttribute('transform', 'rotate(' + hourAngle + ', 50, 50)');
            }
            if (minHandEl) {
                minHandEl.setAttribute('transform', 'rotate(' + minAngle + ', 50, 50)');
            }

            var digitalEl = document.getElementById('digital-time');
            if (digitalEl) {
                digitalEl.textContent = now.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            }

            var dateEl = document.getElementById('clock-date');
            if (dateEl) {
                dateEl.textContent = now.toLocaleDateString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            }

            var dayEl = document.getElementById('clock-day');
            if (dayEl) {
                var days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
                dayEl.textContent = days[now.getDay()];
            }
        }

        updateClock();
        setInterval(updateClock, 1000);
    }

    window.initClock = initClock;

    if (document.getElementById('clockContainer')) {
        initClock('clockContainer');
    }
})();