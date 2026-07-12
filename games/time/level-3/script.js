/* Agora — Klokka Nivå 3
 * Speak a whole-hour, half-hour, or quarter-hour time in Norwegian; child
 * picks the analog clock (out of three) that shows that time. Quarter hours
 * are the new challenge and are weighted most heavily, both for the target
 * and for the distractors.
 */

const CHOICES_PER_ROUND = 3;
const TOTAL_STEPS = 10;

// Norwegian names for whole-hour readings. "Klokka er ett" uses the neuter
// form "ett"; "halv ett", "kvart over ett" and "kvart på ett" do too.
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

// Pools of times: hours 1..12 across the four "quarters" of the hour.
// A time is represented as { h, m } with m ∈ {0, 15, 30, 45}. Each pool
// gets an independent weight; picks are drawn category-first so the mix
// stays close to the target percentages even in a short 10-round game.
const WHOLE_TIMES        = Array.from({ length: 12 }, (_, i) => ({ h: i + 1, m: 0  }));
const QUARTER_PAST_TIMES = Array.from({ length: 12 }, (_, i) => ({ h: i + 1, m: 15 }));
const HALF_TIMES         = Array.from({ length: 12 }, (_, i) => ({ h: i + 1, m: 30 }));
const QUARTER_TO_TIMES   = Array.from({ length: 12 }, (_, i) => ({ h: i + 1, m: 45 }));

// Weighted categories: 30% quarter past, 30% quarter to (60% total for
// quarters), 30% half hour, 10% whole hour.
const TIME_CATEGORIES = [
    { pool: QUARTER_PAST_TIMES, weight: 0.30 },
    { pool: QUARTER_TO_TIMES,   weight: 0.30 },
    { pool: HALF_TIMES,         weight: 0.30 },
    { pool: WHOLE_TIMES,        weight: 0.10 }
];

const gridEl = document.getElementById('clock-grid');
const replayBtn = document.getElementById('replay-button');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const voiceWarningEl = document.getElementById('voice-warning');
const voicePickerEl = document.getElementById('voice-picker');
const voiceSelectEl = document.getElementById('voice-select');
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');
const retryBtn = document.getElementById('retry-btn');

// Shared with the other games so a saved voice choice carries over.
const VOICE_STORAGE_KEY = 'agora.reading.voiceName';

let currentTarget = null;
let acceptingInput = false;
let progress = 0;
let norwegianVoice = null;
let availableVoices = [];

/* ---------- Voice setup ---------- */

const PREFERRED_FEMALE_VOICE_NAMES = [
    'Pernille',
    'Iselin',
    'Nora',
    'Ingrid',
    'Hulda',
    'Klara'
];

function isNorwegianVoice(v) {
    return v && v.lang && /^(nb|no)/i.test(v.lang);
}

function pickNorwegianVoice(voices) {
    const norwegian = voices.filter(isNorwegianVoice);
    if (!norwegian.length) return null;

    for (const wanted of PREFERRED_FEMALE_VOICE_NAMES) {
        const match = norwegian.find(v =>
            v.name.toLowerCase().includes(wanted.toLowerCase())
        );
        if (match) return match;
    }

    const femaleHint = norwegian.find(v => {
        const haystack = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
        return /female|kvinne|dame/.test(haystack);
    });
    if (femaleHint) return femaleHint;

    return (
        norwegian.find(v => v.lang === 'nb-NO') ||
        norwegian.find(v => v.lang.toLowerCase().startsWith('nb')) ||
        norwegian[0]
    );
}

function loadVoices() {
    return new Promise(resolve => {
        const existing = speechSynthesis.getVoices();
        if (existing && existing.length) {
            resolve(existing);
            return;
        }
        const onChange = () => {
            speechSynthesis.removeEventListener('voiceschanged', onChange);
            resolve(speechSynthesis.getVoices());
        };
        speechSynthesis.addEventListener('voiceschanged', onChange);
        setTimeout(() => {
            speechSynthesis.removeEventListener('voiceschanged', onChange);
            resolve(speechSynthesis.getVoices());
        }, 1500);
    });
}

async function initVoice() {
    if (!('speechSynthesis' in window)) {
        voiceWarningEl.textContent =
            '🌱 Denne nettleseren støtter ikke tale. Prøv Chrome, Edge eller Safari.';
        voiceWarningEl.hidden = false;
        return;
    }
    availableVoices = await loadVoices();
    const norwegianVoices = availableVoices.filter(isNorwegianVoice);

    const savedName = safeGetItem(VOICE_STORAGE_KEY);
    const saved = savedName
        ? availableVoices.find(v => v.name === savedName)
        : null;

    norwegianVoice = saved || pickNorwegianVoice(availableVoices);

    populateVoicePicker(norwegianVoices);

    if (!norwegianVoice) {
        voiceWarningEl.hidden = false;
    }
}

function populateVoicePicker(norwegianVoices) {
    const preferred = norwegianVoices.length ? norwegianVoices : availableVoices;
    if (preferred.length <= 1) return;

    voiceSelectEl.innerHTML = '';
    for (const voice of preferred) {
        const opt = document.createElement('option');
        opt.value = voice.name;
        opt.textContent = `${voice.name} (${voice.lang})`;
        if (norwegianVoice && voice.name === norwegianVoice.name) {
            opt.selected = true;
        }
        voiceSelectEl.appendChild(opt);
    }
    voicePickerEl.hidden = false;

    voiceSelectEl.addEventListener('change', () => {
        const chosen = availableVoices.find(v => v.name === voiceSelectEl.value);
        if (!chosen) return;
        norwegianVoice = chosen;
        safeSetItem(VOICE_STORAGE_KEY, chosen.name);
        if (currentTarget) speakTime(currentTarget);
    });
}

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ---------- Time helpers ---------- */

function nextHour(h) {
    return h === 12 ? 1 : h + 1;
}

function timeToNorwegian(time) {
    const hourWord     = NORWEGIAN_HOUR_WORDS[time.h];
    const nextHourWord = NORWEGIAN_HOUR_WORDS[nextHour(time.h)];
    switch (time.m) {
        case 0:  return `Klokka er ${hourWord}`;
        case 15: return `Klokka er kvart over ${hourWord}`;
        // "halv X" and "kvart på X" both refer to the next hour.
        case 30: return `Klokka er halv ${nextHourWord}`;
        case 45: return `Klokka er kvart på ${nextHourWord}`;
        default: return `Klokka er ${hourWord}`;
    }
}

function timeToAriaLabel(time) {
    const nextH = nextHour(time.h);
    switch (time.m) {
        case 0:  return `Analog klokke som viser klokka ${time.h}`;
        case 15: return `Analog klokke som viser kvart over ${time.h}`;
        case 30: return `Analog klokke som viser halv ${nextH}`;
        case 45: return `Analog klokke som viser kvart på ${nextH}`;
        default: return `Analog klokke som viser klokka ${time.h}`;
    }
}

function timeKey(time) {
    return `${time.h}:${time.m}`;
}

function timesEqual(a, b) {
    return a && b && a.h === b.h && a.m === b.m;
}

/* ---------- Speaking ---------- */

function speakTime(time) {
    if (!('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(timeToNorwegian(time));
    utterance.lang = 'nb-NO';
    utterance.rate = 0.85;
    utterance.pitch = 1.05;
    if (norwegianVoice) {
        utterance.voice = norwegianVoice;
    }

    replayBtn.classList.add('is-speaking');
    utterance.onend = () => replayBtn.classList.remove('is-speaking');
    utterance.onerror = () => replayBtn.classList.remove('is-speaking');

    speechSynthesis.speak(utterance);
}

function speakFeedback(text) {
    if (!('speechSynthesis' in window)) return Promise.resolve();

    speechSynthesis.cancel();

    return new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'nb-NO';
        utterance.rate = 1;
        utterance.pitch = 1.1;
        if (norwegianVoice) {
            utterance.voice = norwegianVoice;
        }
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);

        setTimeout(resolve, 3000);
    });
}

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

    // Hour hand — creeps toward the next hour based on the minute value.
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

    // Minute hand — 12/3/6/9 for :00/:15/:30/:45.
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

// Pick a time by first choosing a weighted category, then a random entry
// from that category's pool (excluding any already-used times). Falls back
// to any other category if the preferred pool is exhausted.
function pickWeightedTime(excluded) {
    const roll = Math.random();
    let acc = 0;
    let chosenIdx = TIME_CATEGORIES.length - 1;
    for (let i = 0; i < TIME_CATEGORIES.length; i++) {
        acc += TIME_CATEGORIES[i].weight;
        if (roll < acc) { chosenIdx = i; break; }
    }

    const order = [
        chosenIdx,
        ...TIME_CATEGORIES.map((_, i) => i).filter(i => i !== chosenIdx)
    ];
    for (const idx of order) {
        const pool = TIME_CATEGORIES[idx].pool
            .filter(t => !excluded.some(e => timesEqual(e, t)));
        if (pool.length) {
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }
    return null; // 48 unique times exist, so this should never happen.
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
        speakFeedback('Riktig!').then(() => {
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
        speakFeedback('Feil');
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
    victoryEl.hidden = false;
    if (window.AgoraProgress) window.AgoraProgress.markCompleted();
    retryBtn.focus();
}

function hideVictory() {
    victoryEl.hidden = true;
}

function restartGame() {
    hideVictory();
    resetPanda();
    currentTarget = null;
    newRound();
}

/* ---------- Wiring ---------- */

replayBtn.addEventListener('click', () => {
    if (currentTarget) speakTime(currentTarget);
});

retryBtn.addEventListener('click', restartGame);

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
    await initVoice();
    newRound();
})();
