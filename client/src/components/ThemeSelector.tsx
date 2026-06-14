import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'frost';

const STORAGE_KEY = 'ip-theme';

const THEMES: { id: Theme; label: string; bg: string; border: string }[] = [
  { id: 'dark',  label: 'Dark OS',       bg: '#1a1a2e', border: '#4361ee' },
  { id: 'light', label: 'Light',         bg: '#f4f5f9', border: '#d0d3e8' },
  { id: 'frost', label: 'Frost Minimal', bg: '#F6F7F9', border: '#E8EBF0' },
];

function applyTheme(theme: Theme) {
  const html = document.documentElement;

  // Inject or remove frost stylesheet
  let frostLink = document.getElementById('frost-css') as HTMLLinkElement | null;
  if (theme === 'frost') {
    if (!frostLink) {
      frostLink = document.createElement('link');
      frostLink.id = 'frost-css';
      frostLink.rel = 'stylesheet';
      frostLink.href = '/frost.css';
      document.head.appendChild(frostLink);
    }
    // Inject paste sanitizer once
    if (!document.getElementById('frost-init-js')) {
      const s = document.createElement('script');
      s.id = 'frost-init-js';
      s.src = '/frost-init.js';
      document.head.appendChild(s);
    }
  } else {
    frostLink?.remove();
  }

  // Set data-theme attribute
  if (theme === 'dark') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', theme);
  }

  localStorage.setItem(STORAGE_KEY, theme);
}

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  if (stored && ['dark', 'light', 'frost'].includes(stored)) return stored;
  // Infer from current DOM
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light') return 'light';
  if (attr === 'frost') return 'frost';
  return 'dark';
}

export function ThemeSelector() {
  const [current, setCurrent] = useState<Theme>('dark');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = readStoredTheme();
    setCurrent(t);
    applyTheme(t);
  }, []);

  function select(theme: Theme) {
    setCurrent(theme);
    applyTheme(theme);
    setOpen(false);
  }

  const active = THEMES.find(t => t.id === current)!;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Switch theme"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 10px',
          borderRadius: '6px',
          border: '1px solid var(--border, #3a3a5c)',
          background: 'var(--bg-card, #232342)',
          color: 'var(--ink, #f5f5f7)',
          fontSize: '12px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'background .12s',
        }}
      >
        <span
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: active.bg,
            border: `2px solid ${active.border}`,
            flexShrink: 0,
          }}
        />
        {active.label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: .6 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              zIndex: 999,
              background: 'var(--bg-card, #232342)',
              border: '1px solid var(--border, #3a3a5c)',
              borderRadius: '8px',
              padding: '4px',
              minWidth: '160px',
              boxShadow: '0 8px 24px rgba(0,0,0,.25)',
            }}
          >
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '7px 10px',
                  border: 'none',
                  borderRadius: '6px',
                  background: t.id === current ? 'var(--bg-hover, rgba(255,255,255,.07))' : 'transparent',
                  color: 'var(--ink, #f5f5f7)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background .1s',
                }}
              >
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: t.bg,
                    border: `2px solid ${t.border}`,
                    flexShrink: 0,
                  }}
                />
                {t.label}
                {t.id === current && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 'auto', opacity: .8 }}>
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
