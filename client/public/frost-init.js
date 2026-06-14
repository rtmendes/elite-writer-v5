/* frost-init.js — InsightProfit OS v5 paste sanitizer + theme runtime */
(function () {
  'use strict';
  if (window.__frostInitDone) return;
  window.__frostInitDone = true;

  /* ── 1. PASTE SANITIZATION ── */
  function stripHTML(html) {
    const doc = (new DOMParser()).parseFromString(html, 'text/html');
    doc.body.querySelectorAll('[style],[color],[bgcolor],[text],[class]').forEach(el => {
      el.removeAttribute('style');
      el.removeAttribute('color');
      el.removeAttribute('bgcolor');
      el.removeAttribute('text');
      el.removeAttribute('class');
    });
    doc.body.querySelectorAll('span,font').forEach(el => {
      const p = el.parentNode;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
    });
    return doc.body.textContent || '';
  }

  function sanitizePaste(e) {
    const cd = e.clipboardData || window.clipboardData;
    if (!cd) return;
    let text = cd.getData('text/plain');
    if (!text) {
      const html = cd.getData('text/html');
      if (html) text = stripHTML(html);
    }
    if (!text) return;
    e.preventDefault();
    const target = e.target;
    if (target.isContentEditable) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount) {
        sel.deleteFromDocument();
        const node = document.createTextNode(text);
        sel.getRangeAt(0).insertNode(node);
        sel.collapseToEnd();
      }
    } else if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const s = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      target.value = target.value.substring(0, s) + text + target.value.substring(end);
      target.selectionStart = target.selectionEnd = s + text.length;
    }
    target.classList.add('fm-paste-flash');
    setTimeout(() => target.classList.remove('fm-paste-flash'), 400);
  }

  document.addEventListener('paste', sanitizePaste, true);

  /* ── 2. ACTIVE NAV SYNC (hash + pathname) ── */
  function syncActiveNav() {
    const path = location.pathname.replace(/^\//, '').split('/')[0] || 'home';
    document.querySelectorAll('[data-sidebar="menu-button"]').forEach(btn => {
      const href = (btn.getAttribute('href') || btn.dataset.page || '').replace(/^\//, '').split('/')[0];
      const match = !!href && (href === path || path.startsWith(href + '/'));
      btn.setAttribute('data-active', match ? 'true' : 'false');
    });
  }

  function hookHistory() {
    const _push = history.pushState.bind(history);
    const _replace = history.replaceState.bind(history);
    history.pushState = function (...a) { _push(...a); syncActiveNav(); };
    history.replaceState = function (...a) { _replace(...a); syncActiveNav(); };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { syncActiveNav(); hookHistory(); });
  } else {
    syncActiveNav();
    hookHistory();
  }
  window.addEventListener('popstate', syncActiveNav);

  /* ── 3. TOAST ── */
  window.frostToast = function (msg, duration) {
    duration = duration || 2800;
    let tc = document.querySelector('.frost-toast-container');
    if (!tc) {
      tc = document.createElement('div');
      tc.className = 'frost-toast-container';
      tc.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
      document.body.appendChild(tc);
    }
    const el = document.createElement('div');
    el.className = 'frost-toast';
    el.style.cssText = 'background:var(--fm-navy,#0F172A);color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(15,23,42,.25);opacity:0;transform:translateY(8px);transition:opacity .2s,transform .2s;pointer-events:all';
    el.textContent = msg;
    tc.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }));
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  };
})();
