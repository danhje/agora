/* Agora — Klokka Nivå 1
 * Speak a whole-hour time in Norwegian; child picks the analog clock
 * (out of three) that shows that time. Distractors are other whole hours.
 */

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const CHOICES_PER_ROUND = 3;
const TOTAL_STEPS = 10;

// Norwegian names for whole-hour readings. "Klokka er ett" uses the neuter
// form "ett"; the rest are the same as regular counting.
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
        speakHour(currentTarget || 3);
    });
}

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ---------- Speaking ---------- */

function speakHour(hour) {
    if (!('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const word = NORWEGIAN_HOUR_WORDS[hour] || String(hour);
    const utterance = new SpeechSynthesisUtterance(`Klokka er ${word}`);
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

function buildClockSvg(hour) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    svg.setAttribute('class', 'clock');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Analog klokke som viser klokka ${hour}`);

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

    // Hour hand (points at the given hour, minute hand at 12)
    const hourAngle = (hour % 12) * 30;
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

    const minuteHand = document.createElementNS(SVG_NS, 'line');
    minuteHand.setAttribute('x1', '100');
    minuteHand.setAttribute('y1', '100');
    minuteHand.setAttribute('x2', '100');
    minuteHand.setAttribute('y2', '30');
    minuteHand.setAttribute('stroke', '#547d3d');
    minuteHand.setAttribute('stroke-width', '5');
    minuteHand.setAttribute('stroke-linecap', 'round');
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

function pickRandomHour(exclude) {
    const pool = HOURS.filter(h => h !== exclude);
    return pool[Math.floor(Math.random() * pool.length)];
}

function pickDistractors(target, count) {
    const pool = shuffle(HOURS.filter(h => h !== target));
    return pool.slice(0, count);
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    currentTarget = pickRandomHour(currentTarget);
    const distractors = pickDistractors(currentTarget, CHOICES_PER_ROUND - 1);
    const choices = shuffle([currentTarget, ...distractors]);

    renderChoices(choices);

    acceptingInput = true;
    speakHour(currentTarget);
}

function renderChoices(hours) {
    gridEl.innerHTML = '';
    for (const hour of hours) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'clock-tile';
        btn.dataset.hour = String(hour);
        btn.setAttribute('aria-label', `Klokka ${hour}`);
        btn.appendChild(buildClockSvg(hour));
        btn.addEventListener('click', () => handleTileClick(btn, hour));
        gridEl.appendChild(btn);
    }
}

function handleTileClick(tileEl, hour) {
    if (!acceptingInput) return;

    if (hour === currentTarget) {
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
    if (currentTarget) speakHour(currentTarget);
});

retryBtn.addEventListener('click', restartGame);

// Keyboard shortcut: 1, 2, 3 pick the first, second, third clock on screen.
document.addEventListener('keydown', event => {
    if (!acceptingInput) return;
    const idx = { '1': 0, '2': 1, '3': 2 }[event.key];
    if (idx === undefined) return;
    const tile = gridEl.querySelectorAll('.clock-tile')[idx];
    if (!tile || tile.disabled) return;
    handleTileClick(tile, Number(tile.dataset.hour));
});

/* ---------- Boot ---------- */

(async function start() {
    await initVoice();
    newRound();
})();
