/* ============================================================
   ORKIN REDESIGN v2 — JavaScript
   All buttons work. Modal, forms, carousel, mobile bar, nav,
   ZIP autocomplete, preview-only toast for internal links.
   ============================================================ */
(function () {
  'use strict';

  // ── ZIP AUTOCOMPLETE ─────────────────────────────────────
  var ZIPS = [
    { z: '10001', c: 'New York, NY' },
    { z: '30301', c: 'Atlanta, GA' },
    { z: '60601', c: 'Chicago, IL' },
    { z: '77001', c: 'Houston, TX' },
    { z: '85001', c: 'Phoenix, AZ' },
    { z: '19101', c: 'Philadelphia, PA' },
    { z: '78201', c: 'San Antonio, TX' },
    { z: '75201', c: 'Dallas, TX' },
    { z: '32099', c: 'Jacksonville, FL' },
    { z: '90210', c: 'Beverly Hills, CA' },
    { z: '33101', c: 'Miami, FL' },
    { z: '98101', c: 'Seattle, WA' },
  ];

  function initZip(inputId, dropId) {
    var inp = document.getElementById(inputId);
    var drop = document.getElementById(dropId);
    if (!inp || !drop) return;
    inp.addEventListener('input', function () {
      var v = this.value.trim();
      drop.innerHTML = '';
      if (v.length < 2) { drop.style.display = 'none'; return; }
      var hits = ZIPS.filter(function (z) { return z.z.startsWith(v) || z.c.toLowerCase().includes(v.toLowerCase()); }).slice(0, 4);
      if (!hits.length) { drop.style.display = 'none'; return; }
      hits.forEach(function (m) {
        var el = document.createElement('div');
        el.className = 'zip-opt';
        el.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg><span><strong>' + m.z + '</strong> — ' + m.c + '</span>';
        el.addEventListener('mousedown', function (e) { e.preventDefault(); inp.value = m.z; drop.style.display = 'none'; });
        drop.appendChild(el);
      });
      drop.style.display = 'block';
    });
    inp.addEventListener('blur', function () { setTimeout(function () { drop.style.display = 'none'; }, 160); });
  }

  initZip('heroZip',   'heroZipDrop');
  initZip('sectionZip','sectionZipDrop');
  initZip('modalZip',  'modalZipDrop');

  // ── MODAL ────────────────────────────────────────────────
  var overlay    = document.getElementById('quoteModal');
  var modalForm  = document.getElementById('mForm');
  var modalOk    = document.getElementById('mSuccess');
  var modalSvcEl = document.getElementById('mSvcLabel');

  function openModal(label) {
    if (!overlay) return;
    if (modalForm) modalForm.style.display = '';
    if (modalOk)   modalOk.style.display   = 'none';
    if (modalSvcEl && label) modalSvcEl.textContent = label + ' — Free Quote';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    var first = overlay.querySelector('input');
    if (first) setTimeout(function () { first.focus(); }, 80);
    console.log('[Orkin] modal_open', { service: label || 'general', ts: Date.now() });
  }

  function closeModal() {
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Wire every [data-modal] button/link
  document.querySelectorAll('[data-modal]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openModal(this.dataset.service || '');
    });
  });

  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  document.querySelectorAll('.modal-x, .js-close-modal').forEach(function (el) { el.addEventListener('click', closeModal); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // ── FORM SUBMIT ──────────────────────────────────────────
  function wireForm(form, onSuccess) {
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      if (btn) { btn.classList.add('loading'); btn.disabled = true; }
      var payload = {};
      new FormData(form).forEach(function (v, k) { payload[k] = v; });
      console.log('[Orkin] form_submit', payload);
      setTimeout(function () {
        if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
        form.reset();
        onSuccess();
        console.log('[Orkin] quote_submitted', { ts: Date.now() });
      }, 1500);
    });
  }

  function showSuccess() {
    openModal('');
    if (modalForm) modalForm.style.display = 'none';
    if (modalOk)   modalOk.style.display   = '';
  }

  wireForm(document.getElementById('heroForm'),    showSuccess);
  wireForm(document.getElementById('modalFormEl'), showSuccess);
  document.querySelectorAll('.mini-form').forEach(function (f) { wireForm(f, showSuccess); });

  // ── HERO ZIP SEARCH ──────────────────────────────────────
  var zipForm = document.getElementById('zipForm');
  if (zipForm) {
    zipForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = document.getElementById('sectionZip').value.trim();
      console.log('[Orkin] zip_search', { zip: v });
      openModal('');
    });
  }

  // ── PREVIEW TOAST for internal nav links ─────────────────
  var toast = document.getElementById('previewToast');
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg || 'Preview only — page not built yet';
    toast.classList.add('show');
    setTimeout(function () { toast.classList.remove('show'); }, 2200);
  }

  // Internal nav links that would 404 in preview
  document.querySelectorAll('a[href^="/"]').forEach(function (el) {
    // Exclude tel: and real modal triggers
    el.addEventListener('click', function (e) {
      e.preventDefault();
      showToast('Preview only — this page is not live yet');
    });
  });
  // Footer links with relative hrefs
  document.querySelectorAll('a[href^="http"]').forEach(function (el) {
    // Allow actual external links to work (social, etc.)
    // No-op — they should open normally
  });

  // ── MOBILE NAV ───────────────────────────────────────────
  var mmOpen  = document.getElementById('hamburger');
  var mmClose = document.getElementById('mmClose');
  var mm      = document.getElementById('mobileMenu');

  if (mmOpen && mm) mmOpen.addEventListener('click', function () { mm.classList.add('open'); document.body.style.overflow = 'hidden'; });
  if (mmClose && mm) mmClose.addEventListener('click', function () { mm.classList.remove('open'); document.body.style.overflow = ''; });

  // ── SMOOTH STAT COUNTER ──────────────────────────────────
  function animateNum(el) {
    var target = parseFloat(el.dataset.target);
    var isFloat = el.dataset.target.includes('.');
    var suffix = el.dataset.suffix || '';
    var prefix = el.dataset.prefix || '';
    var start = 0; var duration = 1200;
    var startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var pct = Math.min((ts - startTime) / duration, 1);
      var ease = 1 - Math.pow(1 - pct, 3);
      var val = start + (target - start) * ease;
      el.textContent = prefix + (isFloat ? val.toFixed(1) : Math.floor(val)) + suffix;
      if (pct < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var statEls = document.querySelectorAll('[data-target]');
    var statObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateNum(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    statEls.forEach(function (el) { statObs.observe(el); });
  }

  // ── LAZY IMAGES ─────────────────────────────────────────
  if ('IntersectionObserver' in window) {
    var lazyImgs = document.querySelectorAll('img[data-src]');
    var imgObs = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          obs.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });
    lazyImgs.forEach(function (img) { imgObs.observe(img); });
  }

})();
