/* Agora — Klokka Nivå 2
 * Speak a whole-hour or half-hour time in Norwegian; child picks the analog
 * clock (out of three) that shows that time. Distractors mix whole and half
 * hours, so the child must pay attention to both hands.
 */

const CHOICES_PER_ROUND = 3;
const TOTAL_STEPS = 10;

// Norwegian names for whole-hour readings. "Klokka er ett" uses the neuter
// form "ett"; "halv ett" also uses "ett".
const NORWEGIAN_HOUR_WORDS = {
    1:  'ett',
    2:  'to',
    3:  'tre',
    4:  'fire',
    5:  'fem',
    6:  'seks',
    7:  'sju',
    8:  'åtte',
    9:  'ni',
    10: 'ti',
    11: 'elleve',
    12: 'tolv'
};

// Pools of times: hours 1..12 both on the hour (:00) and half past (:30).
// A time is represented as { h, m } with m ∈ {0, 30}. Half hours are
// weighted more heavily since they are the new challenge on this level.
const WHOLE_TIMES = Array.from({ length: 12 }, (_, i) => ({ h: i + 1, m: 0 }));
const HALF_TIMES  = Array.from({ length: 12 }, (_, i) => ({ h: i + 1, m: 30 }));
const HALF_PROBABILITY = 0.7;

const gridEl = document.getElementById('clock-grid');
const replayBtn = document.getElementById('replay-button');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');

let currentTarget = null;
let acceptingInput = false;
let progress = 0;

/* ---------- Speaking ---------- */

function speakTime(time) {
    return AgoraTTS.speak(timeToNorwegian(time));
}

AgoraTTS.addEventListener('speakingstart', e => {
    if (!e.detail?.feedback) replayBtn.classList.add('is-speaking');
});
AgoraTTS.addEventListener('speakingend', e => {
    if (!e.detail?.feedback) replayBtn.classList.remove('is-speaking');
});

/* ---------- Time helpers ---------- */

function nextHour(h) {
    return h === 12 ? 1 : h + 1;
}

function timeToNorwegian(time) {
    if (time.m === 0) {
        return `Klokka er ${NORWEGIAN_HOUR_WORDS[time.h]}`;
    }
    // "halv X" means 30 minutes before X (so 1:30 = "halv to").
    return `Klokka er halv ${NORWEGIAN_HOUR_WORDS[nextHour(time.h)]}`;
}

function timeToAriaLabel(time) {
    if (time.m === 0) {
        return `Analog klokke som viser klokka ${time.h}`;
    }
    return `Analog klokke som viser halv ${nextHour(time.h)}`;
}

function timeKey(time) {
    return `${time.h}:${time.m}`;
}

function timesEqual(a, b) {
    return a && b && a.h === b.h && a.m === b.m;
}

/* ---------- Speaking helpers wired up above ---------- */

/* ---------- Clock rendering ---------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildClockSvg(time) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'clock');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', timeToAriaLabel(time));

    // Face
    const face = document.createElementNS(SVG_NS, 'circle');
    face.setAttribute('cx', '100');
    face.setAttribute('cy', '100');
    face.setAttribute('r', '94');
    face.setAttribute('fill', '#fff8e7');
    face.setAttribute('stroke', '#5a4028');
    face.setAttribute('stroke-width', '6');
    svg.appendChild(face);

    const innerRing = document.createElementNS(SVG_NS, 'circle');
    innerRing.setAttribute('cx', '100');
    innerRing.setAttribute('cy', '100');
    innerRing.setAttribute('r', '88');
    innerRing.setAttribute('fill', 'none');
    innerRing.setAttribute('stroke', '#a07855');
    innerRing.setAttribute('stroke-width', '1.5');
    innerRing.setAttribute('opacity', '0.6');
    svg.appendChild(innerRing);

    // Hour ticks & numbers
    for (let i = 1; i <= 12; i++) {
        const angle = (i * 30) * Math.PI / 180;
        const sin = Math.sin(angle);
        const cos = Math.cos(angle);

        const isMajor = i % 3 === 0;
        const inner = isMajor ? 78 : 82;
        const outer = 88;

        const tick = document.createElementNS(SVG_NS, 'line');
        tick.setAttribute('x1', 100 + sin * inner);
        tick.setAttribute('y1', 100 - cos * inner);
        tick.setAttribute('x2', 100 + sin * outer);
        tick.setAttribute('y2', 100 - cos * outer);
        tick.setAttribute('stroke', '#5a4028');
        tick.setAttribute('stroke-width', isMajor ? 3.5 : 2);
        tick.setAttribute('stroke-linecap', 'round');
        svg.appendChild(tick);

        const numRadius = 66;
        const text = document.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', 100 + sin * numRadius);
        text.setAttribute('y', 100 - cos * numRadius);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-family', "'ABeeZee', 'Fredoka', sans-serif");
        text.setAttribute('font-size', '16');
        text.setAttribute('font-weight', '700');
        text.setAttribute('fill', '#3f5f2d');
        text.textContent = String(i);
        svg.appendChild(text);
    }

    // Hour hand — advances halfway toward the next hour when it's :30.
    const hourAngle = ((time.h % 12) + time.m / 60) * 30;
    const hourHand = document.createElementNS(SVG_NS, 'line');
    hourHand.setAttribute('x1', '100');
    hourHand.setAttribute('y1', '100');
    hourHand.setAttribute('x2', '100');
    hourHand.setAttribute('y2', '55');
    hourHand.setAttribute('stroke', '#3f5f2d');
    hourHand.setAttribute('stroke-width', '8');
    hourHand.setAttribute('stroke-linecap', 'round');
    hourHand.setAttribute('transform', `rotate(${hourAngle} 100 100)`);
    svg.appendChild(hourHand);

    // Minute hand — 12 for :00, 6 for :30.
    const minuteAngle = (time.m / 60) * 360;
    const minuteHand = document.createElementNS(SVG_NS, 'line');
    minuteHand.setAttribute('x1', '100');
    minuteHand.setAttribute('y1', '100');
    minuteHand.setAttribute('x2', '100');
    minuteHand.setAttribute('y2', '30');
    minuteHand.setAttribute('stroke', '#547d3d');
    minuteHand.setAttribute('stroke-width', '5');
    minuteHand.setAttribute('stroke-linecap', 'round');
    minuteHand.setAttribute('transform', `rotate(${minuteAngle} 100 100)`);
    svg.appendChild(minuteHand);

    // Center pin
    const pin = document.createElementNS(SVG_NS, 'circle');
    pin.setAttribute('cx', '100');
    pin.setAttribute('cy', '100');
    pin.setAttribute('r', '6');
    pin.setAttribute('fill', '#5a4028');
    svg.appendChild(pin);

    const pinDot = document.createElementNS(SVG_NS, 'circle');
    pinDot.setAttribute('cx', '100');
    pinDot.setAttribute('cy', '100');
    pinDot.setAttribute('r', '2.5');
    pinDot.setAttribute('fill', '#f5c34b');
    svg.appendChild(pinDot);

    return svg;
}

/* ---------- Round logic ---------- */

function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// Pick a time from the weighted pools, excluding any already-used times.
// Falls back to the other pool if the preferred one is exhausted.
function pickWeightedTime(excluded) {
    const preferHalf = Math.random() < HALF_PROBABILITY;
    const primary   = preferHalf ? HALF_TIMES  : WHOLE_TIMES;
    const secondary = preferHalf ? WHOLE_TIMES : HALF_TIMES;

    const primaryPool   = primary.filter(t => !excluded.some(e => timesEqual(e, t)));
    const secondaryPool = secondary.filter(t => !excluded.some(e => timesEqual(e, t)));
    const pool = primaryPool.length ? primaryPool : secondaryPool;

    return pool[Math.floor(Math.random() * pool.length)];
}

function pickRandomTime(exclude) {
    return pickWeightedTime(exclude ? [exclude] : []);
}

function pickDistractors(target, count) {
    const chosen = [target];
    for (let i = 0; i < count; i++) {
        chosen.push(pickWeightedTime(chosen));
    }
    return chosen.slice(1);
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    currentTarget = pickRandomTime(currentTarget);
    const distractors = pickDistractors(currentTarget, CHOICES_PER_ROUND - 1);
    const choices = shuffle([currentTarget, ...distractors]);

    renderChoices(choices);

    acceptingInput = true;
    speakTime(currentTarget);
}

function renderChoices(times) {
    gridEl.innerHTML = '';
    for (const time of times) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clock-tile';
        btn.dataset.time = timeKey(time);
        btn.setAttribute('aria-label', timeToAriaLabel(time));
        btn.appendChild(buildClockSvg(time));
        btn.addEventListener('click', () => handleTileClick(btn, time));
        gridEl.appendChild(btn);
    }
}

function handleTileClick(tileEl, time) {
    if (!acceptingInput) return;

    if (timesEqual(time, currentTarget)) {
        acceptingInput = false;
        tileEl.classList.add('is-correct');
        feedbackEl.textContent = 'BRA! 🌟';
        feedbackEl.classList.add('is-correct');
        progress += 1;
        scoreEl.textContent = String(progress);
        stepPanda();

        for (const t of gridEl.querySelectorAll('.clock-tile')) {
            if (t !== tileEl) t.disabled = true;
        }

        const MIN_DELAY_MS = 900;
        const start = Date.now();
        AgoraTTS.speak('Riktig!', { feedback: true }).then(() => {
            const elapsed = Date.now() - start;
            const remaining = Math.max(0, MIN_DELAY_MS - elapsed);
            setTimeout(() => {
                if (progress >= TOTAL_STEPS) showVictory();
                else newRound();
            }, remaining);
        });
    } else {
        tileEl.classList.add('is-wrong');
        tileEl.disabled = true;
        feedbackEl.textContent = 'PRØV IGJEN';
        feedbackEl.classList.add('is-wrong');
        AgoraTTS.speak('Feil', { feedback: true });
        setTimeout(() => tileEl.classList.remove('is-wrong'), 500);
    }
}

/* ---------- Panda progress ---------- */

function stepPanda() {
    bridgeEl.progress = progress / TOTAL_STEPS;
    bridgeEl.walk();
}

function resetPanda() {
    progress = 0;
    bridgeEl.reset();
    scoreEl.textContent = '0';
}

/* ---------- Victory ---------- */

function showVictory() {
    victoryEl.show();
    if (window.AgoraProgress) window.AgoraProgress.markCompleted();
}

function restartGame() {
    resetPanda();
    currentTarget = null;
    newRound();
}

/* ---------- Wiring ---------- */

replayBtn.addEventListener('click', () => {
    if (currentTarget) speakTime(currentTarget);
});

victoryEl.addEventListener('agora-retry', restartGame);

// Keyboard shortcut: 1, 2, 3 pick the first, second, third clock on screen.
document.addEventListener('keydown', event => {
    if (!acceptingInput) return;
    const idx = { '1': 0, '2': 1, '3': 2 }[event.key];
    if (idx === undefined) return;
    const tile = gridEl.querySelectorAll('.clock-tile')[idx];
    if (!tile || tile.disabled) return;
    const [h, m] = tile.dataset.time.split(':').map(Number);
    handleTileClick(tile, { h, m });
});

/* ---------- Boot ---------- */

(async function start() {
    await AgoraTTS.init();
    newRound();
})();
