// InsightProfit Enterprise Shell
// Shared cross-app navigation, workflow context, and lightweight event bridge.
// This module intentionally has no framework dependencies so it can run inside React, Next.js, and vanilla apps.

const INSIGHTPROFIT_APPS = [
  { id: 'command', name: 'Command Center', role: 'AI orchestration', url: 'https://command.insightprofit.live/', stage: 'orchestrate', group: 'Control' },
  { id: 'research', name: 'Research', role: 'market and source intelligence', url: 'https://research.insightprofit.live/', stage: 'research', group: 'Create' },
  { id: 'kb', name: 'Knowledge Base', role: 'shared operating memory', url: 'https://kb.insightprofit.live/', stage: 'memory', group: 'Control' },
  { id: 'elitewriter', name: 'Elite Writer', role: 'long-form and conversion copy', url: 'https://elitewriter.insightprofit.live/', stage: 'draft', group: 'Create' },
  { id: 'paperclip', name: 'Paperclip', role: 'projects, approvals, and execution', url: 'https://paperclip.insightprofit.live/', stage: 'package', group: 'Operate' },
  { id: 'polsia', name: 'Polsia', role: 'autonomous company operators', url: 'https://polsia.insightprofit.live/', stage: 'automate', group: 'Agents' },
  { id: 'agent-zero', name: 'Agent Zero', role: 'general-purpose agent terminal', url: 'https://agent-zero.insightprofit.live/', stage: 'execute', group: 'Agents' },
  { id: 'hermes', name: 'Hermes', role: 'messaging and outreach agent', url: 'https://hermes.insightprofit.live/', stage: 'distribute', group: 'Agents' },
  { id: 'sparky', name: 'Sparky Studio', role: 'media production and render jobs', url: 'https://sparky.insightprofit.live/', stage: 'media', group: 'Create' },
  { id: 'revenue', name: 'Revenue Engine', role: 'offers, launches, and monetization', url: 'https://revenue.insightprofit.live/', stage: 'monetize', group: 'Revenue' },
  { id: 'ops', name: 'Operations', role: 'services, tasks, and infrastructure health', url: 'https://ops.insightprofit.live/', stage: 'operate', group: 'Operate' }
];

const INSIGHTPROFIT_PIPELINE = [
  { id: 'idea', label: 'Idea intake', description: 'Capture a business idea, audience, offer hypothesis, or operational problem.', apps: ['command', 'research', 'kb'] },
  { id: 'research', label: 'Research', description: 'Gather market evidence, references, customer language, and constraints.', apps: ['research', 'kb', 'agent-zero'] },
  { id: 'draft', label: 'Content draft', description: 'Turn evidence into articles, scripts, lead magnets, SOPs, and sales assets.', apps: ['elitewriter', 'paperclip'] },
  { id: 'package', label: 'Package and approve', description: 'Move content into execution boards, approvals, tasks, and reusable assets.', apps: ['paperclip', 'sparky'] },
  { id: 'orchestrate', label: 'Agent orchestration', description: 'Dispatch work to autonomous agents and automation services.', apps: ['command', 'polsia', 'agent-zero', 'hermes'] },
  { id: 'monetize', label: 'Monetize', description: 'Build offer mechanics, launch assets, conversion stories, and revenue loops.', apps: ['revenue', 'hermes'] },
  { id: 'operate', label: 'Operate and measure', description: 'Track outcomes, infrastructure, follow-up tasks, and compound learnings.', apps: ['command', 'ops', 'kb'] }
];

const STYLE_ID = 'insightprofit-enterprise-shell-style';
const ROOT_ID = 'insightprofit-enterprise-shell';

function safeJson(value) {
  try { return JSON.stringify(value); } catch { return '{}'; }
}

function getEnv(name) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) return import.meta.env[name];
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) return process.env[name];
  } catch {}
  return undefined;
}

function getConfig() {
  return {
    supabaseUrl: getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL') || getEnv('SUPABASE_URL') || '',
    supabaseAnonKey: getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('SUPABASE_ANON_KEY') || '',
    eventsTable: getEnv('VITE_ENTERPRISE_EVENTS_TABLE') || getEnv('NEXT_PUBLIC_ENTERPRISE_EVENTS_TABLE') || 'enterprise_events',
    commandUrl: 'https://command.insightprofit.live/'
  };
}

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #e5edf5; }
    #${ROOT_ID} * { box-sizing: border-box; }
    .ipx-launcher { width: 58px; height: 58px; border-radius: 18px; border: 1px solid rgba(148,163,184,.38); color: #ecfeff; background: radial-gradient(circle at 30% 20%, rgba(45,212,191,.72), transparent 34%), linear-gradient(145deg, rgba(15,23,42,.96), rgba(8,13,28,.96)); box-shadow: 0 18px 48px rgba(2,6,23,.46), inset 0 1px 0 rgba(255,255,255,.12); display: grid; place-items: center; cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .ipx-launcher:hover { transform: translateY(-2px); border-color: rgba(45,212,191,.8); box-shadow: 0 24px 60px rgba(2,6,23,.6), 0 0 0 4px rgba(45,212,191,.09); }
    .ipx-launcher-mark { width: 28px; height: 28px; border-radius: 10px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.18); background: rgba(15,23,42,.7); font-weight: 800; letter-spacing: -.04em; font-size: 13px; }
    .ipx-panel { width: min(430px, calc(100vw - 28px)); max-height: min(720px, calc(100vh - 40px)); overflow: hidden; border-radius: 22px; border: 1px solid rgba(148,163,184,.32); background: linear-gradient(180deg, rgba(15,23,42,.97), rgba(2,6,23,.98)); box-shadow: 0 30px 90px rgba(0,0,0,.54), inset 0 1px 0 rgba(255,255,255,.08); backdrop-filter: blur(18px); display: none; }
    .ipx-open .ipx-panel { display: block; animation: ipx-rise .18s ease-out; }
    .ipx-open .ipx-launcher { display: none; }
    @keyframes ipx-rise { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .ipx-head { padding: 16px 16px 13px; border-bottom: 1px solid rgba(148,163,184,.18); display: flex; align-items: flex-start; gap: 12px; }
    .ipx-title { font-size: 14px; line-height: 1.2; font-weight: 780; letter-spacing: -.01em; color: #f8fafc; }
    .ipx-subtitle { margin-top: 3px; font-size: 11px; line-height: 1.45; color: #94a3b8; }
    .ipx-close { margin-left: auto; width: 30px; height: 30px; border-radius: 10px; border: 1px solid rgba(148,163,184,.22); background: rgba(15,23,42,.72); color: #cbd5e1; cursor: pointer; }
    .ipx-body { padding: 14px 14px 16px; overflow: auto; max-height: calc(min(720px, 100vh - 40px) - 70px); }
    .ipx-section-label { margin: 4px 2px 8px; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: .14em; font-weight: 750; }
    .ipx-app-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .ipx-app { display: block; min-height: 76px; padding: 11px 12px; border-radius: 15px; text-decoration: none; border: 1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.58); color: #e2e8f0; transition: transform .14s ease, background .14s ease, border-color .14s ease; }
    .ipx-app:hover { transform: translateY(-1px); border-color: rgba(45,212,191,.48); background: rgba(20,184,166,.12); }
    .ipx-app-active { border-color: rgba(45,212,191,.72); background: linear-gradient(135deg, rgba(20,184,166,.2), rgba(15,23,42,.72)); }
    .ipx-app-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; font-weight: 760; color: #f8fafc; }
    .ipx-app-role { margin-top: 5px; font-size: 10.5px; line-height: 1.35; color: #94a3b8; }
    .ipx-pill { font-size: 9px; color: #99f6e4; border: 1px solid rgba(45,212,191,.25); border-radius: 999px; padding: 2px 6px; white-space: nowrap; }
    .ipx-pipeline { display: grid; gap: 8px; }
    .ipx-stage { border: 1px solid rgba(148,163,184,.16); background: rgba(15,23,42,.48); border-radius: 15px; padding: 10px 11px; }
    .ipx-stage-top { display: flex; align-items: center; gap: 9px; }
    .ipx-stage-index { width: 24px; height: 24px; border-radius: 9px; display: grid; place-items: center; background: rgba(45,212,191,.13); color: #99f6e4; font-size: 11px; font-weight: 800; flex: 0 0 auto; }
    .ipx-stage-title { color: #f8fafc; font-size: 12px; font-weight: 760; }
    .ipx-stage-copy { margin: 4px 0 8px 33px; color: #94a3b8; line-height: 1.35; font-size: 10.5px; }
    .ipx-stage-links { margin-left: 33px; display: flex; gap: 6px; flex-wrap: wrap; }
    .ipx-stage-link, .ipx-action { border: 1px solid rgba(148,163,184,.18); background: rgba(2,6,23,.44); color: #cbd5e1; border-radius: 999px; padding: 5px 8px; font-size: 10.5px; text-decoration: none; cursor: pointer; }
    .ipx-stage-link:hover, .ipx-action:hover { color: #ecfeff; border-color: rgba(45,212,191,.44); }
    .ipx-actions { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ipx-action-primary { background: linear-gradient(135deg, rgba(20,184,166,.92), rgba(14,116,144,.9)); border-color: rgba(125,211,252,.35); color: white; font-weight: 780; }
    .ipx-footer { margin-top: 10px; padding: 9px 10px; border-radius: 14px; background: rgba(2,6,23,.38); border: 1px solid rgba(148,163,184,.13); color: #64748b; font-size: 10.5px; line-height: 1.4; }
  `;
  document.head.appendChild(style);
}

function createEvent(appId, type, payload) {
  return {
    id: `ipx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    source_app: appId,
    payload: payload || {},
    created_at: new Date().toISOString(),
    schema: 'insightprofit.enterprise.event.v1'
  };
}

async function publishEnterpriseEvent(event) {
  if (typeof window !== 'undefined') {
    const key = 'insightprofit.enterprise.events';
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(event);
      localStorage.setItem(key, safeJson(existing.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('insightprofit:enterprise-event', { detail: event }));
    } catch {}
  }

  const config = getConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey || typeof fetch === 'undefined') return event;
  try {
    await fetch(`${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/${config.eventsTable}`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: safeJson({ event_id: event.id, type: event.type, source_app: event.source_app, payload: event.payload, created_at: event.created_at })
    });
  } catch (error) {
    try { console.warn('[InsightProfit Enterprise] Supabase event bridge fell back to local queue', error); } catch {}
  }
  return event;
}

function urlFor(app, stageId, eventId) {
  const url = new URL(app.url);
  url.searchParams.set('ipx_stage', stageId || app.stage || 'open');
  if (eventId) url.searchParams.set('ipx_event', eventId);
  return url.toString();
}

function selectedText() {
  try { return String(window.getSelection ? window.getSelection() : '').trim().slice(0, 2000); } catch { return ''; }
}

function bootInsightProfitEnterpriseShell(options = {}) {
  if (typeof document === 'undefined' || document.getElementById(ROOT_ID)) return;
  const appId = options.appId || 'unknown';
  const currentApp = INSIGHTPROFIT_APPS.find((app) => app.id === appId) || { id: appId, name: appId, role: 'connected app', url: location.href, stage: 'open' };
  injectStyles();

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML = `
    <button class="ipx-launcher" type="button" aria-label="Open InsightProfit enterprise switcher"><span class="ipx-launcher-mark">IP</span></button>
    <section class="ipx-panel" aria-label="InsightProfit enterprise switcher">
      <div class="ipx-head">
        <div class="ipx-launcher-mark">IP</div>
        <div>
          <div class="ipx-title">Enterprise Workflow Switcher</div>
          <div class="ipx-subtitle">${currentApp.name} is connected to the shared idea to content to monetization pipeline.</div>
        </div>
        <button class="ipx-close" type="button" aria-label="Close">×</button>
      </div>
      <div class="ipx-body">
        <div class="ipx-section-label">Connected apps</div>
        <div class="ipx-app-grid">
          ${INSIGHTPROFIT_APPS.map((app) => `<a class="ipx-app ${app.id === currentApp.id ? 'ipx-app-active' : ''}" href="${app.url}" data-ipx-app="${app.id}"><div class="ipx-app-name"><span>${app.name}</span><span class="ipx-pill">${app.group}</span></div><div class="ipx-app-role">${app.role}</div></a>`).join('')}
        </div>
        <div class="ipx-section-label" style="margin-top:14px">Workflow pipeline</div>
        <div class="ipx-pipeline">
          ${INSIGHTPROFIT_PIPELINE.map((stage, index) => `<div class="ipx-stage"><div class="ipx-stage-top"><div class="ipx-stage-index">${index + 1}</div><div class="ipx-stage-title">${stage.label}</div></div><div class="ipx-stage-copy">${stage.description}</div><div class="ipx-stage-links">${stage.apps.map((appIdForStage) => { const app = INSIGHTPROFIT_APPS.find((x) => x.id === appIdForStage); return app ? `<a class="ipx-stage-link" href="${urlFor(app, stage.id)}" data-ipx-stage="${stage.id}" data-ipx-app="${app.id}">${app.name}</a>` : ''; }).join('')}</div></div>`).join('')}
        </div>
        <div class="ipx-actions">
          <button class="ipx-action ipx-action-primary" type="button" data-ipx-command="send-context">Send context to Command</button>
          <button class="ipx-action" type="button" data-ipx-command="copy-brief">Copy workflow brief</button>
        </div>
        <div class="ipx-footer">Events are written to a shared Supabase table when environment variables are present; otherwise they queue locally and remain available to Command Center via browser storage.</div>
      </div>
    </section>
  `;
  document.body.appendChild(root);

  const launcher = root.querySelector('.ipx-launcher');
  const close = root.querySelector('.ipx-close');
  launcher?.addEventListener('click', () => root.classList.add('ipx-open'));
  close?.addEventListener('click', () => root.classList.remove('ipx-open'));

  root.querySelectorAll('[data-ipx-app]').forEach((node) => {
    node.addEventListener('click', () => {
      const app = node.getAttribute('data-ipx-app');
      const stage = node.getAttribute('data-ipx-stage') || 'open_app';
      publishEnterpriseEvent(createEvent(appId, 'app_switch', { target_app: app, stage, from_url: location.href, selected_text: selectedText() }));
    });
  });

  root.querySelector('[data-ipx-command="send-context"]')?.addEventListener('click', async () => {
    const event = await publishEnterpriseEvent(createEvent(appId, 'workflow_context_sent', {
      current_app: currentApp.name,
      current_url: location.href,
      selected_text: selectedText(),
      recommended_next_stage: currentApp.stage
    }));
    window.open(`${getConfig().commandUrl}?ipx_event=${encodeURIComponent(event.id)}&ipx_source=${encodeURIComponent(appId)}#enterprise-orchestrator`, '_blank', 'noopener,noreferrer');
  });

  root.querySelector('[data-ipx-command="copy-brief"]')?.addEventListener('click', async () => {
    const brief = `InsightProfit workflow context\nApp: ${currentApp.name}\nURL: ${location.href}\nSelected text: ${selectedText() || '(none)'}\nNext stage: ${currentApp.stage}`;
    try { await navigator.clipboard.writeText(brief); root.querySelector('[data-ipx-command="copy-brief"]').textContent = 'Copied'; } catch {}
    publishEnterpriseEvent(createEvent(appId, 'workflow_brief_copied', { brief }));
  });

  window.InsightProfitEnterprise = {
    apps: INSIGHTPROFIT_APPS,
    pipeline: INSIGHTPROFIT_PIPELINE,
    currentApp,
    config: getConfig(),
    createEvent: (type, payload) => createEvent(appId, type, payload),
    publishEvent: publishEnterpriseEvent,
    open: () => root.classList.add('ipx-open'),
    close: () => root.classList.remove('ipx-open')
  };

  publishEnterpriseEvent(createEvent(appId, 'app_loaded', { url: location.href, title: document.title })).catch(() => {});
}

export { INSIGHTPROFIT_APPS, INSIGHTPROFIT_PIPELINE, bootInsightProfitEnterpriseShell, publishEnterpriseEvent };
