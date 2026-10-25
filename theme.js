// 2026 Tohoku Itinerary — colour theme, collapsing masthead, sticky offsets.
// Theme: opening the app follows the device's light/dark setting. The toggle
// shows the mode on screen; a tap switches to the other and that choice is
// kept on every page for the rest of the visit (sessionStorage; each page's
// <head> applies it before first paint). Also keeps the browser chrome in step.

(function () {
  var root = document.documentElement;
  var choice = 'auto';      // 'auto' (device) until the toggle is tapped
  try {
    var kept = sessionStorage.getItem('theme');
    if (kept === 'light' || kept === 'dark') choice = kept;
  } catch (e) {}
  // Earlier versions saved the choice; clear it so loads follow the device.
  try { localStorage.removeItem('theme'); } catch (e) {}
  var LABEL = {
    light: 'Light mode. Switch to dark mode.',
    dark: 'Dark mode. Switch to light mode.'
  };
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function read() { return choice; }

  function isDark(mode) {
    return mode === 'dark' || (mode === 'auto' && darkQuery && darkQuery.matches);
  }

  function syncChrome(mode) {
    var colour = isDark(mode) ? '#1a0a06' : '#ffffff';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) {
      // With a forced theme, both media variants show the forced colour.
      metas[i].setAttribute('content', mode === 'auto' ? metas[i].getAttribute('data-auto') : colour);
    }
  }

  function apply(mode) {
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    var shown = isDark(mode) ? 'dark' : 'light';
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('data-mode', shown);
      btns[i].setAttribute('aria-label', LABEL[shown]);
      btns[i].setAttribute('title', LABEL[shown]);
    }
    syncChrome(mode);
  }

  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var m = 0; m < metas.length; m++) metas[m].setAttribute('data-auto', metas[m].getAttribute('content'));

  apply(read());

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    choice = isDark(choice) ? 'light' : 'dark';
    try { sessionStorage.setItem('theme', choice); } catch (err) {}
    apply(choice);
  });

  // Motion switch: on unless turned off; kept across visits (localStorage),
  // applied before first paint by each page's <head>. Off stops every
  // animation and transition (styles.css) and the scripted ones below.
  var MOTION_LABEL = {
    on: 'Motion on. Turn motion off.',
    off: 'Motion off. Turn motion on.'
  };
  function motionOff() { return root.getAttribute('data-motion') === 'off'; }
  function applyMotion() {
    var shown = motionOff() ? 'off' : 'on';
    var btns = document.querySelectorAll('[data-motion-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('data-mode', shown);
      btns[i].setAttribute('aria-label', MOTION_LABEL[shown]);
      btns[i].setAttribute('title', MOTION_LABEL[shown]);
    }
  }
  applyMotion();
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-motion-toggle]');
    if (!btn) return;
    if (motionOff()) root.removeAttribute('data-motion');
    else root.setAttribute('data-motion', 'off');
    try {
      if (motionOff()) localStorage.setItem('motion', 'off');
      else localStorage.removeItem('motion');
    } catch (err) {}
    applyMotion();
  });

  if (darkQuery && darkQuery.addEventListener) {
    darkQuery.addEventListener('change', function () { apply(read()); });
  }

  // Sticky offsets (section menu, day jumps) sit directly under the pinned bar,
  // whose height changes with the safe area and the viewport.
  // Route menu: one red underline that slides to the tapped page, then the
  // page loads (where the underline already sits under the new page).
  var route = document.querySelector('.route');
  if (route) {
    var ink = document.createElement('span');
    ink.className = 'route__ink';
    ink.setAttribute('aria-hidden', 'true');
    route.appendChild(ink);
    route.classList.add('has-ink');
    var place = function (link) {
      if (!link) return;
      ink.style.width = link.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + link.offsetLeft + 'px)';
    };
    place(route.querySelector('a[aria-current="page"]'));
    requestAnimationFrame(function () { route.classList.add('ink-ready'); });
    window.addEventListener('resize', function () { place(route.querySelector('a[aria-current="page"]')); });
    route.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link || link.getAttribute('aria-current') === 'page') return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      if (motionOff()) return;   // motion off: go straight there
      e.preventDefault();
      var cur = route.querySelector('a[aria-current="page"]');
      if (cur) cur.removeAttribute('aria-current');
      link.setAttribute('aria-current', 'page');
      place(link);
      setTimeout(function () { window.location.href = link.href; }, 260);
    });
  }

  // City pages' section menu (Stay / See / Eat / Shop): the same sliding
  // underline, following whichever tab is current — tapped or scrolled to.
  var sub = document.querySelector('.subnav');
  if (sub) {
    var subInk = document.createElement('span');
    subInk.className = 'subnav__ink';
    subInk.setAttribute('aria-hidden', 'true');
    sub.appendChild(subInk);
    sub.classList.add('has-ink');
    var placeSub = function () {
      var a = sub.querySelector('a[aria-current="true"]');
      if (!a) return;
      subInk.style.width = a.offsetWidth + 'px';
      subInk.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    };
    placeSub();
    requestAnimationFrame(function () { sub.classList.add('ink-ready'); });
    if (window.MutationObserver) {
      new MutationObserver(placeSub).observe(sub, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
    }
    window.addEventListener('resize', placeSub);

    // Once it pins under the top bars it becomes the bottom of the stack, so
    // the stack's shadow moves down to it (CSS: .is-sub-pinned).
    var pinned = null;
    var checkSub = function () {
      var now = sub.getBoundingClientRect().top <= parseFloat(getComputedStyle(sub).top) + 0.5;
      if (now === pinned) return;
      pinned = now;
      root.classList.toggle('is-sub-pinned', pinned);
    };
    window.addEventListener('scroll', checkSub, { passive: true });
    window.addEventListener('resize', checkSub);
    checkSub();
  }

  // Timeline rows: animate opening and closing instead of snapping. The row's
  // colour block (.row[open]) fades in via CSS; this eases the height.
  document.addEventListener('click', function (e) {
    var summary = e.target.closest && e.target.closest('details.row > summary');
    if (!summary || e.target.closest('a')) return;
    var row = summary.parentElement;
    // Rows that open a place sheet (place-sheet.js) don't expand in place.
    if (row.hasAttribute('data-place') && document.documentElement.classList.contains('has-sheet')) return;
    var body = row.querySelector('.row__detail');
    if (!body || !body.animate || motionOff()) return;   // motion off: plain open/close
    e.preventDefault();
    if (row._anim) row._anim.cancel();
    body.style.overflow = 'hidden';
    var done = function () { body.style.overflow = ''; row._anim = null; };
    if (!row.open) {
      row.open = true;
      var h = body.offsetHeight;
      row._anim = body.animate(
        [{ height: '0px', opacity: 0, transform: 'translateY(-4px)' },
         { height: h + 'px', opacity: 1, transform: 'none' }],
        { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
      row._anim.onfinish = done;
    } else {
      var from = body.offsetHeight;
      row._anim = body.animate(
        [{ height: from + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
        { duration: 200, easing: 'cubic-bezier(.4,0,.6,1)' });
      row._anim.onfinish = function () { row.open = false; done(); };
      row._anim._closing = true;
    }
    // Safety net: if frames are throttled (background tab, low power), never
    // leave a row stuck mid-animation; jump to the end state.
    var anim = row._anim;
    setTimeout(function () {
      if (row._anim !== anim) return;
      var closing = anim._closing;
      anim.onfinish = null;
      anim.cancel();
      if (closing) row.open = false;
      done();
    }, 400);
  });

  // When the masthead is collapsed, the slim bar sits above the pinned bar too.
  var mast = document.querySelector('.navbar');
  var mini = document.querySelector('.mini');
  function syncMast() {
    if (!mast) return;
    var h = mast.offsetHeight;
    if (mini && root.classList.contains('is-collapsed')) h += mini.offsetHeight;
    root.style.setProperty('--mast-h', h + 'px');
    // Anchor jumps land below the masthead, so the slim bar is always shown.
    root.style.setProperty('--pin-h', (mast.offsetHeight + (mini ? mini.offsetHeight : 0)) + 'px');
    var subnav = document.querySelector('.subnav');
    if (subnav) root.style.setProperty('--sub-h', subnav.offsetHeight + 'px');
  }
  syncMast();
  if (mast && window.ResizeObserver) new ResizeObserver(syncMast).observe(mast);
  else window.addEventListener('resize', syncMast);

  // Collapse the masthead into the slim bar once it has scrolled out of view.
  var hero = document.querySelector('.hero');
  if (hero && mini) {
    var collapsed = null;
    function checkHero() {
      var now = hero.getBoundingClientRect().bottom <= 0;
      if (now === collapsed) return;
      collapsed = now;
      root.classList.toggle('is-collapsed', collapsed);
      mini.setAttribute('aria-hidden', collapsed ? 'false' : 'true');
      var focusables = mini.querySelectorAll('a, button');
      for (var i = 0; i < focusables.length; i++) focusables[i].tabIndex = collapsed ? 0 : -1;
      syncMast();
    }
    // One getBoundingClientRect per scroll; it only touches the DOM on change.
    window.addEventListener('scroll', checkHero, { passive: true });
    window.addEventListener('resize', checkHero);
    // A link straight to a day scrolls after load, so check again then.
    window.addEventListener('load', function () {
      // Arriving on a section link (e.g. "Find out more"): redo the jump now
      // that the offsets are measured, so the heading clears the pinned bars.
      var target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) { syncMast(); target.scrollIntoView({ block: 'start' }); }
      setTimeout(checkHero, 50);
    });
    checkHero();
  }
})();
