/* Agora — Numbers Level 1
 * Play a Norwegian number name (0–9), child taps the matching digit.
 */

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Norwegian spellings drive the TTS so we get "null", "én", "to", ... rather
// than the browser trying to guess how to say a bare digit.
const NORWEGIAN_NUMBER_WORDS = {
    '0': 'null',
    '1': 'én',
    '2': 'to',
    '3': 'tre',
    '4': 'fire',
    '5': 'fem',
    '6': 'seks',
    '7': 'sju',
    '8': 'åtte',
    '9': 'ni'
};

const TOTAL_STEPS = 10;

const gridEl = document.getElementById('number-grid');
const replayBtn = document.getElementById('replay-button');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const voiceWarningEl = document.getElementById('voice-warning');
const voicePickerEl = document.getElementById('voice-picker');
const voiceSelectEl = document.getElementById('voice-select');
const bridgeEl = document.getElementById('bridge');
const pandaEl = document.getElementById('panda');
const victoryEl = document.getElementById('victory');
const retryBtn = document.getElementById('retry-btn');

// Shared with reading level 1 so a saved voice choice carries over.
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
        speakDigit(currentTarget || '1');
    });
}

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ---------- Speaking ---------- */

function speakDigit(digit) {
    if (!('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

    const word = NORWEGIAN_NUMBER_WORDS[digit] || digit;
    const utterance = new SpeechSynthesisUtterance(word);
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

/* ---------- Round logic ---------- */

function pickRandomDigit(exclude) {
    const pool = DIGITS.filter(d => d !== exclude);
    return pool[Math.floor(Math.random() * pool.length)];
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    currentTarget = pickRandomDigit(currentTarget);

    // Re-enable all tiles and clear feedback classes.
    for (const t of gridEl.querySelectorAll('.number-tile')) {
        t.disabled = false;
        t.classList.remove('is-correct', 'is-wrong');
    }

    acceptingInput = true;
    speakDigit(currentTarget);
}

function renderTiles() {
    gridEl.innerHTML = '';
    for (const digit of DIGITS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'number-tile';
        btn.textContent = digit;
        btn.setAttribute('aria-label', `Tall ${digit}`);
        btn.addEventListener('click', () => handleTileClick(btn, digit));
        gridEl.appendChild(btn);
    }
}

function handleTileClick(tileEl, digit) {
    if (!acceptingInput) return;

    if (digit === currentTarget) {
        acceptingInput = false;
        tileEl.classList.add('is-correct');
        feedbackEl.textContent = 'BRA! 🌟';
        feedbackEl.classList.add('is-correct');
        progress += 1;
        scoreEl.textContent = String(progress);
        stepPanda();

        for (const t of gridEl.querySelectorAll('.number-tile')) {
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
        feedbackEl.textContent = 'PRØV IGJEN';
        feedbackEl.classList.add('is-wrong');
        speakFeedback('Feil');
        setTimeout(() => tileEl.classList.remove('is-wrong'), 500);
    }
}

/* ---------- Panda progress ---------- */

function stepPanda() {
    bridgeEl.style.setProperty('--progress', progress / TOTAL_STEPS);
    pandaEl.classList.remove('is-walking');
    void pandaEl.offsetWidth;
    pandaEl.classList.add('is-walking');
}

function resetPanda() {
    progress = 0;
    bridgeEl.style.setProperty('--progress', 0);
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
    if (currentTarget) speakDigit(currentTarget);
});

retryBtn.addEventListener('click', restartGame);

// Keyboard shortcut: pressing 0–9 also counts.
document.addEventListener('keydown', event => {
    if (!acceptingInput) return;
    if (!DIGITS.includes(event.key)) return;
    const tile = Array.from(gridEl.querySelectorAll('.number-tile'))
        .find(t => t.textContent === event.key);
    if (tile) handleTileClick(tile, event.key);
});

/* ---------- Boot ---------- */

(async function start() {
    renderTiles();
    await initVoice();
    newRound();
})();
