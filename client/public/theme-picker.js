/* theme-picker.js — InsightProfit OS v5 floating theme switcher */
(function () {
  'use strict';
  if (window.__themePicker) return;
  window.__themePicker = true;

  var STORAGE_KEY = 'ip-theme';

  var THEMES = [
    { id: 'dark',  label: 'Dark OS',       dot: '#1a1a2e', ring: '#4361ee' },
    { id: 'light', label: 'Light',         dot: '#f4f5f9', ring: '#d0d3e8' },
    { id: 'frost', label: 'Frost Minimal', dot: '#F6F7F9', ring: '#E8EBF0' },
  ];

  function getTheme() {
    var s = localStorage.getItem(STORAGE_KEY);
    if (s === 'dark' || s === 'light' || s === 'frost') return s;
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light') return 'light';
    if (attr === 'frost') return 'frost';
    return 'dark';
  }

  function applyTheme(id) {
    var html = document.documentElement;

    // Remove frost link
    var link = document.getElementById('frost-css');
    if (link) link.remove();

    // Remove frost init
    var fi = document.getElementById('frost-init-js');
    if (fi) fi.remove();

    if (id === 'frost') {
      html.setAttribute('data-theme', 'frost');
      var l = document.createElement('link');
      l.id = 'frost-css'; l.rel = 'stylesheet'; l.href = '/frost.css';
      document.head.appendChild(l);
      if (!document.getElementById('frost-init-js')) {
        var s = document.createElement('script');
        s.id = 'frost-init-js'; s.src = '/frost-init.js';
        document.head.appendChild(s);
      }
    } else if (id === 'light') {
      html.setAttribute('data-theme', 'light');
    } else {
      html.removeAttribute('data-theme');
    }

    localStorage.setItem(STORAGE_KEY, id);
  }

  function buildPicker() {
    var current = getTheme();

    // Wrapper
    var wrap = document.createElement('div');
    wrap.id = 'ip-theme-picker';
    wrap.style.cssText = [
      'position:fixed',
      'bottom:18px',
      'right:18px',
      'z-index:99999',
      'display:flex',
      'flex-direction:column',
      'align-items:flex-end',
      'gap:6px',
      'font-family:system-ui,-apple-system,sans-serif',
    ].join(';');

    // Dropdown
    var drop = document.createElement('div');
    drop.id = 'ip-theme-drop';
    drop.style.cssText = [
      'background:var(--bg-card,#232342)',
      'border:1px solid var(--border,#3a3a5c)',
      'border-radius:10px',
      'padding:4px',
      'box-shadow:0 8px 28px rgba(0,0,0,.35)',
      'display:none',
      'flex-direction:column',
      'gap:2px',
      'min-width:170px',
    ].join(';');

    THEMES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.dataset.themeId = t.id;
      btn.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:9px',
        'width:100%',
        'padding:8px 10px',
        'border:none',
        'border-radius:7px',
        'background:' + (t.id === current ? 'rgba(255,255,255,.09)' : 'transparent'),
        'color:var(--ink,#f5f5f7)',
        'font-size:13px',
        'font-weight:500',
        'cursor:pointer',
        'text-align:left',
      ].join(';');

      var dot = document.createElement('span');
      dot.style.cssText = [
        'width:14px',
        'height:14px',
        'border-radius:50%',
        'background:' + t.dot,
        'border:2px solid ' + t.ring,
        'flex-shrink:0',
      ].join(';');

      var label = document.createElement('span');
      label.textContent = t.label;

      if (t.id === current) {
        var check = document.createElement('span');
        check.textContent = '✓';
        check.style.cssText = 'margin-left:auto;opacity:.7;font-size:11px';
        btn.appendChild(dot);
        btn.appendChild(label);
        btn.appendChild(check);
      } else {
        btn.appendChild(dot);
        btn.appendChild(label);
      }

      btn.addEventListener('click', function () {
        applyTheme(t.id);
        // Re-render picker with new selection
        var old = document.getElementById('ip-theme-picker');
        if (old) old.remove();
        window.__themePicker = false;
        buildPicker();
        document.getElementById('ip-theme-drop').style.display = 'flex';
        document.getElementById('ip-theme-drop').style.flexDirection = 'column';
      });

      drop.appendChild(btn);
    });

    // Toggle button
    var togInfo = THEMES.find(function (t) { return t.id === current; });
    var tog = document.createElement('button');
    tog.setAttribute('title', 'Switch theme');
    tog.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:7px',
      'padding:6px 12px',
      'border-radius:8px',
      'border:1px solid var(--border,#3a3a5c)',
      'background:var(--bg-card,#232342)',
      'color:var(--ink,#f5f5f7)',
      'font-size:12px',
      'font-weight:500',
      'cursor:pointer',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)',
      'white-space:nowrap',
    ].join(';');

    var tdot = document.createElement('span');
    tdot.style.cssText = [
      'width:10px',
      'height:10px',
      'border-radius:50%',
      'background:' + togInfo.dot,
      'border:1.5px solid ' + togInfo.ring,
      'flex-shrink:0',
    ].join(';');

    var tlabel = document.createElement('span');
    tlabel.textContent = togInfo.label;

    var chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('width', '10'); chevron.setAttribute('height', '10');
    chevron.setAttribute('viewBox', '0 0 10 10'); chevron.setAttribute('fill', 'none');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M2 7L5 4L8 7');
    path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    chevron.appendChild(path);

    tog.appendChild(tdot); tog.appendChild(tlabel); tog.appendChild(chevron);

    var open = false;
    tog.addEventListener('click', function (e) {
      e.stopPropagation();
      open = !open;
      drop.style.display = open ? 'flex' : 'none';
      if (open) drop.style.flexDirection = 'column';
      // flip chevron
      path.setAttribute('d', open ? 'M2 7L5 4L8 7' : 'M2 4L5 7L8 4');
    });

    document.addEventListener('click', function () {
      if (open) {
        open = false;
        drop.style.display = 'none';
        path.setAttribute('d', 'M2 4L5 7L8 4');
      }
    });

    wrap.appendChild(drop);
    wrap.appendChild(tog);
    document.body.appendChild(wrap);
  }

  // Mount after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPicker);
  } else {
    // Small delay to let React mount first (avoids mount-order conflicts)
    setTimeout(buildPicker, 300);
  }
})();
