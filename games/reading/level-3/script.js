/* Agora — Reading Level 3
 * Play a short Norwegian word, child taps the matching word tile.
 */

// Short, easy Norwegian words (bokmål). All lowercase; the TTS voice reads
// them as normal words. Kept concrete and familiar for early readers.
const WORDS = [
    'sol', 'måne', 'stjerne', 'sky', 'snø', 'regn',
    'hus', 'bil', 'tog', 'båt', 'fly', 'sykkel',
    'ball', 'bok', 'sko', 'seng', 'kopp', 'stol',
    'katt', 'hund', 'fisk', 'fugl', 'hest', 'sau',
    'ku', 'gris', 'mus', 'bjørn', 'ulv', 'rev',
    'eple', 'banan', 'brød', 'ost', 'melk', 'kake',
    'is', 'saft', 'egg', 'suppe',
    'mor', 'far', 'gutt', 'jente', 'barn', 'venn',
    'tre', 'blomst', 'skog', 'fjell', 'strand', 'hage'
];

const TILES_PER_ROUND = 6;
const TOTAL_STEPS = 10;

const gridEl = document.getElementById('word-grid');
const replayBtn = document.getElementById('replay-button');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const voiceWarningEl = document.getElementById('voice-warning');
const voicePickerEl = document.getElementById('voice-picker');
const voiceSelectEl = document.getElementById('voice-select');
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');
const retryBtn = document.getElementById('retry-btn');

const VOICE_STORAGE_KEY = 'agora.reading.voiceName';

let currentTarget = null;
let currentTiles = [];
let acceptingInput = false;
let progress = 0;
let norwegianVoice = null;
let availableVoices = [];

/* ---------- Voice setup ---------- */

// Preferred Norwegian female voice names across common TTS providers.
const PREFERRED_FEMALE_VOICE_NAMES = [
    'Pernille', // Microsoft Natural / Azure Neural (nb-NO)
    'Iselin',   // Azure Neural (nb-NO)
    'Nora',     // macOS / iOS (nb-NO)
    'Ingrid',   // macOS (nb-NO)
    'Hulda',    // Windows SAPI (nb-NO)
    'Klara'     // Historical macOS (nb-NO)
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
    const norwegianVoices = availableVoices.filter(v =>
        v.lang && /^(nb|no)/i.test(v.lang)
    );

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
        // Preview the new voice using the current target word, or "sol" as a demo.
        speakWord(currentTarget || 'sol');
    });
}

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ---------- Speaking ---------- */

function speakWord(word) {
    if (!('speechSynthesis' in window)) return;

    speechSynthesis.cancel();

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

function pickRandom(arr, n, exclude = new Set()) {
    const pool = arr.filter(x => !exclude.has(x));
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    const excludeTarget = currentTarget
        ? new Set([currentTarget])
        : new Set();
    const [target] = pickRandom(WORDS, 1, excludeTarget);
    currentTarget = target;

    const distractors = pickRandom(
        WORDS,
        TILES_PER_ROUND - 1,
        new Set([target])
    );

    currentTiles = [target, ...distractors];
    for (let i = currentTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentTiles[i], currentTiles[j]] = [currentTiles[j], currentTiles[i]];
    }

    renderTiles();
    acceptingInput = true;
    speakWord(target);
}

function renderTiles() {
    gridEl.innerHTML = '';
    for (const word of currentTiles) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'word-tile';
        btn.textContent = word;
        btn.setAttribute('aria-label', `Ord: ${word}`);
        btn.addEventListener('click', () => handleTileClick(btn, word));
        gridEl.appendChild(btn);
    }
}

function handleTileClick(tileEl, word) {
    if (!acceptingInput) return;

    if (word === currentTarget) {
        acceptingInput = false;
        tileEl.classList.add('is-correct');
        feedbackEl.textContent = 'BRA! 🌟';
        feedbackEl.classList.add('is-correct');
        progress += 1;
        scoreEl.textContent = String(progress);
        stepPanda();

        for (const t of gridEl.querySelectorAll('.word-tile')) {
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
    if (currentTarget) speakWord(currentTarget);
});

retryBtn.addEventListener('click', restartGame);

/* ---------- Boot ---------- */

initVoice().then(newRound);
