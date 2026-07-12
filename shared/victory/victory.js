/* Agora — <agora-victory> custom element.
 *
 * The end-of-game overlay that celebrates the player and offers a
 * "spill igjen" (retry) button plus a link to the next game.
 *
 * Usage:
 *
 *   <agora-victory
 *       id="victory"
 *       hidden
 *       next-href="../level-2/index.html">
 *   </agora-victory>
 *
 *   const victory = document.getElementById('victory');
 *   victory.show();                           // reveal + focus retry
 *   victory.hide();                           // same as victory.hidden = true
 *   victory.addEventListener('agora-retry', restartGame);
 *
 * Attributes (all optional except `next-href`):
 *   next-href   — URL the "next game" button links to
 *   next-label  — button text (default: "NESTE SPILL")
 *   next-icon   — emoji shown before the label (default: "➡️")
 *   heading     — big headline text (default: "DU KLARTE DET!")
 *   message     — supporting text (default: "Pandaen kom seg trygt over brua! 🐼🌳")
 *
 * The retry button dispatches an `agora-retry` event and the component
 * automatically hides itself before the event fires — games only need to
 * reset their own state in the listener.
 */
(function () {
    const CSS_URL = new URL('./victory.css', document.currentScript.src).href;

    const DEFAULT_HEADING  = 'DU KLARTE DET!';
    const DEFAULT_MESSAGE  = 'Pandaen kom seg trygt over brua! 🐼🌳';
    const DEFAULT_NEXT_LBL = 'NESTE SPILL';
    const DEFAULT_NEXT_ICO = '➡️';

    class AgoraVictory extends HTMLElement {
        static get observedAttributes() {
            return ['hidden', 'heading', 'message',
                    'next-href', 'next-label', 'next-icon'];
        }

        constructor() {
            super();
            this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
            if (this._rendered) return;
            this._rendered = true;

            if (!this.hasAttribute('role'))       this.setAttribute('role', 'dialog');
            if (!this.hasAttribute('aria-modal')) this.setAttribute('aria-modal', 'true');
            if (!this.hasAttribute('aria-label')) {
                this.setAttribute('aria-label',
                    this.getAttribute('heading') || DEFAULT_HEADING);
            }

            this.shadowRoot.innerHTML = `
                <link rel="stylesheet" href="${CSS_URL}">
                <div class="card">
                    <div class="star" aria-hidden="true">⭐</div>
                    <h2 class="heading"></h2>
                    <p class="message"></p>
                    <div class="buttons">
                        <button type="button" class="btn btn--retry">
                            <span aria-hidden="true">🔄</span>
                            SPILL IGJEN
                        </button>
                        <a class="btn btn--next">
                            <span class="btn__icon" aria-hidden="true"></span>
                            <span class="btn__label"></span>
                        </a>
                    </div>
                </div>
            `;

            this._heading  = this.shadowRoot.querySelector('.heading');
            this._message  = this.shadowRoot.querySelector('.message');
            this._retryBtn = this.shadowRoot.querySelector('.btn--retry');
            this._nextLink = this.shadowRoot.querySelector('.btn--next');
            this._nextIcon = this._nextLink.querySelector('.btn__icon');
            this._nextLbl  = this._nextLink.querySelector('.btn__label');

            this._retryBtn.addEventListener('click', () => {
                this.hide();
                this.dispatchEvent(new CustomEvent('agora-retry'));
            });

            this._syncContent();

            // If we were mounted already visible, move focus onto retry so
            // keyboards / screen readers can act immediately.
            if (!this.hidden) this._focusRetry();
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (!this._rendered) return;
            if (name === 'hidden') {
                if (newValue === null && oldValue !== null) this._focusRetry();
            } else {
                this._syncContent();
            }
        }

        show() { this.hidden = false; }
        hide() { this.hidden = true;  }

        _syncContent() {
            this._heading.textContent = this.getAttribute('heading') || DEFAULT_HEADING;
            this._message.textContent = this.getAttribute('message') || DEFAULT_MESSAGE;
            this._nextLbl.textContent = this.getAttribute('next-label') || DEFAULT_NEXT_LBL;
            this._nextIcon.textContent = this.getAttribute('next-icon') || DEFAULT_NEXT_ICO;
            const href = this.getAttribute('next-href') || '#';
            this._nextLink.setAttribute('href', href);
        }

        _focusRetry() {
            // Wait a tick so the browser has finished the show transition.
            requestAnimationFrame(() => this._retryBtn?.focus());
        }
    }

    customElements.define('agora-victory', AgoraVictory);
})();
