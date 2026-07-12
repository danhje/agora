/* Agora — Numbers Level 2
 * Play a Norwegian number name (10–20), child taps the matching two-digit number.
 */

const NUMBERS = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];

// Norwegian spellings drive the TTS so we reliably hear "ti", "elleve", ...
// rather than the browser guessing how to say a bare two-digit numeral.
const NORWEGIAN_NUMBER_WORDS = {
    '10': 'ti',
    '11': 'elleve',
    '12': 'tolv',
    '13': 'tretten',
    '14': 'fjorten',
    '15': 'femten',
    '16': 'seksten',
    '17': 'sytten',
    '18': 'atten',
    '19': 'nitten',
    '20': 'tjue'
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

function speakNumber(num) {
    return AgoraTTS.speak(NORWEGIAN_NUMBER_WORDS[num] || num);
}

AgoraTTS.addEventListener('speakingstart', e => {
    if (!e.detail?.feedback) replayBtn.classList.add('is-speaking');
});
AgoraTTS.addEventListener('speakingend', e => {
    if (!e.detail?.feedback) replayBtn.classList.remove('is-speaking');
});

/* ---------- Round logic ---------- */

function pickRandomNumber(exclude) {
    const pool = NUMBERS.filter(n => n !== exclude);
    return pool[Math.floor(Math.random() * pool.length)];
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    currentTarget = pickRandomNumber(currentTarget);

    for (const t of gridEl.querySelectorAll('.number-tile')) {
        t.disabled = false;
        t.classList.remove('is-correct', 'is-wrong');
    }

    acceptingInput = true;
    speakNumber(currentTarget);
}

function renderTiles() {
    gridEl.innerHTML = '';
    for (const num of NUMBERS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'number-tile';
        btn.textContent = num;
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
    if (currentTarget) speakNumber(currentTarget);
});

victoryEl.addEventListener('agora-retry', restartGame);

/* ---------- Boot ---------- */

(async function start() {
    renderTiles();
    await AgoraTTS.init();
    newRound();
})();
