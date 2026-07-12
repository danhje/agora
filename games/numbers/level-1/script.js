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
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');

let currentTarget = null;
let acceptingInput = false;
let progress = 0;

/* ---------- Speaking ---------- */

function speakDigit(digit) {
    return AgoraTTS.speak(NORWEGIAN_NUMBER_WORDS[digit] || digit);
}

AgoraTTS.addEventListener('speakingstart', e => {
    if (!e.detail?.feedback) replayBtn.classList.add('is-speaking');
});
AgoraTTS.addEventListener('speakingend', e => {
    if (!e.detail?.feedback) replayBtn.classList.remove('is-speaking');
});

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
    if (currentTarget) speakDigit(currentTarget);
});

victoryEl.addEventListener('agora-retry', restartGame);

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
    await AgoraTTS.init();
    newRound();
})();
