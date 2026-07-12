# Agents guide

Notes for AI coding agents working on Agora, a static site of learning games for kids.

## Structure

- `index.html` — landing page with category groves and game cards
- `styles.css` — forest theme, layout, and card styling
- `games/<category>/<game>/` — one folder per game containing `index.html`, `style.css`, and `script.js` (e.g. `games/reading/level-1/`)
- `assets/` — images/icons (create if needed)

No build step. The site is plain HTML/CSS/JS opened directly in a browser.

## Adding a new game

Inside the relevant `<section class="category ...">` in `index.html`, add another `<li>` to the `.game-list`:

```html
<li>
    <a href="games/reading/level-2/index.html" class="game-card">
        <span class="game-card__label">Level</span>
        <span class="game-card__number">2</span>
    </a>
</li>
```

Then create a matching folder `games/<category>/<game>/` containing `index.html`, `style.css`, and `script.js`. Inside `index.html`, link to the shared theme with `../../../styles.css`, and use `../../../index.html` for the back button.

## End-screen links between games

Each game's victory screen has a "next" button (`.victory__btn--next` / `#next-btn`).
Keep these in sync when adding, removing, or reordering games:

- The last game in a category should link back to the main menu (`../../../index.html`)
  with a label like `TIL HOVEDMENY` and a 🏡 icon.
- Every earlier game should link to the next game in the same category
  (e.g. `level-1/index.html` → `../level-2/index.html`) with `NESTE SPILL` and a ➡️ icon.

When you add a new final game, remember to update the previously-final game so
its end-screen points at the new one instead of the menu. When you remove a
game, update the game that pointed at it. Also make sure the main menu
(`index.html`) reflects the change.

## Adding a new category

Copy any `<section class="category category--xxx">` block in `index.html` and:

1. Change the modifier class (e.g. `category--science`).
2. Update the icon, title, and game list.
3. Optionally add color rules for `.category--science .category__icon` and `.category--science .game-card` in `styles.css`.
