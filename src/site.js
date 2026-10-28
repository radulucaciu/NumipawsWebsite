// NumiPaws site script. ES2020, no dependencies, runs under a strict CSP.
(function () {
  'use strict';
  var KEY = 'numipaws.lang';
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Language memory: redirect to the saved language, remember switcher clicks.
  (function () {
    if (root.hasAttribute('data-nolang') || /[?&]nolang\b/.test(location.search)) return;
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if ((saved !== 'en' && saved !== 'ro') || saved === root.lang) return;
    var path = location.pathname.replace(/^\/ro(?=\/|$)/, '') || '/';
    var target = (saved === 'ro' ? '/ro' : '') + path;
    if (target !== location.pathname) location.replace(target + location.search + location.hash);
  })();
  document.querySelectorAll('a[data-lang]').forEach(function (a) {
    a.addEventListener('click', function () {
      try { localStorage.setItem(KEY, a.getAttribute('data-lang')); } catch (e) {}
    });
  });

  // 2. Mobile menu.
  var menuBtn = document.querySelector('[data-menu-btn]');
  var menu = document.querySelector('[data-menu]');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', menuBtn.getAttribute(open ? 'data-label-close' : 'data-label-open'));
    menuBtn.textContent = open ? '✕' : '☰';
  }
  var menuOpen = function () { return !!menu && menu.classList.contains('is-open'); };
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () { setMenu(!menuOpen()); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a[href^="#"]')) setMenu(false); });
  }

  // 3. Language dropdowns.
  var switches = Array.from(document.querySelectorAll('[data-ls]'));
  function setSwitch(s, open) {
    s.classList.toggle('is-open', open);
    s.querySelector('button').setAttribute('aria-expanded', String(open));
  }
  var closeSwitches = function () { switches.forEach(function (s) { setSwitch(s, false); }); };
  switches.forEach(function (s) {
    s.querySelector('button').addEventListener('click', function () {
      var open = !s.classList.contains('is-open');
      closeSwitches();
      setSwitch(s, open);
      if (open) (s.querySelector('[aria-checked="true"]') || s.querySelector('[role="menuitemradio"]')).focus();
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    switches.forEach(function (s) {
      if (s.classList.contains('is-open')) { setSwitch(s, false); s.querySelector('button').focus(); }
    });
    if (menuOpen()) { setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener('click', function (e) {
    switches.forEach(function (s) { if (s.classList.contains('is-open') && !s.contains(e.target)) setSwitch(s, false); });
    if (menuOpen() && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
  });

  // 4. Decorative star counter: 24 to 36, then wrap. Off under reduced motion.
  var counter = document.querySelector('[data-stars]');
  if (counter && !reduceMotion) {
    var stars = 24, pill = counter.parentNode;
    setInterval(function () {
      stars = stars >= 36 ? 24 : stars + 1;
      counter.textContent = String(stars);
      pill.classList.remove('pop');
      void pill.offsetWidth;
      pill.classList.add('pop');
    }, 1400);
  }

  // 5. Video: swap the poster for a YouTube (nocookie) iframe on click only.
  var video = document.querySelector('[data-video]');
  var play = video && video.querySelector('[data-play]');
  if (play) {
    play.addEventListener('click', function () {
      var id = video.getAttribute('data-youtube-id') || '';
      if (play.disabled || !/^[\w-]{6,24}$/.test(id)) return;
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      frame.setAttribute('allow', 'autoplay; fullscreen');
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('loading', 'lazy');
      frame.title = play.getAttribute('data-title') || '';
      var poster = video.querySelector('[data-poster]');
      poster.parentNode.replaceChild(frame, poster);
      play.remove();
    });
  }

  // 6. Roster "Copy" button: a mock. Label only, no clipboard access.
  var copyBtn = document.querySelector('[data-copy]');
  if (copyBtn) {
    var label = copyBtn.textContent, timer;
    copyBtn.addEventListener('click', function () {
      copyBtn.textContent = copyBtn.getAttribute('data-copied') + ' ✓';
      clearTimeout(timer);
      timer = setTimeout(function () { copyBtn.textContent = label; }, 1600);
    });
  }
})();
