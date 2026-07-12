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
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');

let currentTarget = null;
let currentTiles = [];
let acceptingInput = false;
let progress = 0;

/* ---------- Speaking ---------- */

function speakWord(word) {
    return AgoraTTS.speak(word);
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
    if (currentTarget) speakWord(currentTarget);
});

victoryEl.addEventListener('agora-retry', restartGame);

/* ---------- Boot ---------- */

(async function start() {
    await AgoraTTS.init();
    newRound();
})();
