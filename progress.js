/* Agora – progress tracking via localStorage.
 *
 * Stores a map of { "<category>/<level>": "YYYY-MM-DD" } under a single key.
 * On the main menu, decorates game cards completed *today* with a checkmark.
 * Individual games call window.AgoraProgress.markCompleted() on victory.
 */
(function () {
    const STORAGE_KEY = 'agora:completedByDate';

    function todayKey() {
        // Local calendar date, e.g. "2026-07-12".
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function readStore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : {};
        } catch (_e) {
            return {};
        }
    }

    function writeStore(store) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        } catch (_e) {
            // Ignore quota / private-mode errors – progress is a nice-to-have.
        }
    }

    function gameIdFromPath(pathname) {
        // Matches "games/<category>/<level>" anywhere in the path.
        const m = pathname.match(/games\/([^/]+)\/([^/]+)/);
        return m ? `${m[1]}/${m[2]}` : null;
    }

    function markCompleted(id) {
        const gameId = id || gameIdFromPath(window.location.pathname);
        if (!gameId) return;
        const store = readStore();
        store[gameId] = todayKey();
        writeStore(store);
    }

    function completedTodaySet() {
        const store = readStore();
        const today = todayKey();
        const set = new Set();
        for (const [id, date] of Object.entries(store)) {
            if (date === today) set.add(id);
        }
        return set;
    }

    function decorateMenu() {
        const done = completedTodaySet();
        if (!done.size) return;
        const cards = document.querySelectorAll('.game-card');
        cards.forEach(card => {
            const href = card.getAttribute('href') || '';
            const id = gameIdFromPath(href);
            if (!id || !done.has(id)) return;
            card.classList.add('game-card--done');
            if (!card.querySelector('.game-card__check')) {
                const check = document.createElement('span');
                check.className = 'game-card__check';
                check.setAttribute('aria-label', 'Fullført i dag');
                check.textContent = '✓';
                card.appendChild(check);
            }
        });
    }

    window.AgoraProgress = {
        markCompleted,
        completedTodaySet,
        decorateMenu,
    };

    function onReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    onReady(() => {
        // Auto-decorate the main menu when present.
        if (document.querySelector('.categories')) decorateMenu();
    });
})();
