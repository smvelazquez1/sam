# Wireframe F265 copy 2 — GitHub copy

A plain HTML/CSS/JS copy of the Cargo site. No build step.

- `index.html` — the entry page: the Dream Book loop with a small "enter here" beneath it, linking to `home.html`
- `images/dream/` — the 23 frames of the Dream Book loop (edit the timing in the script inside `index.html`)
- `home.html` — the main site: the seven object pages, the edge words (Lorem / About / Contact) and the carousel mount
- `style.css` — the Global CSS (v17) plus the small base Cargo used to supply
- `app.js` — the Global JS (v24): click-to-slide, the thumbnail carousel with its dot, and the yellow brushstroke
- `images/` — the five object pictures (full size) and `images/thumb-<name>.png` (500px-wide copies used by the carousel)

## To change things
- **Text and titles:** edit the `<h1>` and `<p>` inside each `<section class="page …">` in `index.html`.
- **Pictures:** each page's picture is the `--bg: url('images/…')` on its `.bg-page` block. Use transparent PNG cut-outs; the brushstroke reads their outline.
  Put a small (about 500px wide) copy named `thumb-<same file name>` in `images/` for the carousel.
- **Add a page:** copy one `<section>` block, give it a new `id` and `page-url` (the same word), a new picture and text.
- **Brush look:** the `CFG` block at the top of the brush script inside `app.js` (colour, thickness, texture, `intro`).
- **Font:** Cargo's Diatype Variable is licensed to Cargo, so this copy uses Hanken Grotesk (free, Google Fonts).

Notes carried over from Cargo: the placeholder text is still the template's; `object7` still says "Object No.6"; `object4`/`object5` pictures are placeholders.
