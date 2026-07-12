/* Agora — Reading Level 2
 * Play a Norwegian letter name, child taps the matching lowercase letter.
 */

// Norwegian alphabet (29 letters, bokmål) in lowercase.
const NORWEGIAN_ALPHABET = [
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
    'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
    'u', 'v', 'w', 'x', 'y', 'z', 'æ', 'ø', 'å'
];

const TILES_PER_ROUND = 6;
const TOTAL_STEPS = 10;

const gridEl = document.getElementById('letter-grid');
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

const VOICE_STORAGE_KEY = 'agora.reading.voiceName';

let currentTarget = null;
let currentTiles = [];
let acceptingInput = false;
let progress = 0;
let norwegianVoice = null;
let availableVoices = [];

/* ---------- Voice setup ---------- */

// Preferred Norwegian female voice names across common TTS providers.
// The picker will try these in order before falling back to any Norwegian
// voice. Match is case-insensitive substring on `voice.name`.
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

    // 1. Look for a preferred female voice by name substring, in priority order.
    for (const wanted of PREFERRED_FEMALE_VOICE_NAMES) {
        const match = norwegian.find(v =>
            v.name.toLowerCase().includes(wanted.toLowerCase())
        );
        if (match) return match;
    }

    // 2. Fall back to any voice whose name/URI hints at "female".
    const femaleHint = norwegian.find(v => {
        const haystack = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
        return /female|kvinne|dame/.test(haystack);
    });
    if (femaleHint) return femaleHint;

    // 3. Fall back to the best-matching Norwegian voice.
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
        // Safety fallback: some browsers never fire voiceschanged.
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

    // Restore previously chosen voice if it still exists.
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
    // Prefer Norwegian voices, but always let the user try any voice as a fallback.
    const preferred = norwegianVoices.length ? norwegianVoices : availableVoices;
    if (preferred.length <= 1) {
        // Nothing meaningful to pick from — keep it hidden.
        return;
    }

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
        // Preview the new voice using the current target letter, or "a" as a demo.
        speakLetter(currentTarget || 'a');
    });
}

function safeGetItem(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

function safeSetItem(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/* ---------- Speaking ---------- */

function speakLetter(letter) {
    if (!('speechSynthesis' in window)) return;

    // Cancel anything currently queued so rapid clicks don't stack.
    speechSynthesis.cancel();

    // Speak the lowercase form so voices don't announce it as "stor X" (capital X).
    const utterance = new SpeechSynthesisUtterance(letter.toLowerCase());
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

        // Safety fallback in case onend never fires (some browsers).
        setTimeout(resolve, 3000);
    });
}

/* ---------- Round logic ---------- */

function pickRandom(arr, n, exclude = new Set()) {
    const pool = arr.filter(x => !exclude.has(x));
    // Shuffle (Fisher–Yates) and take first n.
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n);
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    // Pick a target that is different from the previous target (if possible).
    const excludeTarget = currentTarget
        ? new Set([currentTarget])
        : new Set();
    const [target] = pickRandom(NORWEGIAN_ALPHABET, 1, excludeTarget);
    currentTarget = target;

    // Pick distractors from letters other than the target.
    const distractors = pickRandom(
        NORWEGIAN_ALPHABET,
        TILES_PER_ROUND - 1,
        new Set([target])
    );

    // Combine and shuffle again so the target isn't always first.
    currentTiles = [target, ...distractors];
    for (let i = currentTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentTiles[i], currentTiles[j]] = [currentTiles[j], currentTiles[i]];
    }

    renderTiles();
    acceptingInput = true;
    speakLetter(target);
}

function renderTiles() {
    gridEl.innerHTML = '';
    for (const letter of currentTiles) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'letter-tile';
        btn.textContent = letter;
        btn.setAttribute('aria-label', `Bokstav ${letter}`);
        btn.addEventListener('click', () => handleTileClick(btn, letter));
        gridEl.appendChild(btn);
    }
}

function handleTileClick(tileEl, letter) {
    if (!acceptingInput) return;

    if (letter === currentTarget) {
        acceptingInput = false;
        tileEl.classList.add('is-correct');
        feedbackEl.textContent = 'BRA! 🌟';
        feedbackEl.classList.add('is-correct');
        progress += 1;
        scoreEl.textContent = String(progress);
        stepPanda();

        // Disable the rest so they can't spam-click during transition.
        for (const t of gridEl.querySelectorAll('.letter-tile')) {
            if (t !== tileEl) t.disabled = true;
        }

        // Wait for "Riktig!" to finish speaking AND for the panda animation
        // to visibly progress before moving on. Whichever takes longer wins.
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
        // Remove shake animation class after it finishes so it can replay.
        setTimeout(() => tileEl.classList.remove('is-wrong'), 500);
    }
}

/* ---------- Panda progress ---------- */

function stepPanda() {
    bridgeEl.style.setProperty('--progress', progress / TOTAL_STEPS);
    // Retrigger the waddle animation.
    pandaEl.classList.remove('is-walking');
    // Force reflow so the animation restarts cleanly.
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
    // Move focus for accessibility / easy keyboard restart.
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
    if (currentTarget) speakLetter(currentTarget);
});

retryBtn.addEventListener('click', restartGame);

// Keyboard shortcut: pressing the matching letter also counts.
document.addEventListener('keydown', event => {
    if (!acceptingInput) return;
    const key = event.key.toLowerCase();
    if (!NORWEGIAN_ALPHABET.includes(key)) return;
    const tile = Array.from(gridEl.querySelectorAll('.letter-tile'))
        .find(t => t.textContent === key);
    if (tile) handleTileClick(tile, key);
});

/* ---------- Boot ---------- */

(async function start() {
    await initVoice();
    newRound();
})();
