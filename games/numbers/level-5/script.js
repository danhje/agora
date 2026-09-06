/* Agora — Numbers Level 5
 * Show 1–100 as compact groups of up to ten dots; the child taps the matching numeral.
 */

const MIN_TARGET = 1;
const MAX_TARGET = 100;
const TILES_PER_ROUND = 12;
const TOTAL_STEPS = 10;
const INTRO_TEXT = 'Hjelp pandaen over brua ved å telle prikkene';

const ALL_NUMBERS = Array.from(
    { length: MAX_TARGET - MIN_TARGET + 1 },
    (_, index) => index + MIN_TARGET
);

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
    const pool = ALL_NUMBERS.filter(number => number !== exclude);
    return pool[Math.floor(Math.random() * pool.length)];
}

function pickDistractors(target, count) {
    const pool = ALL_NUMBERS.filter(number => number !== target);
    for (let index = 0; index < count; index += 1) {
        const swapIndex = index + Math.floor(Math.random() * (pool.length - index));
        [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, count);
}

function createDot(position) {
    const dot = document.createElement('span');
    dot.className = position ? `dot dot--${position}` : 'dot';
    dot.setAttribute('aria-hidden', 'true');
    return dot;
}

function createDotGroup(count) {
    const group = document.createElement('span');
    group.className = `dot-group ${count <= 6 ? 'dot-group--dice' : 'dot-group--rows'}`;
    group.setAttribute('aria-hidden', 'true');

    if (count <= 6) {
        for (const position of DICE_POSITIONS[count]) {
            group.appendChild(createDot(position));
        }
    } else {
        for (let index = 0; index < count; index += 1) {
            group.appendChild(createDot());
        }
    }

    return group;
}

function renderDots(count) {
    dotBoardEl.innerHTML = '';
    dotBoardEl.setAttribute('aria-label', `${count} prikker`);

    let remaining = count;
    while (remaining > 0) {
        const groupSize = Math.min(10, remaining);
        dotBoardEl.appendChild(createDotGroup(groupSize));
        remaining -= groupSize;
    }
}

function renderTiles(numbers) {
    gridEl.innerHTML = '';
    for (const number of numbers) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'number-tile';
        button.textContent = String(number);
        button.setAttribute('aria-label', `Tall ${number}`);
        button.addEventListener('click', () => handleTileClick(button, number));
        gridEl.appendChild(button);
    }
}

function newRound() {
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    currentTarget = pickRandomTarget(currentTarget);
    renderDots(currentTarget);

    const choices = [currentTarget, ...pickDistractors(currentTarget, TILES_PER_ROUND - 1)];
    for (let index = choices.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
    }
    renderTiles(choices);
    acceptingInput = true;
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
        bridgeEl.progress = progress / TOTAL_STEPS;
        bridgeEl.walk();

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

function showVictory() {
    victoryEl.show();
    if (window.AgoraProgress) window.AgoraProgress.markCompleted();
}

function restartGame() {
    progress = 0;
    currentTarget = null;
    bridgeEl.reset();
    scoreEl.textContent = '0';
    newRound();
}

victoryEl.addEventListener('agora-retry', restartGame);

(async function start() {
    await AgoraTTS.init();
    await AgoraTTS.speak(INTRO_TEXT);
    newRound();
})();