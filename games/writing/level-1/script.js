const NORWEGIAN_ALPHABET = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z', 'Æ', 'Ø', 'Å'
];

const TOTAL_STEPS = 10;
const INTRO_TEXT = 'Hjelp pandaen over brua ved å skrive bokstaven på tastaturet';

const letterDisplayEl = document.getElementById('letter-display');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');

let currentTarget = null;
let acceptingInput = false;
let progress = 0;

function pickTarget() {
    const choices = NORWEGIAN_ALPHABET.filter(letter => letter !== currentTarget);
    return choices[Math.floor(Math.random() * choices.length)];
}

function newRound() {
    currentTarget = pickTarget();
    letterDisplayEl.textContent = currentTarget;
    letterDisplayEl.className = 'letter-display';
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    acceptingInput = true;
}

function handleCorrectInput() {
    acceptingInput = false;
    letterDisplayEl.classList.add('is-correct');
    feedbackEl.textContent = 'BRA! 🌟';
    feedbackEl.className = 'feedback is-correct';
    progress += 1;
    scoreEl.textContent = String(progress);
    bridgeEl.progress = progress / TOTAL_STEPS;
    bridgeEl.walk();

    AgoraTTS.speak('Riktig!', { feedback: true });
    setTimeout(() => {
        if (progress >= TOTAL_STEPS) showVictory();
        else newRound();
    }, 900);
}

function handleWrongInput() {
    letterDisplayEl.classList.remove('is-wrong');
    void letterDisplayEl.offsetWidth;
    letterDisplayEl.classList.add('is-wrong');
    feedbackEl.textContent = 'PRØV IGJEN';
    feedbackEl.className = 'feedback is-wrong';
    AgoraTTS.speak('Prøv igjen', { feedback: true });
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

document.addEventListener('keydown', event => {
    if (!acceptingInput || event.ctrlKey || event.altKey || event.metaKey) return;

    const key = event.key.toLocaleUpperCase('nb-NO');
    if (!NORWEGIAN_ALPHABET.includes(key)) return;
    if (event.repeat) return;

    if (key === currentTarget) handleCorrectInput();
    else handleWrongInput();
});

victoryEl.addEventListener('agora-retry', restartGame);

(async function start() {
    await AgoraTTS.init();
    await AgoraTTS.speak(INTRO_TEXT);
    newRound();
})();