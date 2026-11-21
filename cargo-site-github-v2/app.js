/* App scripts for the GitHub copy: live-site gate, click-to-slide, marquee, page carousel, brushstroke.
   (Same code as Global JS v24 on Cargo, with the carousel pointed at images/thumbs/.) */
/* LIVE-SITE GATE (keep this FIRST in your Global JS).
   Marks the page as "live" so the horizontal slider layout (Global CSS) and the click-to-slide script only run on the
   published site. In the Cargo editor / preview (shown in a frame, or on cargo.site itself) nothing is marked, so
   your pages stay in their normal vertical layout there and you can edit them without sliding sideways. */
(function () {
  var h = location.hostname, p = location.pathname, s = location.search;
  var editor = window.self !== window.top || h === 'cargo.site' || h === 'www.cargo.site' ||
               /site\.preview|\/edit(\/|$)/.test(p) || /[?&]edit\b/.test(s);
  if (!editor) document.documentElement.classList.add('slider-live');
})();

  document.addEventListener("click", (e) => {
    if (!document.documentElement.classList.contains("slider-live")) return;   // live site only
    const link = e.target.closest("a[href], media-item[href], [href]");
    if (!link) return;

    // the page stack = the row holding the MOST pages (other rows of two or three loose pages must not win)
    let slider = null, most = 0;
    document.querySelectorAll("div:has(> .stacked-page:not(.pinned) + .stacked-page:not(.pinned))").forEach((w) => {
      const n = w.querySelectorAll(":scope > .stacked-page:not(.pinned)").length;
      if (n > most) { most = n; slider = w; }
    });
    if (!slider) return;

    const slides = [...slider.querySelectorAll(":scope > .stacked-page:not(.pinned)")];
    const href = (link.getAttribute("href") || "").trim();
    const rel = (link.getAttribute("rel") || "").trim();

    let targetIndex = -1;

    if (rel === "top" || href === "#") {
      targetIndex = 0;
    } else {
      const slug = href.replace(/^[#/]+|\/+$/g, "");
      if (!slug) return;
      targetIndex = slides.findIndex(
        (s) => s.getAttribute("page-url") === slug || s.id === slug
      );
    }

    if (targetIndex !== -1) {
      e.preventDefault();
      e.stopImmediatePropagation();

      // Temporarily pause scroll-snap so it doesn't get stuck on a middle slide
      slider.style.scrollSnapType = "none";
      slider.scrollTo({
        left: targetIndex * slider.clientWidth,
        behavior: "smooth",
      });

      // Re-enable scroll-snap after the glide finishes
      clearTimeout(slider._snapTimer);
      slider._snapTimer = setTimeout(() => {
        slider.style.scrollSnapType = "x mandatory";
      }, 650);
    }
  }, true);

document.addEventListener("click", function (e) {
  const btn = e.target.closest(".arrow-btn");
  if (!btn) return;

  const wrapper = btn.closest(".slider-wrapper");
  const marquee = wrapper?.querySelector(".custom-marquee");
  const track = wrapper?.querySelector(".custom-marquee__track");
  if (!marquee || !track) return;

  // 1. Freeze the CSS auto-scroll on first click and hand control to manual scrolling
  if (!marquee.dataset.manual) {
    const matrix = new DOMMatrix(getComputedStyle(track).transform);
    const currentOffset = Math.abs(matrix.m41);

    track.style.animation = "none";
    track.style.transform = "none";
    marquee.style.overflowX = "auto";
    marquee.style.scrollbarWidth = "none"; // Hides scrollbar in Firefox
    marquee.scrollLeft = currentOffset;
    marquee.dataset.manual = "true";
  }

  // 2. Step left or right smoothly
  const step = marquee.clientWidth * 0.65;
  const direction = btn.classList.contains("next") ? 1 : -1;

  marquee.scrollBy({
    left: direction * step,
    behavior: "smooth"
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   PAGE CAROUSEL v7  (Global JS — paste it below your two existing scripts)

   Reads the horizontal stack of pages (the same stack your slider script scrolls), takes the main
   picture of every page, and builds a thumbnail carousel with arrows. Clicking a thumbnail glides
   sideways to the page it came from (your existing click-to-slide script does the gliding; this one
   has the same glide built in as a back-up).

   It only runs on the live site, never inside the Cargo editor.

   WHERE IT APPEARS: put this on the page that holds the carousel (e.g. "Thumb Nav"), in an HTML block,
   in place of the old slider markup:

       <b>Selected Work</b><br><br>
       <div class="page-carousel"></div>

   Nothing else to build: no thumbnails, no links, no local CSS.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── SETTINGS ── */
  var MOUNT            = '.page-carousel';   // the empty block the carousel is built into
  var MAIN_IMAGE_INDEX = 0;                  // which picture counts as a page's "main" one: 0 = the first
  var MAIN_IMAGE_BY_PAGE = {                 // optional per page, by its address: { 'example-project-2': 1 }
  };
  var THUMB_WIDTH      = 500;                // px of picture requested from Cargo for each thumbnail
  var REVERSE_THUMBS   = false;              // true = list the thumbnails in the opposite order (travel still goes to the right page)
  var STYLE = {                              // the look; can also be overridden from Local CSS (e.g. .page-carousel{--pc-h:90px})
    height: '72px', gap: '1.25rem', shift: '16px', idle: '0.6', active: 'rgba(0,0,0,.85)'   // active = the border around the page that is showing
  };

  /* ── NEVER IN THE EDITOR ── */
  function isEditor() {
    if (document.body.classList.contains('cargo-edit-mode')) return true;
    if (document.body.dataset.cargoMode) return true;
    if (document.querySelector('#cargo-editor, #cargo-admin, [cargo-editor], cargo-editor')) return true;
    if (window.self !== window.top) return true;
    if (location.hostname === 'cargo.site' || location.hostname === 'www.cargo.site' || /site\.preview/.test(location.pathname)) return true;
    var url = window.location.href;
    return url.indexOf('/edit') > -1 || url.indexOf('?edit') > -1 || url.indexOf('cargo.site/edit') > -1;
  }
  if (isEditor()) return;

  /* ── THE STACK ── */
  var SLIDER_SEL = 'div:has(> .stacked-page:not(.pinned) + .stacked-page:not(.pinned))';
  function getSlider() {                                                   // the row holding the MOST pages is the stack
    var best = null, most = 0;
    try {
      Array.prototype.forEach.call(document.querySelectorAll(SLIDER_SEL), function (w) {
        var n = w.querySelectorAll(':scope > .stacked-page:not(.pinned)').length;
        if (n > most) { most = n; best = w; }
      });
      Array.prototype.forEach.call(document.querySelectorAll(SLIDER_SEL), function (w) { w.classList.toggle('pc-main-row', w === best); });   // tag the main row so CSS can show ONE sideways bar
    } catch (e) {}
    return best;
  }
  function getSlides(slider) { return slider ? Array.prototype.slice.call(slider.querySelectorAll(':scope > .stacked-page:not(.pinned)')) : []; }
  function slugOf(slide) { return slide.getAttribute('page-url') || slide.id || ''; }
  function titleOf(slide) {
    var h = slide.querySelector('bodycopy h1, bodycopy h2, .page-content h1, .page-content h2');
    var t = h && h.textContent.trim();
    return t || slugOf(slide).replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  /* ── FINDING A PAGE'S MAIN PICTURE ── */
  function freightUrl(hash, name, w) { return 'https://freight.cargo.site/w/' + w + '/q/75/i/' + hash + '/' + encodeURIComponent(name); }
  function resize(src) {                                                     // ask Cargo for a thumbnail-sized copy, not the full original
    if (/^images\/(?!thumbs\/)/.test(src)) return src.replace(/^images\//, 'images/thumbs/');   // GitHub copy: small thumbnails live in images/thumbs/
    if (/freight\.cargo\.site\/w\/\d+\//.test(src)) return src.replace(/\/w\/\d+\//, '/w/' + THUMB_WIDTH + '/');
    if (/freight\.cargo\.site\/t\/original\/i\//.test(src)) return src.replace(/\/t\/original\/i\//, '/w/' + THUMB_WIDTH + '/q/75/i/');
    return src;
  }
  // a page built with the background-image layout (.bg-page): its picture is the --bg value in the block's style
  function urlFromCss(v) { var m = /url\(\s*(['"]?)(.*?)\1\s*\)/.exec(v || ''); return m ? m[2] : ''; }
  function bgOf(el) { return urlFromCss((el.style && el.style.getPropertyValue('--bg')) || getComputedStyle(el).getPropertyValue('--bg') || el.getAttribute('style')); }
  function pickIndex(slide) { var i = MAIN_IMAGE_BY_PAGE[slugOf(slide)]; return typeof i === 'number' ? i : MAIN_IMAGE_INDEX; }

  // from what is on screen right now. Returns {src,w,h}, {placeholder:true}, or null (nothing / not filled in yet)
  function fromLive(slide) {
    var bgEl = slide.querySelector('.bg-page'), bgUrl = bgEl && bgOf(bgEl);
    if (bgUrl) return { src: resize(bgUrl), w: 0, h: 0 };                     // the page's background picture counts as its main picture
    var hosts = Array.prototype.filter.call(slide.querySelectorAll('media-item, img'), function (h) { return !h.closest(MOUNT); });
    if (!hosts.length) return null;
    var host = hosts[pickIndex(slide)] || hosts[0];
    if (host.tagName === 'IMG') {
      var s0 = host.currentSrc || host.src;
      return s0 && !/^data:/.test(s0) ? { src: resize(s0), w: host.naturalWidth, h: host.naturalHeight } : null;
    }
    var hash = host.getAttribute('hash');
    if (hash === 'placeholder') return { placeholder: true };
    var w = +host.getAttribute('width') || 0, h = +host.getAttribute('height') || 0;
    var im = host.shadowRoot && host.shadowRoot.querySelector('img');
    var s = im && (im.currentSrc || im.getAttribute('src'));
    if (s && !/^data:/.test(s)) return { src: resize(s), w: w || im.naturalWidth, h: h || im.naturalHeight };
    var m = host._model;
    if (m && m.hash && m.name) return { src: freightUrl(m.hash, m.name, THUMB_WIDTH), w: m.width || w, h: m.height || h };
    return null;
  }

  // Cargo only fills in a page when it is about to be seen, so for a page it has not filled yet, read the same
  // information from the page's own address: its picture's hash is in the markup, its file name in the embedded data.
  var fetchCache = {};
  function fromFetch(slide) {
    var slug = slugOf(slide);
    if (!fetchCache[slug]) {
      fetchCache[slug] = fetch('/' + encodeURIComponent(slug), { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .catch(function () { return ''; });
    }
    return fetchCache[slug].then(function (text) {
      if (!text) return null;
      var doc = new DOMParser().parseFromString(text, 'text/html');
      var page = null;
      Array.prototype.forEach.call(doc.querySelectorAll('[page-url]'), function (p) { if (p.getAttribute('page-url') === slug) page = p; });
      var bgEl = page && page.querySelector('.bg-page'), bgUrl = bgEl ? urlFromCss(bgEl.getAttribute('style')) : '';
      if (bgUrl) return { src: resize(bgUrl), w: 0, h: 0 };
      var items = page ? page.querySelectorAll('media-item') : [];
      if (!items.length) return null;
      var item = items[pickIndex(slide)] || items[0];
      var hash = item.getAttribute('hash');
      if (!hash) return null;
      if (hash === 'placeholder') return { placeholder: true };
      var plain = text.replace(/\\"/g, '"'), name = null;
      var m = new RegExp('"name":"([^"]+)","hash":"' + hash + '"').exec(plain);
      if (m) { try { name = JSON.parse('"' + m[1] + '"'); } catch (e) { name = m[1]; } }
      return name ? { src: freightUrl(hash, name, THUMB_WIDTH), w: +item.getAttribute('width') || 0, h: +item.getAttribute('height') || 0 } : null;
    });
  }

  // keep looking for a few seconds; ask the page's own address if it still has not filled in; then give up gracefully
  function resolve(slide, done) {
    var finished = false, tries = 0, asked = false;
    function finish(r) { if (!finished) { finished = true; done(r); } }
    (function tick() {
      if (finished) return;
      var r = fromLive(slide);
      if (r) return finish(r);
      tries++;
      if (tries === 4 && !asked) { asked = true; fromFetch(slide).then(function (f) { if (f) finish(f); }); }
      if (tries < 25) setTimeout(tick, 400); else finish({ none: true });
    })();
  }

  /* ── LOOK ── */
  function injectStyle() {
    if (document.getElementById('pc-style')) return;
    var st = document.createElement('style'); st.id = 'pc-style';
    st.textContent =
      MOUNT + '{--pc-h:' + STYLE.height + ';--pc-gap:' + STYLE.gap + ';--pc-shift:' + STYLE.shift + ';--pc-idle:' + STYLE.idle + ';--pc-active:' + STYLE.active + ';width:100%;position:relative;top:var(--pc-shift)}' +
      '.pc-wrap{display:flex;align-items:center;gap:12px;width:100%}' +
      '.pc-viewport{flex:1;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}' +
      '.pc-viewport::-webkit-scrollbar{display:none}' +
      '.pc-track{display:flex;align-items:center;gap:var(--pc-gap);width:max-content;position:relative;padding:7px 7px 20px}' +
      '.pc-thumb{flex:none;display:block;height:var(--pc-h);opacity:var(--pc-idle);transition:opacity .25s ease;cursor:pointer;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}' +
      '.pc-thumb:hover,.pc-thumb:focus-visible,.pc-thumb.pc-active{opacity:1}' +
      '.pc-thumb{outline:none;transition:opacity .25s ease}' +
      '.pc-thumb:focus-visible{outline:1px solid currentColor;outline-offset:4px}' +
      '.pc-thumb:active{opacity:.7}' +
      '.pc-dot{position:absolute;left:0;bottom:7px;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:var(--pc-active,rgba(0,0,0,.85));pointer-events:none;will-change:transform}' +
      '.pc-prev,.pc-next{margin-bottom:13px}' +
      '.pc-thumb img{display:block;height:100%;width:auto;opacity:0;transition:opacity .4s ease}' +
      '.pc-thumb img.pc-in{opacity:1}' +
      '.pc-ph{position:relative;display:block;height:100%;aspect-ratio:1/1;box-sizing:border-box;border:1px solid rgba(0,0,0,.25)}' +
      '.pc-ph svg{position:absolute;inset:0;width:100%;height:100%}' +
      '.pc-thumb.pc-has-img .pc-ph{display:none}' +
      '.pc-arrow{flex:none;width:26px;height:26px;border:0;border-radius:0;background:none;box-shadow:none;color:#111;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:transform .2s ease,opacity .2s ease;-webkit-tap-highlight-color:transparent}' +
      '.pc-arrow svg{display:block;width:11px;height:11px}' +
      '.pc-prev:hover{transform:translateX(-3px)}' +
      '.pc-next:hover{transform:translateX(3px)}' +
      '.pc-arrow:active{opacity:.55}' +
      '.pc-arrow:focus-visible{outline:1px solid currentColor;outline-offset:2px}' +
      '.pc-arrow[aria-disabled="true"]{opacity:.2;pointer-events:none}';
    document.head.appendChild(st);
  }
  // arrows: two solid triangles, nothing else
  var CHEV_L = '<svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="14,1 14,15 2,8" fill="currentColor"/></svg>';
  var CHEV_R = '<svg viewBox="0 0 16 16" aria-hidden="true"><polygon points="2,1 2,15 14,8" fill="currentColor"/></svg>';
  var PH_SVG = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0L100 100" stroke="rgba(0,0,0,.25)" stroke-width="1" vector-effect="non-scaling-stroke" fill="none"/></svg>';

  /* ── TRAVELLING TO A PAGE (same glide as the existing slider script) ── */
  function travel(slider, index) {
    slider.style.scrollSnapType = 'none';
    slider.scrollTo({ left: index * slider.clientWidth, behavior: 'smooth' });
    clearTimeout(slider._snapTimer);
    slider._snapTimer = setTimeout(function () { slider.style.scrollSnapType = 'x mandatory'; }, 650);
  }

  /* ── BUILDING IT ── */
  function build(mount, slider, slides) {
    if (mount.getAttribute('data-pc-built')) return;
    mount.setAttribute('data-pc-built', '1');
    injectStyle();

    var wrap = document.createElement('div'); wrap.className = 'pc-wrap';
    var prev = document.createElement('button'); prev.type = 'button'; prev.className = 'pc-arrow pc-prev'; prev.setAttribute('aria-label', 'Previous page'); prev.innerHTML = CHEV_L;
    var next = document.createElement('button'); next.type = 'button'; next.className = 'pc-arrow pc-next'; next.setAttribute('aria-label', 'Next page'); next.innerHTML = CHEV_R;
    var view = document.createElement('div'); view.className = 'pc-viewport';
    var track = document.createElement('div'); track.className = 'pc-track';
    view.appendChild(track); wrap.appendChild(prev); wrap.appendChild(view); wrap.appendChild(next);
    mount.textContent = ''; mount.appendChild(wrap);

    var order = slides.slice(); if (REVERSE_THUMBS) order.reverse();
    var thumbs = {};
    order.forEach(function (slide) {
      var slug = slugOf(slide); if (!slug) return;
      var a = document.createElement('a');
      a.className = 'pc-thumb'; a.href = '#' + slug; a.setAttribute('aria-label', titleOf(slide)); a.setAttribute('data-slug', slug);
      a.innerHTML = '<span class="pc-ph">' + PH_SVG + '</span>';
      track.appendChild(a); thumbs[slug] = a;
      resolve(slide, function (r) {
        if (!r || !r.src) { updateArrows(); return; }                       // a placeholder / no picture: the frame stays
        var im = new Image(); im.alt = '';
        if (r.w && r.h) { im.width = r.w; im.height = r.h; }
        im.onload = function () { a.classList.add('pc-has-img'); im.classList.add('pc-in'); updateArrows(); };
        im.onerror = function () { updateArrows(); };
        im.src = r.src; a.appendChild(im);
      });
    });

    var dot = document.createElement('i'); dot.className = 'pc-dot'; track.appendChild(dot);          // the dot that glides under the page that is showing

    // a click on a thumbnail: the existing slider script normally handles it first; if it did not, glide here
    track.addEventListener('click', function (e) {
      var a = e.target.closest('.pc-thumb'); if (!a) return;
      e.preventDefault();
      var i = slides.findIndex(function (s) { return slugOf(s) === a.getAttribute('data-slug'); });
      if (i > -1) travel(slider, i);
    });

    // arrows: previous / next page of the stack (the strip follows the page that is showing)
    var goal = -1, goalTimer = null;
    function currentIndex() { var w = slider.clientWidth || 1; return Math.max(0, Math.min(slides.length - 1, Math.round(slider.scrollLeft / w))); }
    function updateArrows() {
      var i = goal > -1 ? goal : currentIndex();
      prev.setAttribute('aria-disabled', i <= 0 ? 'true' : 'false');
      next.setAttribute('aria-disabled', i >= slides.length - 1 ? 'true' : 'false');
      follow();
    }
    function step(dir) {
      var i = Math.max(0, Math.min(slides.length - 1, (goal > -1 ? goal : currentIndex()) + dir));
      goal = i; updateArrows(); travel(slider, i);
      clearTimeout(goalTimer); goalTimer = setTimeout(function () { goal = -1; updateArrows(); }, 800);
    }
    prev.addEventListener('click', function () { step(-1); });
    next.addEventListener('click', function () { step(1); });
    window.addEventListener('resize', updateArrows);   // (the dot is repositioned there too)
    updateArrows();

    // mark the thumbnail of the page that is showing, and bring it into view
    var lastIdx = -1;
    function follow() {                                                      // the dot (and the strip, if it is wider than the screen) travel with the page, smoothly, as you scroll
      var w = slider.clientWidth || 1, f = Math.max(0, Math.min(slides.length - 1, slider.scrollLeft / w)), i0 = Math.floor(f), i1 = Math.min(slides.length - 1, i0 + 1), t = f - i0;
      var a = thumbs[slugOf(slides[i0])], b = thumbs[slugOf(slides[i1])]; if (!a || !b) return;
      var tr = track.getBoundingClientRect();
      var cA = a.getBoundingClientRect().left - tr.left + a.offsetWidth / 2, cB = b.getBoundingClientRect().left - tr.left + b.offsetWidth / 2, c = cA + (cB - cA) * t;
      dot.style.transform = 'translateX(' + c.toFixed(1) + 'px)';
      if (view.scrollWidth > view.clientWidth + 1) { var want = c - view.clientWidth / 2; if (Math.abs(view.scrollLeft - want) > 1) view.scrollLeft = want; }
    }
    function syncActive() {
      var w = slider.clientWidth || 1, i = Math.max(0, Math.min(slides.length - 1, Math.round(slider.scrollLeft / w)));
      updateArrows();                                                        // (this also moves the dot)
      if (i === lastIdx) return; lastIdx = i;
      var slug = slugOf(slides[i]);
      Object.keys(thumbs).forEach(function (k) { thumbs[k].classList.toggle('pc-active', k === slug); });
    }
    var ticking = false;
    slider.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; syncActive(); }); } }, { passive: true });
    syncActive();
  }

  /* ── START: wait until the page holding the carousel and the stack both exist ── */
  var t0 = Date.now();
  (function wait() {
    var mount = document.querySelector(MOUNT), slider = getSlider(), slides = getSlides(slider);
    if (mount && slider && slides.length) return build(mount, slider, slides);
    if (Date.now() - t0 < 20000) setTimeout(wait, 200);
  })();
})();

/* ═══════════════════════════════════════════════════════════════════
   BRUSHSTROKE (v13): a dry-brush line that is painted as the visitor travels sideways through the pages.
   It is drawn across the whole stack as ONE continuous stroke, so it leaves one page and runs on into the next.
   The stroke is tied directly to your scroll: the brush tip sits at the right-hand edge of the screen and moves exactly as
   the pages move, so it never lags behind and never lunges when you stop. Resting on a page = that page's stroke is complete.
   Scrolling back un-paints it. (On first load the first stroke draws itself in once.) Live site only (never in the Cargo editor).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  /* ── SETTINGS ── */
  var CFG = {
    enabled: true,
    // one entry per colour of paint; they are painted together, each a little differently
    passes: [
      // margin: how far from the object the line runs (0.06 = 6% of the object's size; below 0 tucks in behind its edge)
      // (where on each object the line goes is set by PLANS, just below)
      // sides: how many straight sides the outline has (8 = octagon, 6 = hexagon, 4 = box). The outline is always OUTSIDE the object, so the line never cuts into it.
      // corner: how round the corners are
      { color: '#ffd500', width: 1.00, seed: 11, shiftY: 0.00,  bristles: 10, ink: 1.0, margin: 0.09, sides: 8, corner: 0.040 }   // yellow
    ],
    dropChance: 0,       // only matters with more than one line: the chance an extra line is left out of a page
    texture: 0.5,        // 0 = smooth, even paint; 1 = very dry, streaky brush. Subtle is more believable.
    widthVw: 0.5,        // brush width as a share of the screen width…
    minWidth: 4, maxWidth: 9,   // …kept between these pixel sizes
    intro: 1.6,          // seconds the first stroke takes to draw itself when the site loads (0 = it is simply there). After that the line follows your scroll exactly.
    blend: 'normal',     // 'normal' = bright, opaque paint; 'multiply' lets the paint sit into the photos but darkens the colours
    wobble: 0.3,         // how much the hand shakes: 0 = machine-smooth, 1 = natural, 2 = shaky
    zIndex: -1           // below everything: the stroke passes BEHIND the pictures and text (needs the pages to be see-through, which they are)
  };
  /* The route of the stroke on each page, in a 0–1 box (x across, y down). Pages take these in turn. */
  var GESTURES = [      // straight runs and angled steps (used on pages with no picture)
    [[0.28, 0.62], [0.44, 0.34], [0.70, 0.34], [0.84, 0.60]],
    [[0.22, 0.58], [0.38, 0.58], [0.52, 0.30], [0.78, 0.30], [0.90, 0.50]],
    [[0.30, 0.66], [0.50, 0.66], [0.62, 0.42], [0.80, 0.42]]
  ];

  if (!CFG.enabled) return;
  var ROOT = document.documentElement;
  if (!ROOT.classList.contains('slider-live')) return;          // the Cargo editor is left alone
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SLIDER_SEL = 'div:has(> .stacked-page:not(.pinned) + .stacked-page:not(.pinned))';
  var NS = 'http://www.w3.org/2000/svg';
  var SLICES = 9;                                                // the brush front is cut into this many ragged slices

  function getRow() {
    var best = null, most = 0;
    try {
      Array.prototype.forEach.call(document.querySelectorAll(SLIDER_SEL), function (w) {
        var n = w.querySelectorAll(':scope > .stacked-page:not(.pinned)').length;
        if (n > most) { most = n; best = w; }
      });
    } catch (e) {}
    return best;
  }
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // smooth random wobble: a few sine waves with random phases
  function shake(R, waves) {
    var w = waves.map(function (c) { return { a: c[0], k: 2 * Math.PI / c[1], p: R() * 6.283 }; });
    return function (s) { var v = 0; for (var i = 0; i < w.length; i++) v += w[i].a * Math.sin(s * w[i].k + w[i].p); return v; };
  }

  var layer, svgEl, row, pages = 0, VW = 0, VH = 0, built = null;
  var head = 0, raf = 0, lead = 1, introing = false, introT0 = 0, introWait = 0;

  function finalize(pts) {
    var N = [], S = [0], MX = [pts[0][0]];
    for (var m = 0; m < pts.length; m++) {
      var a = pts[Math.max(0, m - 2)], b = pts[Math.min(pts.length - 1, m + 2)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      N.push([-dy / L, dx / L]);
      if (m) { S.push(S[m - 1] + Math.hypot(pts[m][0] - pts[m - 1][0], pts[m][1] - pts[m - 1][1])); MX.push(Math.max(MX[m - 1], pts[m][0])); }
    }
    return { pts: pts, N: N, S: S, MX: MX, len: S[S.length - 1] };
  }

  /* ── THE OBJECTS: read each page's picture once to learn its outline (a loose, rounded silhouette) ── */
  var SHAPES = {}, BINS = 96, OBJ_RETRY = {};
  function slugOf(sl) { return sl.getAttribute('page-url') || sl.id || ''; }
  function urlOf(sl) {
    var bp = sl.querySelector('.bg-page');
    if (bp) { var m = (bp.getAttribute('style') || '').match(/url\(\s*["']?([^"')]+)/); if (m) return m[1]; }
    var mi = sl.querySelector('media-item');
    if (mi) {
      var im = mi.shadowRoot && mi.shadowRoot.querySelector('img');
      if (im && (im.currentSrc || im.src)) return im.currentSrc || im.src;
      var md = mi._model; if (md && md.hash && md.name) return 'https://freight.cargo.site/t/original/i/' + md.hash + '/' + encodeURIComponent(md.name);
    }
    return null;
  }
  function analyze(img) {
    var nw = img.naturalWidth, nh = img.naturalHeight; if (!nw || !nh) return null;
    var sc = 160 / Math.max(nw, nh), w = Math.max(8, Math.round(nw * sc)), h = Math.max(8, Math.round(nh * sc));
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    var d; try { d = x.getImageData(0, 0, w, h).data; } catch (e) { return null; }      // blocked: the picture can't be read
    var sx = 0, sy = 0, cnt = 0, xx, yy;
    for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 30) { sx += xx + .5; sy += yy + .5; cnt++; }
    if (!cnt) return null;
    var cx = sx / cnt, cy = sy / cnt, r = new Array(BINS).fill(0);
    for (yy = 0; yy < h; yy++) for (xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 30) {
      var dx = xx + .5 - cx, dy = yy + .5 - cy, b = Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * BINS) % BINS, dist = Math.hypot(dx, dy);
      if (dist > r[b]) r[b] = dist;
    }
    var k, j;
    for (k = 0; k < BINS; k++) if (!r[k]) { var lo = k, hi = k, ln = 0, hn = 0; while (!r[(lo + BINS) % BINS] && ln++ < BINS) lo--; while (!r[hi % BINS] && hn++ < BINS) hi++; var a1 = r[(lo + BINS) % BINS], a2 = r[hi % BINS], tt = (k - lo) / Math.max(1, hi - lo); r[k] = a1 + (a2 - a1) * tt; }
    var sm = new Array(BINS);
    for (k = 0; k < BINS; k++) { var sum = 0; for (j = -3; j <= 3; j++) sum += r[(k + j + BINS) % BINS]; sm[k] = Math.max(sum / 7, r[k] * 0.9); }   // rounded off, never inside the object
    var u = [], v = [];
    for (k = 0; k < BINS; k++) { var ang = -Math.PI + (k + .5) / BINS * 2 * Math.PI; u.push((cx + sm[k] * Math.cos(ang)) / w); v.push((cy + sm[k] * Math.sin(ang)) / h); }
    return { u: u, v: v, cxn: cx / w, cyn: cy / h, nw: nw, nh: nh };
  }
  function resolveShapes() {
    if (!row) return;
    Array.prototype.forEach.call(row.querySelectorAll(':scope > .stacked-page:not(.pinned)'), function (sl) {
      var slug = slugOf(sl), cur = SHAPES[slug];
      if (cur === 'loading' || (cur && cur !== 'none')) return;
      if (cur === 'none' && (OBJ_RETRY[slug] || 0) >= 6) return;
      var u = urlOf(sl); if (!u) return;
      OBJ_RETRY[slug] = (OBJ_RETRY[slug] || 0) + 1; SHAPES[slug] = 'loading';
      var im = new Image(), done = false;
      function fin(res) { if (done) return; done = true; SHAPES[slug] = res || 'none'; if (res) rebuildSoon(); }
      im.crossOrigin = 'anonymous';
      im.onload = function () { var res = null; try { res = analyze(im); } catch (e) {} fin(res); };
      im.onerror = function () { fin(null); };
      setTimeout(function () { fin(null); }, 12000);
      im.src = u;
    });
  }
  /* where the picture sits on its page (the page is laid out in the viewer's window, so this is measured fresh each time) */
  function objectRect(sl, shp) {
    var sr = sl.getBoundingClientRect(), bp = sl.querySelector('.bg-page'), bx, by, bw, bh;
    if (bp) {
      var cs = getComputedStyle(bp, '::before'), br = bp.getBoundingClientRect();
      bx = br.left - sr.left + (parseFloat(cs.left) || 0); by = br.top - sr.top + (parseFloat(cs.top) || 0); bw = parseFloat(cs.width) || 0; bh = parseFloat(cs.height) || 0;
    } else {
      var mi = sl.querySelector('media-item'); if (!mi) return null;
      var mr = mi.getBoundingClientRect(); bx = mr.left - sr.left; by = mr.top - sr.top; bw = mr.width; bh = mr.height;
    }
    if (bw < 10 || bh < 10) return null;
    var sc = Math.min(bw / shp.nw, bh / shp.nh), w = shp.nw * sc, h = shp.nh * sc;
    return { x: bx + (bw - w) / 2, y: by + (bh - h) / 2, w: w, h: h, shape: shp };
  }

  /* ── THE ROUTE: one smooth line through every page, with a hand's wobble.
        Pages with a picture get a loose loop round its outline; pages without one get a plain gesture. ── */
  function joinY(j, pass) { return (0.60 + 0.09 * Math.sin(j * 2.1 + 1)) * VH + pass.shiftY * VH * 0.6; }
  /* The outline: a few-sided polygon that always CONTAINS the object (for each direction we measure how far the object reaches, then fence it in).
     Because it is built from the outside in, a thin or spiky object (a funnel, a handle) can never poke through the line. */
  function hullCorners(pass, rc, i) {
    var S = Math.max(rc.w, rc.h), shp = rc.shape, ring = [], k, K = Math.max(4, Math.min(12, pass.sides | 0 || 8));
    for (k = 0; k < BINS; k++) ring.push([rc.x + shp.u[k] * rc.w + i * VW, rc.y + shp.v[k] * rc.h]);
    var cx = rc.x + shp.cxn * rc.w + i * VW, cy = rc.y + shp.cyn * rc.h, mg = pass.margin * S, N = [], H = [], j;
    for (k = 0; k < K; k++) {
      var th = 2 * Math.PI * k / K, nx = Math.cos(th), ny = Math.sin(th), h = -1e9;
      for (j = 0; j < ring.length; j++) { var d = nx * ring[j][0] + ny * ring[j][1]; if (d > h) h = d; }
      N.push([nx, ny]); H.push(h + mg);
    }
    var out = [];
    for (k = 0; k < K; k++) {                                   // each corner is where two neighbouring fences meet
      var a = N[k], b = N[(k + 1) % K], det = a[0] * b[1] - a[1] * b[0]; if (Math.abs(det) < 1e-6) continue;
      var x = (H[k] * b[1] - H[(k + 1) % K] * a[1]) / det, y = (a[0] * H[(k + 1) % K] - b[0] * H[k]) / det;
      out.push({ p: [x, y], a: Math.atan2(y - cy, x - cx) * 180 / Math.PI });
    }
    return out;
  }
  /* How the line goes round the objects. Angles are on the object: 0 = right, 90 = bottom, 180 = left, 270 = top.
     It always arrives from the left and leaves to the right, so it never crosses the picture. A positive sweep goes over the top, a negative one under the bottom.
     Pages take these in turn, so some are looped over the top, some under the base, some only skim a corner. */
  var PLANS = [
    { start: 165, sweep: 255 },    // over the top and down the right side
    { start: 195, sweep: -250 },   // under the bottom and up the right side
    { start: 135, sweep: -105 },   // just a low curve under the lower half
    { start: 222, sweep: 112 }     // just a shallow cap over the upper half
  ];
  function loopPoints(pass, rc, R, i) {
    var v = hullCorners(pass, rc, i), plan = PLANS[(i + (pass.seed % 4)) % PLANS.length], th0 = plan.start + (R() - .5) * 12, sweep = plan.sweep + (R() - .5) * 12, dir = sweep >= 0 ? 1 : -1, reach = Math.abs(sweep);
    var items = v.map(function (q) { return { p: q.p, d: dir > 0 ? (((q.a - th0) % 360) + 360) % 360 : (((th0 - q.a) % 360) + 360) % 360 }; });
    items.sort(function (x, y) { return x.d - y.d; });
    var out = items.filter(function (q) { return q.d <= reach + 12; }).map(function (q) { return q.p; });
    if (out.length < 2) out = items.slice(0, 2).map(function (q) { return q.p; });
    return out;
  }
  /* straight sides with rounded corners: each corner is replaced by two points either side of it */
  function roundCorners(poly, r) {
    var out = [poly[0]];
    for (var i = 1; i < poly.length - 1; i++) {
      var P = poly[i - 1], V = poly[i], N = poly[i + 1], d1 = [V[0] - P[0], V[1] - P[1]], d2 = [N[0] - V[0], N[1] - V[1]], l1 = Math.hypot(d1[0], d1[1]) || 1, l2 = Math.hypot(d2[0], d2[1]) || 1;
      var rr = Math.min(r, l1 * 0.42, l2 * 0.42), A = [V[0] - d1[0] / l1 * rr, V[1] - d1[1] / l1 * rr], B = [V[0] + d2[0] / l2 * rr, V[1] + d2[1] / l2 * rr];
      var last = out[out.length - 1]; out.push([(last[0] + A[0]) / 2, (last[1] + A[1]) / 2]);   // a point mid-side keeps the sides straight
      out.push(A); out.push(B);
    }
    var l2p = out[out.length - 1], e = poly[poly.length - 1]; out.push([(l2p[0] + e[0]) / 2, (l2p[1] + e[1]) / 2]); out.push(e);
    return out;
  }
  function planOn(pi, page) {                                                    // the main line (0) is always painted; the others are sometimes left out of a page
    if (pi === 0) return true;
    var R = rng(page * 97 + 13), roll = R(), omit = 1 + Math.floor(R() * Math.max(1, CFG.passes.length - 1));
    return !(roll < CFG.dropChance && omit === pi);
  }
  function route(pass, n, rects, pi) {
    var R = rng(pass.seed), ctrl = [], bnd = [], loops = [], i;
    for (i = 0; i < n; i++) loops.push(rects[i] ? loopPoints(pass, rects[i], R, i) : null);
    // the line meets the next page at the height where it leaves one object and where it reaches the next, so the stretch between them stays in the open space
    function yAt(j) {
      var v = []; if (j > 0 && loops[j - 1]) v.push(loops[j - 1][loops[j - 1].length - 1][1]); if (j < n && loops[j]) v.push(loops[j][0][1]);
      var y = v.length ? v.reduce(function (p, q) { return p + q; }, 0) / v.length : joinY(j, pass);
      return Math.max(0.22 * VH, Math.min(0.72 * VH, y));
    }
    for (i = 0; i < n; i++) {
      var poly = [[i * VW, yAt(i)]];
      if (loops[i]) loops[i].forEach(function (p) { poly.push(p); });
      else GESTURES[(i + (pass.seed % 3)) % GESTURES.length].forEach(function (g) { poly.push([(i + g[0]) * VW, (g[1] + pass.shiftY) * VH]); });
      poly.push([(i + 1) * VW, yAt(i + 1)]);
      var rp = roundCorners(poly, Math.max(10, (rects[i] ? Math.max(rects[i].w, rects[i].h) : VH * 0.5) * pass.corner));
      if (i === 0) { ctrl.push(rp[0]); bnd.push(0); }
      for (var z = 1; z < rp.length; z++) ctrl.push(rp[z]);
      bnd.push(ctrl.length - 1);
    }
    var pts = [], at = [];
    for (var k = 0; k < ctrl.length - 1; k++) {
      var p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
      var steps = Math.max(6, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 8));
      at[k] = pts.length;
      for (var s = 0; s < steps; s++) {
        var t = s / steps, t2 = t * t, t3 = t2 * t;
        pts.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    at[ctrl.length - 1] = pts.length; pts.push(ctrl[ctrl.length - 1]);
    // the hand: slow drift plus a faint tremor, so no stretch of line is a perfect curve
    var base = finalize(pts), wx = shake(R, [[6, 300], [2.2, 130]]), wy = shake(R, [[6, 340], [2, 120]]), W = CFG.wobble;
    for (var q = 0; q < pts.length; q++) { var sA = base.S[q]; pts[q] = [pts[q][0] + wx(sA) * W, pts[q][1] + wy(sA) * W]; }
    var rt = finalize(pts);
    rt.B = bnd.map(function (ci) { return rt.S[Math.min(at[ci], pts.length - 1)]; });          // how far along the line each page boundary falls
    rt.PT = new Array(pts.length); var pg = 0;                                                  // how far through its own page every point is (0–1)
    rt.on = new Array(pts.length);
    for (var z = 0; z < pts.length; z++) { while (pg < n - 1 && rt.S[z] >= rt.B[pg + 1]) pg++; rt.PT[z] = Math.max(0, Math.min(1, (rt.S[z] - rt.B[pg]) / Math.max(1, rt.B[pg + 1] - rt.B[pg]))); rt.on[z] = planOn(pi, pg); }
    return rt;
  }

  /* the shape of the stroke along its length: how wide it presses, and where a band of it runs dry ("dry lane") */
  function profile(pass) {
    return {
      laneW: function (k) { var v = Math.sin(k * 0.013 + pass.seed); return v > -0.25 ? Math.min(1, (v + 0.25) * 1.3) : 0; },
      laneC: function (k) { return 0.5 * Math.sin(k * 0.0063 + pass.seed * 1.7); },
      press: function (k, pageT) { return (0.58 + 0.42 * Math.sin(Math.PI * Math.min(1, pageT * 1.05 + 0.04))) * (1 + 0.12 * Math.sin(k * 0.021 + pass.seed)); }
    };
  }
  /* the loaded body of the stroke: a solid ribbon with a rough edge */
  function bodyD(pass, rt, widthPx) {
    var R = rng(pass.seed * 5 + 3), P = profile(pass), half = widthPx * pass.width / 2, n = rt.pts.length, L = [], Rr = [], d = '';
    var eL = shake(R, [[0.45, 60], [0.25, 19]]), eR = shake(R, [[0.45, 66], [0.25, 21]]);
    function f(q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
    function flush() { if (L.length > 2) d += 'M' + L.map(f).join('L') + 'L' + Rr.reverse().map(f).join('L') + 'Z'; L = []; Rr = []; }
    for (var k = 0; k < n; k++) {
      if (!rt.on[k]) { flush(); continue; }
      var pageT = rt.PT[k], h = half * P.press(k, pageT) * 0.86;
      var a = h + eL(k * 8) + (R() - .5) * 0.4, b = h + eR(k * 8) + (R() - .5) * 0.4;
      L.push([rt.pts[k][0] + rt.N[k][0] * a, rt.pts[k][1] + rt.N[k][1] * a]);
      Rr.push([rt.pts[k][0] - rt.N[k][0] * b, rt.pts[k][1] - rt.N[k][1] * b]);
    }
    flush();
    return d;
  }
  /* the tooth of the canvas showing through: tiny holes and short drag marks cut out of the paint, thickest in the dry lanes */
  function holesD(pass, rt, widthPx) {
    var R = rng(pass.seed * 17 + 9), P = profile(pass), half = widthPx * pass.width / 2, n = rt.pts.length;
    var slots = Math.max(3, Math.round(widthPx * pass.width / 2.8)), dots = [[], [], []], flecks = [[], []];
    for (var k = 0; k < n - 1; k++) {
      var pageT = rt.PT[k], lw = P.laneW(k), lc = P.laneC(k), pr = P.press(k, pageT);
      if (!rt.on[k]) continue;
      for (var m = 0; m < slots; m++) {
        var bn = (R() * 2 - 1), lane = lw * Math.exp(-Math.pow((bn - lc) / 0.36, 2));
        var dens = (0.03 + 0.16 * Math.pow(pageT, 2.2) * (0.4 + 0.6 * Math.abs(bn)) + 0.7 * lane) * (CFG.texture * 1.6);
        if (R() > dens) continue;
        var t = R(), x = rt.pts[k][0] + (rt.pts[k + 1][0] - rt.pts[k][0]) * t, y = rt.pts[k][1] + (rt.pts[k + 1][1] - rt.pts[k][1]) * t;
        var nx = rt.N[k][0], ny = rt.N[k][1], o = bn * half * pr * 0.92;
        x += nx * o; y += ny * o;
        if (false) dots[0].push('M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l.1 0');
        else { var len = 5 + R() * 16 * (0.4 + lane), tx = -ny * len, ty = nx * len; flecks[Math.floor(R() * 2)].push('M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'l' + tx.toFixed(1) + ' ' + ty.toFixed(1)); }
      }
    }
    var sc = Math.max(0.8, Math.min(1.3, widthPx / 26)), out = [];
    [0.8, 1.3, 2.1].forEach(function (w, i) { if (dots[i].length) out.push({ d: dots[i].join(''), w: (w * sc).toFixed(2) }); });
    [0.6, 1.0].forEach(function (w, i) { if (flecks[i].length) out.push({ d: flecks[i].join(''), w: (w * sc).toFixed(2) }); });
    return out;
  }

  /* ── THE BRISTLES: many thin lines side by side, each wandering a little, thickening and thinning, breaking up where the brush runs dry ── */
  var WB = [0.8, 1.1, 1.5, 1.9], OB = [0.28, 0.45, 0.7];          // width and opacity choices for each stretch of bristle
  function bristlePaths(pass, rt, widthPx) {
    var R = rng(pass.seed * 7 + 1), half = widthPx * pass.width / 2, n = rt.pts.length;
    var strays = 0, total = pass.bristles + strays, buckets = {};
    function put(wi, oi, d) { var key = wi * 3 + oi; (buckets[key] = buckets[key] || []).push(d); }
    var P = profile(pass), laneW = P.laneW, laneC = P.laneC, press = P.press;
    for (var b = 0; b < total; b++) {
      var stray = b >= pass.bristles, bn, edge;
      if (!stray) { bn = ((b / (pass.bristles - 1)) * 2 - 1) * 1.06 + (R() - .5) * 0.08; edge = Math.abs(bn); }
      else { bn = (R() < .5 ? -1 : 1) * (1.0 + R() * 0.35); edge = 1.15; }       // loose flicks just outside the stroke
      var drift = shake(R, [[0.2 + 1.0 * Math.min(1, edge) * R(), 80 + R() * 90], [0.08 + 0.25 * R(), 34 + R() * 30]]);   // each bristle wanders on its own
      var draw = !stray || R() < .5, run = 0, gap = 0, d = '', wi = 1, oi = 2, runMax = 10 + Math.floor(R() * 24), runLen = 0;
      function pick() { wi = Math.min(3, Math.floor(R() * (stray ? 1.6 : 4 - 1.2 * edge))); oi = Math.floor(R() * (stray ? 2 : 3)); runMax = 10 + Math.floor(R() * 26); runLen = 0; }
      pick();
      for (var k = 0; k < n; k++) {
        if (!rt.on[k]) { if (d) { put(wi, oi, d); d = ''; } continue; }
        var pageT = rt.PT[k];
        var pr = press(k, pageT);   // the brush swells early on each page and lifts toward the end
        var lane = laneW(k) * Math.exp(-Math.pow((bn - laneC(k)) / 0.34, 2));
        var dry = (0.05 + 0.75 * Math.pow(pageT, 1.5)) * (0.25 + 0.75 * Math.pow(Math.min(1, edge), 1.2)) + 0.6 * lane;      // wet at the start of a page, drier toward its end; outer bristles first; plus the gritty lane
        if (draw) {
          if (R() < dry * 0.17 * (CFG.texture * 1.6) && run > 2) { if (d) { put(wi, oi, d); d = ''; } draw = false; gap = 3 + Math.floor(R() * (10 + 46 * dry)); pick(); }
          else run++;
        } else { gap--; if (gap <= 0) { draw = true; run = 0; } }
        if (!draw) continue;
        var off = bn * half * pr + drift(k * 8);
        var x = rt.pts[k][0] + rt.N[k][0] * off, y = rt.pts[k][1] + rt.N[k][1] * off;
        d += (d ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
        if (++runLen > runMax) { put(wi, oi, d); var keep = 'M' + x.toFixed(1) + ' ' + y.toFixed(1); pick(); d = keep; }   // start a new stretch with a new thickness
      }
      if (d) put(wi, oi, d);
    }
    var out = [], sc = Math.max(0.75, Math.min(1.3, widthPx / 26));
    Object.keys(buckets).forEach(function (key) {
      var wi2 = Math.floor(key / 3), oi2 = key % 3;
      out.push({ d: buckets[key].join(''), w: (WB[wi2] * sc).toFixed(2), o: (OB[oi2] * pass.ink).toFixed(2) });
    });
    return out;
  }

  function offsetD(rt, off) {
    var s = '';
    for (var k = 0; k < rt.pts.length; k++) s += (k ? 'L' : 'M') + (rt.pts[k][0] + rt.N[k][0] * off).toFixed(1) + ' ' + (rt.pts[k][1] + rt.N[k][1] * off).toFixed(1);
    return s;
  }

  function build() {
    pages = row ? row.querySelectorAll(':scope > .stacked-page:not(.pinned)').length : 0;
    VW = window.innerWidth; VH = window.innerHeight;
    if (pages < 2) { if (layer) layer.style.display = 'none'; built = null; return; }
    if (!layer) {
      layer = document.createElement('div'); layer.id = 'brush-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:hidden;pointer-events:none;z-index:' + CFG.zIndex + ';mix-blend-mode:' + CFG.blend;
      document.body.appendChild(layer);
    }
    layer.style.display = '';
    layer.innerHTML = '';
    var slides = Array.prototype.slice.call(row.querySelectorAll(':scope > .stacked-page:not(.pinned)')), rects = slides.map(function (sl) {
      var shp = SHAPES[slugOf(sl)]; return (shp && shp !== 'loading' && shp !== 'none') ? objectRect(sl, shp) : null;
    });
    var W = Math.min(CFG.maxWidth, Math.max(CFG.minWidth, VW * CFG.widthVw / 100));
    svgEl = document.createElementNS(NS, 'svg');
    svgEl.setAttribute('width', VW * pages); svgEl.setAttribute('height', VH);
    svgEl.setAttribute('viewBox', '0 0 ' + (VW * pages) + ' ' + VH);
    svgEl.style.cssText = 'position:absolute;top:0;left:0;display:block;overflow:visible;will-change:transform';
    var defs = document.createElementNS(NS, 'defs'); svgEl.appendChild(defs);
    built = [];
    CFG.passes.forEach(function (pass, pi) {
      var rt = route(pass, pages, rects, pi), mid = 'brush-mask-' + pi, R = rng(pass.seed * 13 + 5), half = W * pass.width / 2;
      var mask = document.createElementNS(NS, 'mask');
      mask.setAttribute('id', mid); mask.setAttribute('maskUnits', 'userSpaceOnUse');
      mask.setAttribute('x', -100); mask.setAttribute('y', -100); mask.setAttribute('width', VW * pages + 200); mask.setAttribute('height', VH + 200);
      var slices = [], reach = half * 1.5, sw = (reach * 2 / SLICES) * 1.45;
      for (var i = 0; i < SLICES; i++) {                         // the brush front is ragged: each slice of its width runs a little ahead or behind
        var mp = document.createElementNS(NS, 'path'), o = ((i + 0.5) / SLICES * 2 - 1) * reach;
        mp.setAttribute('d', offsetD(rt, o)); mp.setAttribute('fill', 'none'); mp.setAttribute('stroke', '#fff');
        mp.setAttribute('stroke-width', sw.toFixed(1)); mp.setAttribute('stroke-linecap', 'butt'); mp.setAttribute('stroke-linejoin', 'round');
        mask.appendChild(mp);
        slices.push({ el: mp, lag: R() * W * 2.4 * (0.4 + 0.6 * Math.abs(o) / reach) });
      }
      holesD(pass, rt, W).forEach(function (h) {                  // holes are painted black ON the mask, over the white reveal strokes
        var hp = document.createElementNS(NS, 'path');
        hp.setAttribute('d', h.d); hp.setAttribute('fill', 'none'); hp.setAttribute('stroke', '#000'); hp.setAttribute('stroke-width', h.w);
        hp.setAttribute('stroke-linecap', 'round'); hp.setAttribute('stroke-opacity', '0.92');
        mask.appendChild(hp);
      });
      defs.appendChild(mask);
      var g = document.createElementNS(NS, 'g'); g.setAttribute('mask', 'url(#' + mid + ')');
      g.setAttribute('fill', 'none'); g.setAttribute('stroke', pass.color); g.setAttribute('stroke-linecap', 'round'); g.setAttribute('stroke-linejoin', 'round');
      var body = document.createElementNS(NS, 'path'); body.setAttribute('d', bodyD(pass, rt, W)); body.setAttribute('fill', pass.color); body.setAttribute('fill-opacity', (0.98 * pass.ink).toFixed(2)); body.setAttribute('stroke', 'none');
      g.appendChild(body);
      bristlePaths(pass, rt, W).forEach(function (bp) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', bp.d); p.setAttribute('stroke-width', bp.w); p.setAttribute('stroke-opacity', bp.o);
        g.appendChild(p);
      });
      svgEl.appendChild(g);
      built.push({ rt: rt, slices: slices });
    });
    layer.appendChild(svgEl);                                    // measure lengths once it is in the page
    built.forEach(function (b) {
      b.slices.forEach(function (sl) {
        var t = sl.el.getTotalLength(); sl.total = t;
        sl.el.setAttribute('stroke-dasharray', t + ' ' + (t + 10)); sl.el.setAttribute('stroke-dashoffset', t);
      });
    });
    head = Math.min(head, VW * pages);
    paint();
  }

  /* how far along the stroke (0–1) has the brush reached when it is at x? Page by page, so a loop round an object is painted evenly as you cross its page */
  function fracAt(rt, x) {
    var n = rt.B.length - 1; if (x <= 0) return 0; if (x >= n * VW) return 1;
    var i = Math.min(n - 1, Math.floor(x / VW)), u = (x - i * VW) / VW;
    return (rt.B[i] + u * (rt.B[i + 1] - rt.B[i])) / rt.len;
  }
  function paint() {
    if (!built) return;
    svgEl.style.transform = 'translate3d(' + (-row.scrollLeft) + 'px,0,0)';
    built.forEach(function (b) {
      var fr = fracAt(b.rt, head);
      b.slices.forEach(function (sl) {
        var vis = fr <= 0 ? 0 : fr >= 1 ? sl.total : Math.max(0, sl.total * fr - sl.lag * (fr < 0.999 ? 1 : 0));
        sl.el.setAttribute('stroke-dashoffset', (sl.total - vis).toFixed(1));
      });
    });
  }
  /* The brush tip is tied to the scroll position: it sits at the right-hand edge of the screen. No easing, no catching up, nothing after you stop. */
  function frame(now) {
    raf = 0;
    if (!row) return;
    if (introing) {
      if (!introT0) {                                   // wait (briefly) until the first object's outline is known, so the stroke is drawn once, in its final shape
        var f0 = row.querySelector(':scope > .stacked-page:not(.pinned)'), st = (f0 && urlOf(f0)) ? SHAPES[slugOf(f0)] : 'none';
        if ((st && st !== 'loading') || now - introWait > 2500) introT0 = now; else { lead = 0; head = row.scrollLeft; paint(); raf = requestAnimationFrame(frame); return; }
      }
      var t = Math.min(1, (now - introT0) / (CFG.intro * 1000));
      lead = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      if (t >= 1) { introing = false; lead = 1; } else raf = requestAnimationFrame(frame);
    }
    head = row.scrollLeft + VW * lead;
    paint();
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  function onScroll() { kick(); }

  var rebuildT = 0;
  function rebuildSoon() { clearTimeout(rebuildT); rebuildT = setTimeout(function () { build(); kick(); }, 180); }
  window.addEventListener('resize', rebuildSoon);

  /* wait for the page row, then start (and rebuild if pages are added or removed) */
  var tries = 0;
  (function boot() {
    row = getRow();
    if (row && row.querySelectorAll(':scope > .stacked-page:not(.pinned)').length >= 2) {
      build(); if (!REDUCED && CFG.intro > 0) { introing = true; lead = 0; introWait = performance.now(); } row.addEventListener('scroll', onScroll, { passive: true }); kick(); resolveShapes();
      setInterval(function () { var r = getRow(), n = r ? r.querySelectorAll(':scope > .stacked-page:not(.pinned)').length : 0; if (r !== row) { if (row) row.removeEventListener('scroll', onScroll); row = r; if (row) row.addEventListener('scroll', onScroll, { passive: true }); } if (n !== pages) rebuildSoon(); resolveShapes(); }, 1500);
    } else if (++tries < 80) setTimeout(boot, 250);
  })();
})();
