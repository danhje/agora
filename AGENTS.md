# Agents guide

Notes for AI coding agents working on Agora, a static site of learning games for kids.

## Structure

- `index.html` — landing page with category groves and game cards
- `styles.css` — forest theme, layout, and card styling
- `games/<category>/` — per-game HTML, CSS, and JS (e.g. `games/reading/level-1.*`)
- `assets/` — images/icons (create if needed)

No build step. The site is plain HTML/CSS/JS opened directly in a browser.

## Adding a new game

Inside the relevant `<section class="category ...">` in `index.html`, add another `<li>` to the `.game-list`:

```html
<li>
    <a href="games/reading/level-2.html" class="game-card">
        <span class="game-card__label">Level</span>
        <span class="game-card__number">2</span>
    </a>
</li>
```

Then create the matching files under `games/<category>/`.

## Adding a new category

Copy any `<section class="category category--xxx">` block in `index.html` and:

1. Change the modifier class (e.g. `category--science`).
2. Update the icon, title, and game list.
3. Optionally add color rules for `.category--science .category__icon` and `.category--science .game-card` in `styles.css`.
