// 2026 Tohoku Itinerary — place sheet.
// A timeline row marked data-place="aomori.html#nebuta-museum" opens that
// place's entry from its city page instead of expanding in place: a bottom
// sheet on phones (swipe down to close), a centred dialog from 760px up.
// On the city pages, each "What to see" place becomes a compact row (name,
// hours, chevron) that opens the same sheet, with its visits looked up on
// the timeline. Eat and Shop keep their full cards.
// The entry is read live from the city page, which is already in the offline
// cache, so there is one copy of the text and it works offline. Optional
// extras on the city page's .place: data-jp (Japanese name), data-photo,
// data-photo-credit, data-photo-source. Without JS, or if the page can't be
// read, the row just expands as before.

(function () {
  if (!window.HTMLDialogElement || !window.fetch || !window.DOMParser) return;
  var root = document.documentElement;
  root.classList.add('has-sheet');

  var pages = {};
  function load(url) {
    if (!pages[url]) {
      pages[url] = fetch(url).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      }).then(function (html) {
        return new DOMParser().parseFromString(html, 'text/html');
      });
      pages[url].catch(function () { delete pages[url]; });
    }
    return pages[url];
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function own(node) { return node ? document.importNode(node, true) : null; }

  // The sheet: one <dialog>, refilled for each place.
  var sheet = el('dialog', 'sheet');
  sheet.setAttribute('aria-labelledby', 'sheet-title');
  var grab = el('div', 'sheet__grab');
  grab.setAttribute('aria-hidden', 'true');
  var close = el('button', 'sheet__close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var scroller = el('div', 'sheet__scroll');
  // Focus lands on the content when the sheet opens (arrow keys scroll it),
  // not on the close button.
  scroller.tabIndex = -1;
  scroller.setAttribute('autofocus', '');
  // Gradient blur along the top edge, shown once content scrolls under it.
  var veil = el('div', 'sheet__veil');
  veil.setAttribute('aria-hidden', 'true');
  veil.innerHTML = '<i></i><i></i><i></i>';
  sheet.appendChild(veil);
  sheet.appendChild(grab);
  sheet.appendChild(close);
  sheet.appendChild(scroller);
  document.body.appendChild(sheet);
  scroller.addEventListener('scroll', function () {
    // On a hero sheet the top blur waits until the text reaches the top
    // edge; over the darkening photo it would only add a light haze.
    var under = hero && hero.nextElementSibling ? hero.nextElementSibling.offsetTop - 76 : 4;
    sheet.classList.toggle('is-scrolled', scroller.scrollTop > under);
    if (hero) requestHero();
  }, { passive: true });

  // Every sheet with a photo opens as a hero, like an Apple Music artist
  // page: the photo holds nearly still and darkens as the text scrolls up
  // over it; pulling down past the top stretches it.
  var hero = null, heroQueued = false;
  function requestHero() {
    if (heroQueued) return;
    heroQueued = true;
    requestAnimationFrame(function () {
      heroQueued = false;
      if (!hero) return;
      var h = hero.offsetHeight || 1;
      var y = scroller.scrollTop;
      var p = Math.max(0, Math.min(1, y / h));
      var img = hero.firstChild;
      if (y < 0) {
        img.style.transform = 'scale(' + (1 + -y / h) + ')';
      } else {
        // Moves at a fifth of the scroll speed, easing slightly back in depth.
        img.style.transform = 'translateY(' + (y * 0.8) + 'px) scale(' + (1 - p * 0.06) + ')';
      }
      hero.style.setProperty('--hero-fade', (p * 0.85).toFixed(3));
    });
  }

  function tile(label, big, sub) {
    var t = el('div', 'stay__tile');
    t.appendChild(el('span', 'stay__label', label));
    t.appendChild(el('span', 'stay__big', big));
    if (sub) t.appendChild(el('span', 'stay__sub', sub));
    return t;
  }

  // place: the city page's .place; doc: the page it is on; visits: the
  // timeline rows for it (may be none); onCity: opened from the city page.
  function fill(place, doc, visits, href, onCity) {
    if (!place) return false;
    var d = place.dataset;
    scroller.textContent = '';
    sheet.classList.toggle('sheet--photo', !!d.photo);
    sheet.classList.toggle('sheet--hero', !!d.photo);
    hero = null;

    if (d.photo) {
      var fig = el('figure', 'sheet__photo');
      var img = el('img');
      img.src = d.photo;
      img.alt = '';
      img.decoding = 'async';
      fig.appendChild(img);
      if (d.photoCredit) {
        var cap = el('figcaption');
        var a = el(d.photoSource ? 'a' : 'span', null, 'Photo: ' + d.photoCredit);
        if (d.photoSource) { a.href = d.photoSource; a.target = '_blank'; a.rel = 'noopener'; }
        cap.appendChild(a);
        fig.appendChild(cap);
      }
      scroller.appendChild(fig);
      hero = fig;
      requestHero();
    }

    var body = el('div', 'sheet__body');
    scroller.appendChild(body);

    // The name's trailing span is the area ("— Hirosaki") or, now and then,
    // the Japanese name; neither belongs in the heading itself.
    var nameEl = place.querySelector('.place__name');
    var extra = nameEl.querySelector('span');
    var area = '', jpName = d.jp || '';
    if (extra) {
      var parts = extra.textContent.split('—');
      area = (parts[1] || '').trim();
      var x = parts[0].trim();
      if (!jpName && /[぀-ヿ一-鿿]/.test(x)) jpName = x;
    }
    var title = '';
    for (var k = 0; k < nameEl.childNodes.length; k++) {
      if (nameEl.childNodes[k].nodeType === 3) title += nameEl.childNodes[k].textContent;
    }

    // Eyebrow: city · area, or city · section where there's no area.
    var city = doc.querySelector('.city__name');
    var section = null;
    for (var n = place.previousElementSibling; n; n = n.previousElementSibling) {
      if (n.classList.contains('section-label')) { section = n; break; }
    }
    var eyebrow = [city && city.textContent.trim(), area || (section && section.textContent.trim())].filter(Boolean).join(' · ');
    if (eyebrow) body.appendChild(el('p', 'sheet__eyebrow', eyebrow));

    var name = el('h2', 'sheet__name', title.trim());
    name.id = 'sheet-title';
    body.appendChild(name);
    if (jpName) {
      var jp = el('p', 'sheet__jp', jpName);
      jp.lang = 'ja';
      body.appendChild(jp);
    }
    var meta = place.querySelector('.place__meta');
    var metaText = meta ? meta.textContent.trim() : '';
    if (meta) body.appendChild(el('p', 'sheet__meta', metaText));

    // Your visit: the timeline's own day, time and cost for this stop.
    if (visits.length) {
      var visit = el('div', 'sheet__visit');
      visit.appendChild(el('p', 'sheet__label', 'On the timeline'));
      if (visits.length === 1) addVisit(visit, visits[0], href, metaText);
      else addVisits(visit, visits, href, metaText);
      body.appendChild(visit);
    }

    var desc = place.querySelector('.place__desc');
    if (desc) {
      body.appendChild(el('p', 'sheet__label', 'Highlights'));
      body.appendChild(own(desc));
    }

    var actions = el('div', 'sheet__actions');
    var map = place.querySelector('.place__map');
    if (map) {
      var m = own(map);
      m.className = 'stay__map';
      actions.appendChild(m);
    }
    if (!onCity) {
      var guide = el('a', 'place__map', (city ? city.textContent.trim() + ' guide' : 'City guide') + ' →');
      guide.href = href;
      actions.appendChild(guide);
    }
    body.appendChild(actions);
    return true;
  }

  // Several visits (e.g. a shopping street most evenings): one line each —
  // day, then time — and any note they share shown once.
  function addVisits(visit, rows, href, metaText) {
    var list = el('ul', 'sheet__visits');
    var seen = {};
    var notes = el('div');
    for (var r = 0; r < rows.length; r++) {
      var date = rows[r].closest('.day-section').querySelector('.day-header__date').textContent.trim().split(' ');
      var li = el('li');
      li.appendChild(el('span', 'sheet__visit-day', date[0] + ' ' + date.slice(1).join(' ')));
      var time = rows[r].querySelector('.row__time');
      if (time && time.firstChild && time.firstChild.textContent.trim()) {
        var until = time.querySelector('small');
        li.appendChild(el('span', 'sheet__visit-time', time.firstChild.textContent.trim() + (until ? '–' + until.textContent.replace('→', '').trim() : '')));
      }
      list.appendChild(li);
      var tmp = el('div');
      addNotes(tmp, rows[r], href, metaText);
      while (tmp.firstChild) {
        var n = tmp.firstChild;
        tmp.removeChild(n);
        if (seen[n.textContent]) continue;
        seen[n.textContent] = true;
        notes.appendChild(n);
      }
    }
    visit.appendChild(list);
    while (notes.firstChild) visit.appendChild(notes.firstChild);
  }

  function addVisit(visit, row, href, metaText) {
    var tiles = el('div', 'sheet__tiles');
    var date = row.closest('.day-section').querySelector('.day-header__date').textContent.trim().split(' ');
    tiles.appendChild(tile('Day', date.slice(1).join(' '), date[0]));
    // Time and cost only where the row has them (some stops are untimed or free).
    var time = row.querySelector('.row__time');
    if (time && time.firstChild && time.firstChild.textContent.trim()) {
      var until = time.querySelector('small');
      tiles.appendChild(tile('Time', time.firstChild.textContent.trim(), until ? 'to ' + until.textContent.replace('→', '').trim() : ''));
    }
    var cost = row.querySelector('.row__cost');
    if (cost && cost.firstChild && cost.firstChild.textContent.trim()) {
      var sgd = cost.querySelector('.sgd');
      tiles.appendChild(tile('Cost', cost.firstChild.textContent.trim(), sgd ? sgd.textContent.trim() : ''));
    }
    visit.appendChild(tiles);
    addNotes(visit, row, href, metaText);
  }

  function addNotes(visit, row, href, metaText) {
    // The row's own notes, minus its link back to the city page and minus
    // plain opening-hours sentences already shown in the meta line above.
    var notes = row.querySelectorAll('.row__detail > p, .row__detail > ul');
    for (var i = 0; i < notes.length; i++) {
      var link = notes[i].querySelector('a[href="' + href + '"]');
      if (link && notes[i].textContent.trim() === link.textContent.trim()) continue;
      var note = own(notes[i]);
      if (!note.children.length) {
        var kept = note.textContent.trim().split(/(?<=\.)\s+/).filter(function (s) {
          var m = s.match(/^(?:(?:Garden )?open|Daily|Open daily|[A-Z][a-z]{2}[–-][A-Z][a-z]{2})?\s*(\d{4}[–-]\d{4})(?:\s*\([^)]*\)|\s+per [^.]*)?\.$/i);
          return !(m && metaText.indexOf(m[1]) !== -1);
        });
        if (!kept.length) continue;
        note.textContent = kept.join(' ');
      }
      note.classList.add('sheet__note');
      visit.appendChild(note);
    }
  }

  var lastRow = null;
  function show(trigger) {
    lastRow = trigger;
    scroller.scrollTop = 0;
    if (hero) requestHero();
    sheet.classList.remove('is-scrolled');
    sheet.style.transform = '';
    sheet.classList.remove('is-closing');
    if (!sheet.open) sheet.showModal();
    root.classList.add('sheet-open');
  }

  // From the timeline: read the place from its city page.
  function open(row) {
    var href = row.getAttribute('data-place');
    load(href.split('#')[0]).then(function (doc) {
      if (!fill(doc.getElementById(href.split('#')[1]), doc, [row], href, false)) throw new Error('missing place');
      show(row.querySelector('summary'));
    }).catch(function () {
      // Couldn't read the city page: fall back to expanding the row.
      row.open = !row.open;
    });
  }

  // On a city page: the place is here; its visits come from the timeline
  // (also in the offline cache). Without it, the sheet just has no visits.
  var page = location.pathname.split('/').pop() || 'index.html';
  function timelineRows(timeline, href) {
    var rows = timeline.querySelectorAll('details.row');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].getAttribute('data-place') === href || rows[i].querySelector('.row__detail a[href="' + href + '"]')) out.push(rows[i]);
    }
    return out;
  }
  function openPlace(place) {
    var href = page + '#' + place.id;
    var go = function (visits) {
      if (fill(place, document, visits, href, true)) show(place);
    };
    load('index.html').then(function (timeline) { go(timelineRows(timeline, href)); }, function () { go([]); });
  }

  // City pages: each "What to see" place as a row — name, hours, chevron right.
  var places = [].filter.call(document.querySelectorAll('.place[id]'), function (pl) {
    for (var n = pl.previousElementSibling; n; n = n.previousElementSibling) {
      if (n.classList.contains('section-label')) return n.id === 'see';
    }
    return false;
  });
  var CHEV = '<svg class="place__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  // The row shows the meta line's hours: its first part that reads as hours,
  // or else simply its first part.
  var HOURS = /\d{4}|hours|open|sunset|always|free to/i;
  for (var p = 0; p < places.length; p++) {
    var pl = places[p];
    var name = pl.querySelector('.place__name');
    if (!name) continue;
    var meta = pl.querySelector('.place__meta');
    var parts = meta ? meta.textContent.trim().split(' · ') : [];
    var hours = parts.filter(function (s) { return HOURS.test(s); })[0] || parts[0];
    // Long hours keep only their lead ("Roughly 1130–2200 (LO 2130) — some
    // sources…"); the sheet has the full line.
    var lead = hours ? hours.split(' — ')[0] : '';
    if (lead !== hours && HOURS.test(lead) && lead.split('(').length === lead.split(')').length) hours = lead;
    if (hours) name.insertAdjacentElement('afterend', el('p', 'place__hours', hours));
    pl.insertAdjacentHTML('beforeend', CHEV);
    pl.classList.add('place--row');
    pl.tabIndex = 0;
    pl.setAttribute('role', 'button');
    pl.setAttribute('aria-haspopup', 'dialog');
  }
  if (places.length) {
    document.addEventListener('click', function (e) {
      var pl = e.target.closest && e.target.closest('.place--row');
      if (!pl || e.target.closest('a')) return;
      openPlace(pl);
    });
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('place--row')) {
        e.preventDefault();
        openPlace(e.target);
      }
    });
    // Arriving from the timeline's "Find out more": open that place too.
    window.addEventListener('load', function () {
      var target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target && target.classList.contains('place--row')) openPlace(target);
    });
  }

  var closing = false;
  function shut() {
    if (!sheet.open || closing) return;
    closing = true;
    sheet.classList.add('is-closing');
    var done = function () {
      sheet.removeEventListener('animationend', done);
      clearTimeout(timer);
      closing = false;
      sheet.classList.remove('is-closing');
      sheet.style.transform = '';
      sheet.close();
    };
    // Motion switch off: no closing animation to wait for.
    var timer = setTimeout(done, root.getAttribute('data-motion') === 'off' ? 0 : 400);
    sheet.addEventListener('animationend', done);
  }

  sheet.addEventListener('close', function () {
    root.classList.remove('sheet-open');
    if (lastRow) lastRow.focus({ preventScroll: true });
  });
  sheet.addEventListener('cancel', function (e) { e.preventDefault(); shut(); });
  close.addEventListener('click', shut);
  // A tap on the backdrop (outside the sheet's box) closes it.
  sheet.addEventListener('click', function (e) {
    if (e.target !== sheet) return;
    var r = sheet.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) shut();
  });

  document.addEventListener('click', function (e) {
    var summary = e.target.closest && e.target.closest('details.row[data-place] > summary');
    if (!summary || e.target.closest('a')) return;
    e.preventDefault();
    open(summary.parentElement);
  });

  // Phones: drag the sheet down to close it, from the top or once its
  // content is scrolled to the top.
  var phone = window.matchMedia('(max-width: 759px)');
  var startY = null, dy = 0, startT = 0;
  sheet.addEventListener('touchstart', function (e) {
    if (!phone.matches || e.touches.length !== 1 || scroller.scrollTop > 0) { startY = null; return; }
    startY = e.touches[0].clientY;
    startT = Date.now();
    dy = 0;
  }, { passive: true });
  sheet.addEventListener('touchmove', function (e) {
    if (startY == null) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { sheet.style.transform = ''; return; }
    e.preventDefault();
    sheet.classList.add('is-dragging');
    sheet.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: false });
  sheet.addEventListener('touchend', function () {
    if (startY == null) return;
    startY = null;
    sheet.classList.remove('is-dragging');
    var fast = dy > 40 && dy / Math.max(1, Date.now() - startT) > 0.5;
    if (dy > 120 || fast) shut();
    else sheet.style.transform = '';
  });
})();
