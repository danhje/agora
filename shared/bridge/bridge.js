/* Agora — <agora-bridge> custom element.
 *
 * A cute panda on a hanging rope bridge, used as a progress indicator
 * in every game. Encapsulated in Shadow DOM so games' own stylesheets
 * can't accidentally style its internals.
 *
 * Usage:
 *
 *   <agora-bridge id="bridge"></agora-bridge>
 *
 *   const bridge = document.getElementById('bridge');
 *   bridge.progress = 0.4;   // 0..1, position of the panda
 *   bridge.walk();           // replay the waddle animation
 *   bridge.reset();          // shorthand for progress = 0
 */
(function () {
    // Resolve bridge.css relative to this script so the component can be
    // included from any depth without hard-coding the path.
    const CSS_URL = new URL('./bridge.css', document.currentScript.src).href;

    const SCENE_SVG = `
        <svg class="scene" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
            <!-- Grass mounds (left / right) -->
            <path d="M 0 50 L 0 34 Q 4 20 15 22 L 15 50 Z" fill="#8ac947"/>
            <path d="M 100 50 L 100 34 Q 96 20 85 22 L 85 50 Z" fill="#8ac947"/>
            <!-- Grass mound highlights -->
            <path d="M 0 50 L 0 40 Q 3 32 10 32 L 10 50 Z" fill="#a2d95c" opacity="0.55"/>
            <path d="M 100 50 L 100 40 Q 97 32 90 32 L 90 50 Z" fill="#a2d95c" opacity="0.55"/>
            <!-- Grass tufts -->
            <path d="M 3 30 l 0.5 -3 l 0.5 3 z M 6 27 l 0.5 -3.5 l 0.5 3.5 z M 10 24 l 0.5 -3 l 0.5 3 z"
                fill="#4f9128"/>
            <path d="M 89 24 l 0.5 -3 l 0.5 3 z M 93 27 l 0.5 -3.5 l 0.5 3.5 z M 96.5 30 l 0.5 -3 l 0.5 3 z"
                fill="#4f9128"/>
            <!-- Handrail rope -->
            <path d="M 15 18 Q 50 45 85 18"
                fill="none" stroke="#5a3d20" stroke-width="1.5"
                vector-effect="non-scaling-stroke" stroke-linecap="round"/>
            <!-- Vertical rope ties -->
            <g stroke="#5a3d20" stroke-width="1"
                vector-effect="non-scaling-stroke" stroke-linecap="round">
                <line x1="26.67" y1="25.5" x2="26.67" y2="29.5"/>
                <line x1="38.33" y1="30"   x2="38.33" y2="34"/>
                <line x1="50"    y1="31.5" x2="50"    y2="35.5"/>
                <line x1="61.67" y1="30"   x2="61.67" y2="34"/>
                <line x1="73.33" y1="25.5" x2="73.33" y2="29.5"/>
            </g>
            <!-- Bridge deck (thick plank) -->
            <path d="M 15 25 Q 50 52 85 25"
                fill="none" stroke="#a87752" stroke-width="6"
                vector-effect="non-scaling-stroke" stroke-linecap="round"/>
            <!-- Deck top highlight -->
            <path d="M 15 23.5 Q 50 50.5 85 23.5"
                fill="none" stroke="#c69168" stroke-width="1.2"
                vector-effect="non-scaling-stroke" stroke-linecap="round" opacity="0.8"/>
        </svg>
    `;

    const PANDA_SVG = `
        <svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg">
            <!-- Body -->
            <ellipse cx="50" cy="100" rx="28" ry="24" fill="#fff" stroke="#2a2a2a" stroke-width="2"/>
            <!-- Arms -->
            <ellipse cx="22" cy="95" rx="8" ry="13" fill="#2a2a2a"/>
            <ellipse cx="78" cy="95" rx="8" ry="13" fill="#2a2a2a"/>
            <!-- Legs -->
            <ellipse cx="38" cy="124" rx="9" ry="10" fill="#2a2a2a"/>
            <ellipse cx="62" cy="124" rx="9" ry="10" fill="#2a2a2a"/>
            <!-- Ears -->
            <circle cx="25" cy="24" r="10" fill="#2a2a2a"/>
            <circle cx="75" cy="24" r="10" fill="#2a2a2a"/>
            <!-- Head -->
            <circle cx="50" cy="46" r="28" fill="#fff" stroke="#2a2a2a" stroke-width="2"/>
            <!-- Eye patches -->
            <ellipse cx="38" cy="46" rx="6.5" ry="9" fill="#2a2a2a" transform="rotate(-12 38 46)"/>
            <ellipse cx="62" cy="46" rx="6.5" ry="9" fill="#2a2a2a" transform="rotate(12 62 46)"/>
            <!-- Eyes -->
            <circle cx="38" cy="47" r="2.2" fill="#fff"/>
            <circle cx="62" cy="47" r="2.2" fill="#fff"/>
            <!-- Nose -->
            <ellipse cx="50" cy="55" rx="3" ry="2.2" fill="#2a2a2a"/>
            <!-- Mouth -->
            <path d="M 50 58 Q 46 62 43 60" fill="none" stroke="#2a2a2a" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M 50 58 Q 54 62 57 60" fill="none" stroke="#2a2a2a" stroke-width="1.8" stroke-linecap="round"/>
            <!-- Cheeks -->
            <circle cx="30" cy="56" r="3.5" fill="#f5b5c8" opacity="0.75"/>
            <circle cx="70" cy="56" r="3.5" fill="#f5b5c8" opacity="0.75"/>
            <!-- Pink bow on head -->
            <g transform="translate(50 14)">
                <path d="M 0 0 L -9 -6 L -9 6 Z" fill="#e83e8c"/>
                <path d="M 0 0 L 9 -6 L 9 6 Z" fill="#e83e8c"/>
                <circle cx="0" cy="0" r="2.8" fill="#c22672"/>
            </g>
        </svg>
    `;

    class AgoraBridge extends HTMLElement {
        static get observedAttributes() { return ['progress']; }

        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
            if (this._rendered) return;
            this._rendered = true;

            // Decorative — the panda's position mirrors the game score which
            // already has its own aria-live region, so hide from AT.
            this.setAttribute('aria-hidden', 'true');

            this.shadowRoot.innerHTML = `
                <link rel="stylesheet" href="${CSS_URL}">
                <div class="wrap">
                    ${SCENE_SVG}
                    <div class="goal" aria-hidden="true">🌳</div>
                    <div class="panda">${PANDA_SVG}</div>
                </div>
            `;

            this._wrap  = this.shadowRoot.querySelector('.wrap');
            this._panda = this.shadowRoot.querySelector('.panda');
            this._syncProgress();
        }

        attributeChangedCallback(name) {
            if (name === 'progress') this._syncProgress();
        }

        get progress() {
            return Number(this.getAttribute('progress')) || 0;
        }
        set progress(value) {
            const n = Math.max(0, Math.min(1, Number(value) || 0));
            this.setAttribute('progress', String(n));
        }

        reset() { this.progress = 0; }

        walk() {
            if (!this._panda) return;
            this._panda.classList.remove('is-walking');
            // Force reflow so the animation restarts cleanly.
            void this._panda.offsetWidth;
            this._panda.classList.add('is-walking');
        }

        _syncProgress() {
            if (!this._wrap) return;
            this._wrap.style.setProperty('--progress', this.progress);
        }
    }

    customElements.define('agora-bridge', AgoraBridge);
})();
