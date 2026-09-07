const WORDS = [
    'BI', 'BO', 'BY', 'BØ', 'DU', 'EI', 'EN', 'FE', 'GÅ', 'IS', 'KU', 'NY', 'ÅR',
    'BIL', 'BOK', 'BÅT', 'DYR', 'EGG', 'ELG', 'FAR', 'FLY', 'FOT', 'GUL', 'HEI',
    'HUS', 'JUL', 'LIV', 'LYS', 'MAT', 'MOR', 'MUS', 'OST', 'PIL', 'REV', 'RIS',
    'RØD', 'SAU', 'SKI', 'SKO', 'SKY', 'SOL', 'TOG', 'TRE', 'ULV', 'VÅR'
];

const NORWEGIAN_ALPHABET = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ');
const TOTAL_STEPS = 10;
const WRONG_INPUT_DURATION_MS = 480;
const INTRO_TEXT = 'Hjelp pandaen over brua ved å skrive ordene på tastaturet';

const wordDisplayEl = document.getElementById('word-display');
const wordInputEl = document.getElementById('word-input');
const feedbackEl = document.getElementById('feedback');
const scoreEl = document.getElementById('score');
const bridgeEl = document.getElementById('bridge');
const victoryEl = document.getElementById('victory');

let currentWord = null;
let typedCount = 0;
let acceptingInput = false;
let progress = 0;
let audioContext = null;

function pickWord() {
    const choices = WORDS.filter(word => word !== currentWord);
    return choices[Math.floor(Math.random() * choices.length)];
}

function makeLetter(className, letter = '') {
    const letterEl = document.createElement('span');
    letterEl.className = className;
    letterEl.textContent = letter;
    letterEl.setAttribute('aria-hidden', 'true');
    return letterEl;
}

function renderWord() {
    wordDisplayEl.replaceChildren();
    wordInputEl.replaceChildren();

    for (const letter of currentWord) {
        wordDisplayEl.appendChild(makeLetter('word-letter', letter));
        wordInputEl.appendChild(makeLetter('input-slot'));
    }

    wordDisplayEl.setAttribute('aria-label', `Ordet er ${currentWord.toLocaleLowerCase('nb-NO')}`);
    wordInputEl.setAttribute('aria-label', `Skriv ${currentWord.length} bokstaver`);
}

function newRound() {
    currentWord = pickWord();
    typedCount = 0;
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    wordInputEl.className = 'word-input';
    renderWord();
    acceptingInput = true;
}

function getAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContext) audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
}

function playPling() {
    const context = getAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    gain.connect(context.destination);

    for (const [frequency, volume] of [[880, 1], [1320, 0.45]]) {
        const oscillator = context.createOscillator();
        const partialGain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, now);
        partialGain.gain.value = volume;
        oscillator.connect(partialGain);
        partialGain.connect(gain);
        oscillator.start(now);
        oscillator.stop(now + 0.22);
    }
}

function playWrongSound() {
    const context = getAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(210, now);
    oscillator.frequency.exponentialRampToValueAtTime(105, now + 0.24);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
}

function handleCorrectLetter() {
    const letter = currentWord[typedCount];
    const targetLetterEl = wordDisplayEl.children[typedCount];
    const inputSlotEl = wordInputEl.children[typedCount];

    targetLetterEl.classList.add('is-typed');
    inputSlotEl.textContent = letter;
    inputSlotEl.classList.add('is-correct');
    typedCount += 1;
    playPling();

    if (typedCount === currentWord.length) completeWord();
}

function handleWrongLetter(letter) {
    acceptingInput = false;
    const inputSlotEl = wordInputEl.children[typedCount];
    inputSlotEl.textContent = letter;
    inputSlotEl.classList.add('is-wrong');
    wordInputEl.classList.add('is-wrong');
    feedbackEl.textContent = 'PRØV IGJEN';
    feedbackEl.className = 'feedback is-wrong';
    playWrongSound();

    setTimeout(() => {
        inputSlotEl.textContent = '';
        inputSlotEl.classList.remove('is-wrong');
        wordInputEl.classList.remove('is-wrong');
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback';
        acceptingInput = true;
    }, WRONG_INPUT_DURATION_MS);
}

function completeWord() {
    acceptingInput = false;
    wordInputEl.classList.add('is-complete');
    feedbackEl.textContent = 'BRA! 🌟';
    feedbackEl.className = 'feedback is-correct';
    progress += 1;
    scoreEl.textContent = String(progress);
    bridgeEl.progress = progress / TOTAL_STEPS;
    bridgeEl.walk();

    setTimeout(() => {
        if (progress >= TOTAL_STEPS) showVictory();
        else newRound();
    }, 900);
}

function showVictory() {
    victoryEl.show();
    if (window.AgoraProgress) window.AgoraProgress.markCompleted();
}

function restartGame() {
    progress = 0;
    currentWord = null;
    bridgeEl.reset();
    scoreEl.textContent = '0';
    newRound();
}

document.addEventListener('keydown', event => {
    if (!acceptingInput || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;

    const key = event.key.toLocaleUpperCase('nb-NO');
    if (!NORWEGIAN_ALPHABET.has(key)) return;

    if (key === currentWord[typedCount]) handleCorrectLetter();
    else handleWrongLetter(key);
});

victoryEl.addEventListener('agora-retry', restartGame);

(async function start() {
    await AgoraTTS.init();
    await AgoraTTS.speak(INTRO_TEXT);
    newRound();
})();