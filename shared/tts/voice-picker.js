/* Agora — <agora-voice-picker> custom element.
 *
 * A self-contained fixed bottom-right dropdown for choosing the TTS
 * voice, backed by window.AgoraTTS. When no Norwegian voice is
 * installed, renders a warning badge in place of the dropdown so
 * games don't need a separate warning element.
 *
 * Usage:
 *
 *   <agora-voice-picker></agora-voice-picker>
 *
 * Requires:
 *   - shared/tts/tts.js loaded first (defines window.AgoraTTS).
 *   - AgoraTTS.init() to be called somewhere on the page. If it is
 *     not yet initialised when the element mounts, the component will
 *     call it itself.
 */
(function () {
    const CSS_URL = new URL('./voice-picker.css', document.currentScript.src).href;

    const NO_SUPPORT_MSG =
        '🌱 Denne nettleseren støtter ikke tale. Prøv Chrome, Edge eller Safari.';
    const NO_NORWEGIAN_MSG =
        '🌱 Ingen norsk stemme funnet. Installer en norsk (bokmål) TTS-stemme i systeminnstillingene for best opplevelse.';

    class AgoraVoicePicker extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
            if (this._rendered) return;
            this._rendered = true;

            this.shadowRoot.innerHTML = `
                <link rel="stylesheet" href="${CSS_URL}">
                <label class="picker" part="picker" hidden>
                    <span class="label">STEMME</span>
                    <select aria-label="Velg stemme"></select>
                </label>
                <p class="warning" part="warning" hidden></p>
            `;

            this._pickerEl  = this.shadowRoot.querySelector('.picker');
            this._selectEl  = this.shadowRoot.querySelector('select');
            this._warningEl = this.shadowRoot.querySelector('.warning');

            this._selectEl.addEventListener('change', () => {
                const chosen = this._selectEl.value;
                if (window.AgoraTTS?.setCurrentVoice(chosen)) {
                    // Preview the new voice with a short vowel so the user
                    // hears the change immediately.
                    window.AgoraTTS.speak('a');
                }
            });

            this._onReady        = () => this._render();
            this._onVoiceChanged = () => this._syncSelected();

            const tts = window.AgoraTTS;
            if (!tts) {
                this._showWarning(NO_SUPPORT_MSG);
                return;
            }
            tts.addEventListener('ready', this._onReady);
            tts.addEventListener('voicechanged', this._onVoiceChanged);
            // If the caller already initialised, render immediately;
            // otherwise kick off init so we're not dependent on ordering.
            tts.init().then(() => this._render());
        }

        disconnectedCallback() {
            const tts = window.AgoraTTS;
            if (!tts) return;
            tts.removeEventListener('ready', this._onReady);
            tts.removeEventListener('voicechanged', this._onVoiceChanged);
        }

        _render() {
            const tts = window.AgoraTTS;
            if (!tts || !tts.supported) {
                this._showWarning(NO_SUPPORT_MSG);
                return;
            }

            if (!tts.hasNorwegianVoice) {
                this._showWarning(NO_NORWEGIAN_MSG);
                return;
            }

            const norwegian = tts.getNorwegianVoices();
            // Only show the dropdown if there's a meaningful choice.
            if (norwegian.length <= 1) {
                this._pickerEl.hidden = true;
                this._warningEl.hidden = true;
                return;
            }

            this._selectEl.innerHTML = '';
            const current = tts.currentVoice;
            for (const voice of norwegian) {
                const opt = document.createElement('option');
                opt.value = voice.name;
                opt.textContent = `${voice.name} (${voice.lang})`;
                if (current && voice.name === current.name) opt.selected = true;
                this._selectEl.appendChild(opt);
            }
            this._warningEl.hidden = true;
            this._pickerEl.hidden = false;
        }

        _syncSelected() {
            const tts = window.AgoraTTS;
            if (!tts?.currentVoice) return;
            this._selectEl.value = tts.currentVoice.name;
        }

        _showWarning(msg) {
            this._pickerEl.hidden = true;
            this._warningEl.textContent = msg;
            this._warningEl.hidden = false;
        }
    }

    customElements.define('agora-voice-picker', AgoraVoicePicker);
})();
