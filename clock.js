/* ============================
   ЧАСЫ
   ============================ */
#clockContainer {
    transform: scale(0.6);
    transform-origin: top right;
    margin-top: 5pt;
}
.clock-wrapper {
    display: flex;
    align-items: center;
    gap: 3px;
}
.clock-wrapper svg {
    width: 19px;
    height: 19px;
    transform: rotate(0deg) !important;
    transform-origin: center;
}
.clock-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    white-space: nowrap;
}
.clock-text .digital-time {
    font-size: 0.45em;
    color: #2b6cb0;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
}
.clock-text .date {
    font-size: 0.55em;          /* ← увеличена */
    color: #2d3748;
    font-weight: 600;
    line-height: 1.1;
}
.clock-text .countdown {
    display: none !important;
}
/* День недели (внизу) */
.clock-day-row {
    font-size: 0.4em;
    color: #4a5568;
    font-weight: 600;
    line-height: 1.1;
}
.clock-day-row .day-name {
    color: #2b6cb0;
    font-weight: 700;
}