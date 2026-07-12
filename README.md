# Agora

A playful, forest-themed static site with learning games for kids, organized by category.

## Structure

- `index.html` — landing page with category groves and game cards
- `styles.css` — forest theme, layout, and card styling
- `assets/` — (add images/icons here as needed)

## Adding a new game

Inside the relevant `<section class="category ...">` in `index.html`, add another `<li>` to the `.game-list`:

```html
<li>
    <a href="games/reading-level-2.html" class="game-card">
        <span class="game-card__label">Level</span>
        <span class="game-card__number">2</span>
    </a>
</li>
```

## Adding a new category

Copy any `<section class="category category--xxx">` block in `index.html` and:

1. Change the modifier class (e.g. `category--science`).
2. Update the icon, title, and game list.
3. Optionally add a color rule for `.category--science .category__icon` and `.category--science .game-card` in `styles.css`.

## Local preview

Just open `index.html` in a browser — no build step.

## Deploy (GitHub Pages)

1. Push to `main`.
2. In the repo settings → Pages, set source to `main` / root.
3. Site will be live at `https://<user>.github.io/agora/`.
