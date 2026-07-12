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
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');

let currentTarget = null;
let currentTiles = [];
let acceptingInput = false;
let progress = 0;

/* ---------- Speaking ---------- */

function sayTarget(letter) {
    return AgoraTTS.speak(letter);
}

AgoraTTS.addEventListener('speakingstart', e => {
    if (!e.detail?.feedback) replayBtn.classList.add('is-speaking');
});
AgoraTTS.addEventListener('speakingend', e => {
    if (!e.detail?.feedback) replayBtn.classList.remove('is-speaking');
});

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
    const [target] = pickRandom(NORWEGIAN_ALPHABET, 1, excludeTarget);
    currentTarget = target;

    const distractors = pickRandom(
        NORWEGIAN_ALPHABET,
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
    sayTarget(target);
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

        for (const t of gridEl.querySelectorAll('.letter-tile')) {
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
    if (currentTarget) sayTarget(currentTarget);
});

victoryEl.addEventListener('agora-retry', restartGame);

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
    await AgoraTTS.init();
    newRound();
})();
