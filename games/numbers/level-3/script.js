/* Agora — Numbers Level 3
 * Play a Norwegian number name (0–100), child taps the matching numeral.
 * A round shows the correct number plus a handful of distractors so the
 * grid stays readable across the full 0–100 range.
 */

const MIN_NUMBER = 0;
const MAX_NUMBER = 100;
const TILES_PER_ROUND = 12;

const ALL_NUMBERS = [];
for (let i = MIN_NUMBER; i <= MAX_NUMBER; i++) ALL_NUMBERS.push(i);

// Norwegian spellings drive the TTS so we reliably hear the right word
// (e.g. "tjuefem") rather than the browser guessing.
const ONES = ['null', 'én', 'to', 'tre', 'fire', 'fem', 'seks', 'sju', 'åtte', 'ni'];
const TEENS = [
    'ti', 'elleve', 'tolv', 'tretten', 'fjorten',
    'femten', 'seksten', 'sytten', 'atten', 'nitten'
];
const TENS = ['', '', 'tjue', 'tretti', 'førti', 'femti', 'seksti', 'sytti', 'åtti', 'nitti'];

function norwegianWord(n) {
    if (n === 100) return 'hundre';
    if (n < 10) return ONES[n];
    if (n < 20) return TEENS[n - 10];
    const t = Math.floor(n / 10);
    const o = n % 10;
    if (o === 0) return TENS[t];
    return TENS[t] + ONES[o];
}

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

function speakNumber(num) {
    return AgoraTTS.speak(norwegianWord(num));
}

AgoraTTS.addEventListener('speakingstart', e => {
    if (!e.detail?.feedback) replayBtn.classList.add('is-speaking');
});
AgoraTTS.addEventListener('speakingend', e => {
    if (!e.detail?.feedback) replayBtn.classList.remove('is-speaking');
});

/* ---------- Round logic ---------- */

function pickRandomNumber(exclude) {
    let n;
    do {
        n = ALL_NUMBERS[Math.floor(Math.random() * ALL_NUMBERS.length)];
    } while (n === exclude);
    return n;
}

function pickDistractors(target, count) {
    const pool = ALL_NUMBERS.filter(n => n !== target);
    // Fisher–Yates shuffle up to `count` items.
    for (let i = 0; i < count && i < pool.length; i++) {
        const j = i + Math.floor(Math.random() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    currentTarget = pickRandomNumber(currentTarget);

    const distractors = pickDistractors(currentTarget, TILES_PER_ROUND - 1);
    const tiles = [currentTarget, ...distractors];
    // Shuffle final tile order so the target isn't always first.
    for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    renderTiles(tiles);

    acceptingInput = true;
    speakNumber(currentTarget);
}

function renderTiles(numbers) {
    gridEl.innerHTML = '';
    for (const num of numbers) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'number-tile';
        btn.textContent = String(num);
        btn.setAttribute('aria-label', `Tall ${num}`);
        btn.addEventListener('click', () => handleTileClick(btn, num));
        gridEl.appendChild(btn);
    }
}

function handleTileClick(tileEl, num) {
    if (!acceptingInput) return;

    if (num === currentTarget) {
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
    if (currentTarget != null) speakNumber(currentTarget);
});

victoryEl.addEventListener('agora-retry', restartGame);

/* ---------- Boot ---------- */

(async function start() {
    await AgoraTTS.init();
    newRound();
})();
