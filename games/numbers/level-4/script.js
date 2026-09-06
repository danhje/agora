/* Agora — Numbers Level 4
 * Show 1–10 as dots; the child taps the matching numeral from 0–10.
 */

const NUMBERS = Array.from({ length: 11 }, (_, index) => index);
const MIN_TARGET = 1;
const MAX_TARGET = 10;
const TOTAL_STEPS = 10;
const INTRO_TEXT = 'Hjelp pandaen over brua ved å telle prikkene';

const DICE_POSITIONS = {
    1: ['middle-center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'middle-center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'middle-center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right']
};

const dotBoardEl = document.getElementById('dot-board');
const gridEl = document.getElementById('number-grid');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');

let currentTarget = null;
let acceptingInput = false;
let progress = 0;

function pickRandomTarget(exclude) {
    const pool = [];
    for (let number = MIN_TARGET; number <= MAX_TARGET; number += 1) {
        if (number !== exclude) pool.push(number);
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

function createDot(position) {
    const dot = document.createElement('span');
    dot.className = position ? `dot dot--${position}` : 'dot';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
}

function renderDots(count) {
    dotBoardEl.innerHTML = '';
    dotBoardEl.className = `dot-board ${count <= 6 ? 'dot-board--dice' : 'dot-board--rows'}`;
    dotBoardEl.setAttribute('aria-label', `${count} prikker`);

    if (count <= 6) {
        for (const position of DICE_POSITIONS[count]) {
            dotBoardEl.appendChild(createDot(position));
        }
        return;
    }

    for (let index = 0; index < count; index += 1) {
        dotBoardEl.appendChild(createDot());
    }
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    currentTarget = pickRandomTarget(currentTarget);
    renderDots(currentTarget);

    for (const tile of gridEl.querySelectorAll('.number-tile')) {
        tile.disabled = false;
        tile.classList.remove('is-correct', 'is-wrong');
    }

    acceptingInput = true;
}

function renderTiles() {
    for (const number of NUMBERS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'number-tile';
        button.textContent = String(number);
        button.setAttribute('aria-label', `Tall ${number}`);
        button.addEventListener('click', () => handleTileClick(button, number));
        gridEl.appendChild(button);
    }
}

function handleTileClick(tileEl, number) {
    if (!acceptingInput) return;

    if (number === currentTarget) {
        acceptingInput = false;
        tileEl.classList.add('is-correct');
        feedbackEl.textContent = 'BRA! 🌟';
        feedbackEl.classList.add('is-correct');
        progress += 1;
        scoreEl.textContent = String(progress);
        stepPanda();

        for (const tile of gridEl.querySelectorAll('.number-tile')) {
            if (tile !== tileEl) tile.disabled = true;
        }

        const start = Date.now();
        AgoraTTS.speak('Riktig!', { feedback: true }).then(() => {
            const remaining = Math.max(0, 900 - (Date.now() - start));
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

function stepPanda() {
    bridgeEl.progress = progress / TOTAL_STEPS;
    bridgeEl.walk();
}

function resetPanda() {
    progress = 0;
    bridgeEl.reset();
    scoreEl.textContent = '0';
}

function showVictory() {
    victoryEl.show();
    if (window.AgoraProgress) window.AgoraProgress.markCompleted();
}

function restartGame() {
    resetPanda();
    currentTarget = null;
    newRound();
}

victoryEl.addEventListener('agora-retry', restartGame);

(async function start() {
    renderTiles();
    await AgoraTTS.init();
    await AgoraTTS.speak(INTRO_TEXT);
    newRound();
})();