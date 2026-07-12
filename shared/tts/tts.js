/* Agora — window.AgoraTTS singleton.
 *
 * A tiny wrapper around the browser SpeechSynthesis API that:
 *   - loads voices asynchronously (with a safety timeout for browsers
 *     that never fire `voiceschanged`),
 *   - auto-picks a preferred Norwegian female voice,
 *   - remembers the user's choice across games via one localStorage key,
 *   - dispatches `ready`, `voicechanged`, `speakingstart`, `speakingend`
 *     events so UI (replay buttons, voice pickers) can react.
 *
 * Usage:
 *
 *   await AgoraTTS.init();                             // once at page load
 *   AgoraTTS.speak('a');                               // fire-and-forget target
 *   await AgoraTTS.speak('Riktig!', { feedback: true }); // await for pacing
 *   AgoraTTS.cancel();
 *
 * Events fire on the AgoraTTS object itself (it's an EventTarget):
 *   - 'ready'          — voice list loaded (may fire even with 0 voices)
 *   - 'voicechanged'   — currentVoice was updated
 *   - 'speakingstart'  — detail: { feedback: boolean }
 *   - 'speakingend'    — detail: { feedback: boolean }
 */
(function () {
    const STORAGE_KEY = 'agora.voiceName';

    // Preferred Norwegian female voice names across common TTS providers.
    // Tried in order before falling back to any Norwegian voice.
    const PREFERRED_FEMALE_VOICE_NAMES = [
        'Pernille', // Microsoft Natural / Azure Neural (nb-NO)
        'Iselin',   // Azure Neural (nb-NO)
        'Nora',     // macOS / iOS (nb-NO)
        'Ingrid',   // macOS (nb-NO)
        'Hulda',    // Windows SAPI (nb-NO)
        'Klara'     // Historical macOS (nb-NO)
    ];

    const DEFAULT_TARGET_OPTS   = { rate: 0.85, pitch: 1.05 };
    const DEFAULT_FEEDBACK_OPTS = { rate: 1.0,  pitch: 1.10 };

    // Safety timeout for `speak()` promises — some browsers occasionally
    // skip onend/onerror, and we don't want round pacing to stall forever.
    const SPEAK_SAFETY_TIMEOUT_MS = 3000;
    // Safety timeout for voice list loading.
    const VOICES_SAFETY_TIMEOUT_MS = 1500;

    function isNorwegianVoice(v) {
        return v && v.lang && /^(nb|no)/i.test(v.lang);
    }

    function pickNorwegianVoice(voices) {
        const norwegian = voices.filter(isNorwegianVoice);
        if (!norwegian.length) return null;

        for (const wanted of PREFERRED_FEMALE_VOICE_NAMES) {
            const match = norwegian.find(v =>
                v.name.toLowerCase().includes(wanted.toLowerCase())
            );
            if (match) return match;
        }

        const femaleHint = norwegian.find(v => {
            const haystack = `${v.name} ${v.voiceURI || ''}`.toLowerCase();
            return /female|kvinne|dame/.test(haystack);
        });
        if (femaleHint) return femaleHint;

        return (
            norwegian.find(v => v.lang === 'nb-NO') ||
            norwegian.find(v => v.lang.toLowerCase().startsWith('nb')) ||
            norwegian[0]
        );
    }

    function loadVoicesOnce() {
        return new Promise(resolve => {
            const existing = speechSynthesis.getVoices();
            if (existing && existing.length) {
                resolve(existing);
                return;
            }
            const onChange = () => {
                speechSynthesis.removeEventListener('voiceschanged', onChange);
                resolve(speechSynthesis.getVoices());
            };
            speechSynthesis.addEventListener('voiceschanged', onChange);
            setTimeout(() => {
                speechSynthesis.removeEventListener('voiceschanged', onChange);
                resolve(speechSynthesis.getVoices());
            }, VOICES_SAFETY_TIMEOUT_MS);
        });
    }

    function safeGetItem(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    }
    function safeSetItem(key, value) {
        try { localStorage.setItem(key, value); } catch { /* ignore */ }
    }

    class AgoraTTSImpl extends EventTarget {
        constructor() {
            super();
            this._voices = [];
            this._currentVoice = null;
            this._initPromise = null;
            this._supported = 'speechSynthesis' in window;
        }

        get supported() { return this._supported; }

        get currentVoice() { return this._currentVoice; }

        get hasNorwegianVoice() {
            return this._voices.some(isNorwegianVoice);
        }

        getVoices() { return this._voices.slice(); }

        getNorwegianVoices() {
            return this._voices.filter(isNorwegianVoice);
        }

        init() {
            if (this._initPromise) return this._initPromise;
            this._initPromise = (async () => {
                if (!this._supported) {
                    this.dispatchEvent(new CustomEvent('ready'));
                    return;
                }
                this._voices = await loadVoicesOnce();

                const savedName = safeGetItem(STORAGE_KEY);
                const saved = savedName
                    ? this._voices.find(v => v.name === savedName)
                    : null;
                this._currentVoice = saved || pickNorwegianVoice(this._voices);

                this.dispatchEvent(new CustomEvent('ready'));
            })();
            return this._initPromise;
        }

        setCurrentVoice(name) {
            const chosen = this._voices.find(v => v.name === name);
            if (!chosen) return false;
            this._currentVoice = chosen;
            safeSetItem(STORAGE_KEY, chosen.name);
            this.dispatchEvent(new CustomEvent('voicechanged', {
                detail: { voice: chosen }
            }));
            return true;
        }

        cancel() {
            if (!this._supported) return;
            speechSynthesis.cancel();
        }

        /**
         * Speak `text`. Returns a Promise that resolves when speech ends
         * (or on error, or after a safety timeout). Callers awaiting the
         * promise get natural round pacing; fire-and-forget callers just
         * ignore it.
         *
         * Options:
         *   feedback  — use feedback rate/pitch and mark the event detail
         *   rate      — override rate (0.1–10)
         *   pitch     — override pitch (0–2)
         *   lang      — override BCP-47 lang tag (default 'nb-NO')
         */
        speak(text, options = {}) {
            if (!this._supported || text == null || text === '') {
                return Promise.resolve();
            }

            const feedback = options.feedback === true;
            const defaults = feedback ? DEFAULT_FEEDBACK_OPTS : DEFAULT_TARGET_OPTS;

            speechSynthesis.cancel();

            return new Promise(resolve => {
                const utterance = new SpeechSynthesisUtterance(String(text));
                utterance.lang  = options.lang  || 'nb-NO';
                utterance.rate  = options.rate  ?? defaults.rate;
                utterance.pitch = options.pitch ?? defaults.pitch;
                if (this._currentVoice) {
                    utterance.voice = this._currentVoice;
                }

                let settled = false;
                const finish = () => {
                    if (settled) return;
                    settled = true;
                    this.dispatchEvent(new CustomEvent('speakingend', {
                        detail: { feedback }
                    }));
                    resolve();
                };

                utterance.onend   = finish;
                utterance.onerror = finish;

                this.dispatchEvent(new CustomEvent('speakingstart', {
                    detail: { feedback }
                }));
                speechSynthesis.speak(utterance);

                setTimeout(finish, SPEAK_SAFETY_TIMEOUT_MS);
            });
        }
    }

    window.AgoraTTS = new AgoraTTSImpl();
})();
