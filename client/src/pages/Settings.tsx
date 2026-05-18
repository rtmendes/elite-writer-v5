// Settings — Multi-LLM Configuration, News APIs, Cost Routing, Token Usage, Enterprise
// Design: Dark command center, frosted glass cards, violet accents

import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { PUBLICATIONS } from '@/lib/publications-data';
import { BRAND_VOICES } from '@/lib/templates';
import {
  loadAIConfig, saveAIConfig, getProviderStatus, getUsageSummary, syncFromServer,
  loadUsage, type LLMConfig,
} from '@/lib/ai-engine';
import {
  Settings as SettingsIcon, Key, Brain, DollarSign, Database, Download, Upload,
  Trash2, Save, CheckCircle2, XCircle, Zap, BarChart3, Shield, Globe, Cpu,
  AlertTriangle, Info,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { state, updateSettings } = useApp();
  const [aiConfig, setAiConfig] = useState<LLMConfig>(loadAIConfig);
  const [activeTab, setActiveTab] = useState<'llm' | 'news' | 'writing' | 'financial' | 'usage' | 'data'>('llm');

  const providerStatus = useMemo(() => getProviderStatus(), [aiConfig]);
  const usageSummary = useMemo(() => getUsageSummary(), []);

  // Auto-sync API keys from server env vars on mount
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (synced) return;
    const hasKeys = Object.entries(aiConfig).some(([k, v]) => k.endsWith("_key") && !!v);
    if (!hasKeys) {
      syncFromServer().then(updated => {
        if (updated) {
          setAiConfig(updated);
          toast.success("API keys loaded from server");
        }
        setSynced(true);
      });
    } else {
      setSynced(true);
    }
  }, [synced]);
  const usage = useMemo(() => loadUsage(), []);

  const [brandVoice, setBrandVoice] = useState(state.settings.brand_voice);
  const [dailyTarget, setDailyTarget] = useState(state.settings.daily_target);
  const [revenueGoal, setRevenueGoal] = useState(state.settings.monthly_revenue_goal);

  function saveAll() {
    saveAIConfig(aiConfig);
    updateSettings({ brand_voice: brandVoice, daily_target: dailyTarget, monthly_revenue_goal: revenueGoal });
    toast.success('All settings saved');
  }

  function exportData() {
    const data = { state, aiConfig: { ...aiConfig, openai_key: '***', anthropic_key: '***', openrouter_key: '***', gemini_key: '***' }, usage, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `elite-writer-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Data exported');
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.state) {
          localStorage.setItem('elite_writer_v5_state', JSON.stringify(data.state));
          toast.success('Data imported — reload to apply');
        }
      } catch { toast.error('Invalid import file'); }
    };
    input.click();
  }

  function clearData() {
    if (confirm('This will delete ALL data. Are you sure?')) {
      localStorage.removeItem('elite_writer_v5_state');
      localStorage.removeItem('elite_writer_ai_config');
      localStorage.removeItem('elite_writer_ai_usage');
      window.location.reload();
    }
  }

  const tabs = [
    { id: 'llm' as const, label: 'LLM Providers', icon: Brain },
    { id: 'news' as const, label: 'News APIs', icon: Globe },
    { id: 'writing' as const, label: 'Writing', icon: Zap },
    { id: 'financial' as const, label: 'Financial', icon: DollarSign },
    { id: 'usage' as const, label: 'Token Usage', icon: BarChart3 },
    { id: 'data' as const, label: 'Data', icon: Database },
  ];

  const tabDescriptions: Record<typeof tabs[number]['id'], { title: string; description: string }> = {
    llm: {
      title: 'Model routing and provider configuration',
      description: 'Connect providers, choose preferred fallback behavior, and tune cost-vs-quality strategy.',
    },
    news: {
      title: 'Live intelligence source setup',
      description: 'Manage external news APIs powering the research and trending pipelines.',
    },
    writing: {
      title: 'Editorial defaults',
      description: 'Set baseline voice and daily output targets for all writing workflows.',
    },
    financial: {
      title: 'Revenue planning',
      description: 'Track target revenue and translate goals into article and pitch volume.',
    },
    usage: {
      title: 'AI usage telemetry',
      description: 'Monitor token usage, provider spend, and workload distribution.',
    },
    data: {
      title: 'Data lifecycle controls',
      description: 'Inspect system footprint, export snapshots, and manage local data state.',
    },
  };

  const configuredCount = Object.values(providerStatus).filter(p => p.configured).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-primary" /> Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {configuredCount} providers configured · Cost mode: <span className="capitalize">{aiConfig.cost_mode}</span>
          </p>
        </div>
        <button onClick={saveAll} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors">
          <Save className="w-4 h-4" /> Save All
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-card rounded-lg border border-border overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card/70 p-4">
        <p className="text-sm font-medium">{tabDescriptions[activeTab].title}</p>
        <p className="text-xs text-muted-foreground mt-1">{tabDescriptions[activeTab].description}</p>
      </div>

      {/* LLM Providers Tab */}
      {activeTab === 'llm' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-violet-400" /> Cost Optimization Mode</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['minimum', 'balanced', 'quality'] as const).map(mode => (
                <button key={mode} onClick={() => setAiConfig(c => ({ ...c, cost_mode: mode }))}
                  className={`p-3 rounded-lg border text-left transition-all ${aiConfig.cost_mode === mode ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'}`}>
                  <div className="text-sm font-semibold text-white capitalize">{mode}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {mode === 'minimum' && 'Free/cheapest models for all tasks. Best for high-volume research.'}
                    {mode === 'balanced' && 'Free for summaries, standard for drafts. Best cost/quality ratio.'}
                    {mode === 'quality' && 'Premium models for drafts & edits. Best for final publication content.'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Preferred Provider</h3>
            <select value={aiConfig.preferred_provider} onChange={e => setAiConfig(c => ({ ...c, preferred_provider: e.target.value as LLMConfig['preferred_provider'] }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="auto">Auto (best for task + cost)</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openrouter">OpenRouter</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'openai_key' as const, label: 'OpenAI', desc: 'GPT-4o, GPT-4o Mini, o3-mini', placeholder: 'sk-...' },
              { key: 'anthropic_key' as const, label: 'Anthropic', desc: 'Claude Sonnet 4, Haiku, Opus 4', placeholder: 'sk-ant-...' },
              { key: 'openrouter_key' as const, label: 'OpenRouter', desc: '200+ models, free tier available', placeholder: 'sk-or-...' },
              { key: 'gemini_key' as const, label: 'Google Gemini', desc: 'Gemini 2.0 Flash (free tier)', placeholder: 'AI...' },
            ].map(provider => (
              <div key={provider.key} className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{provider.label}</h3>
                    <p className="text-xs text-zinc-500">{provider.desc}</p>
                  </div>
                  {aiConfig[provider.key] ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Active</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-zinc-500"><XCircle className="w-3 h-3" /> Not set</span>
                  )}
                </div>
                <input type="password" value={aiConfig[provider.key]} placeholder={provider.placeholder}
                  onChange={e => setAiConfig(c => ({ ...c, [provider.key]: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
              </div>
            ))}
          </div>

          <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-zinc-400">
                <p className="font-semibold text-blue-300 mb-1">Intelligent Model Routing</p>
                <p>The AI engine automatically selects the best model for each task based on your cost mode. In <strong className="text-white">Minimum</strong> mode, scoring and ideas use free Gemini Flash; drafts use GPT-4o Mini. In <strong className="text-white">Quality</strong> mode, drafts use Claude Opus 4 or o3-mini for maximum quality. OpenRouter provides access to 200+ models including free tiers.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* News APIs Tab */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-1">Live News Feeds</h3>
            <p className="text-xs text-zinc-500 mb-4">Connect news APIs to power the Intelligence Feed with real-time trending stories.</p>
            <div className="space-y-4">
              {[
                { key: 'newsapi_key' as const, label: 'NewsAPI', desc: 'newsapi.org — 100 req/day free', placeholder: 'Your NewsAPI key' },
                { key: 'gnews_key' as const, label: 'GNews', desc: 'gnews.io — 100 req/day free', placeholder: 'Your GNews key' },
                { key: 'mediastack_key' as const, label: 'MediaStack', desc: 'mediastack.com — 100 req/month free', placeholder: 'Your MediaStack key' },
              ].map(api => (
                <div key={api.key} className="flex items-center gap-4">
                  <div className="w-32 shrink-0">
                    <div className="text-sm font-medium text-white">{api.label}</div>
                    <div className="text-xs text-zinc-500">{api.desc}</div>
                  </div>
                  <input type="password" value={aiConfig[api.key]} placeholder={api.placeholder}
                    onChange={e => setAiConfig(c => ({ ...c, [api.key]: e.target.value }))}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
                  {aiConfig[api.key] ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <XCircle className="w-5 h-5 text-zinc-600 shrink-0" />}
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-zinc-400">
                <p className="font-semibold text-amber-300 mb-1">Free Tier Strategy</p>
                <p>All three news APIs offer free tiers. Use NewsAPI (100 req/day) as primary, GNews as backup, and MediaStack for international coverage. This gives you 200+ free API calls per day — enough to power a daily intelligence brief without any cost.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Writing Preferences Tab */}
      {activeTab === 'writing' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Default Brand Voice</h3>
            <select value={brandVoice} onChange={e => setBrandVoice(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
              {BRAND_VOICES.map(bv => (
                <option key={bv.id} value={bv.id}>{bv.name} — {bv.audience}</option>
              ))}
            </select>
          </div>
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Daily Idea Target</h3>
            <input type="number" value={dailyTarget} onChange={e => setDailyTarget(Number(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" min={1} max={50} />
            <p className="text-xs text-zinc-500 mt-1">Number of article ideas to generate per day</p>
          </div>
        </div>
      )}

      {/* Financial Goals Tab */}
      {activeTab === 'financial' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Monthly Revenue Goal</h3>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <input type="number" value={revenueGoal} onChange={e => setRevenueGoal(Number(e.target.value))}
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Revenue Projections</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-800/50 rounded-lg text-center">
                <div className="text-lg font-bold text-emerald-400">${Math.round(revenueGoal / 4).toLocaleString()}</div>
                <div className="text-xs text-zinc-500">Weekly Target</div>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg text-center">
                <div className="text-lg font-bold text-violet-400">{Math.ceil(revenueGoal / 750)}</div>
                <div className="text-xs text-zinc-500">Articles/Month @ $750 avg</div>
              </div>
              <div className="p-3 bg-zinc-800/50 rounded-lg text-center">
                <div className="text-lg font-bold text-amber-400">{Math.ceil(revenueGoal / 750 / 0.2)}</div>
                <div className="text-xs text-zinc-500">Pitches/Month @ 20% accept</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Token Usage Tab */}
      {activeTab === 'usage' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center">
              <div className="text-2xl font-bold text-violet-400">${usageSummary.totalCost.toFixed(4)}</div>
              <div className="text-xs text-zinc-500 mt-1">Total AI Cost</div>
            </div>
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center">
              <div className="text-2xl font-bold text-emerald-400">{usageSummary.totalTokens.toLocaleString()}</div>
              <div className="text-xs text-zinc-500 mt-1">Total Tokens</div>
            </div>
            <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center">
              <div className="text-2xl font-bold text-amber-400">{usage.length}</div>
              <div className="text-xs text-zinc-500 mt-1">API Calls</div>
            </div>
          </div>

          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Usage by Provider</h3>
            {Object.entries(usageSummary.byProvider).length === 0 ? (
              <p className="text-xs text-zinc-500">No usage recorded yet. Start using AI features to see cost tracking.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(usageSummary.byProvider).map(([provider, data]) => (
                  <div key={provider} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                    <div className="text-sm text-white capitalize">{provider}</div>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <span>{data.calls} calls</span>
                      <span>{data.tokens.toLocaleString()} tokens</span>
                      <span className="text-emerald-400">${data.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Usage by Task</h3>
            {Object.entries(usageSummary.byTask).length === 0 ? (
              <p className="text-xs text-zinc-500">No usage recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(usageSummary.byTask).map(([task, data]) => (
                  <div key={task} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded-lg">
                    <div className="text-sm text-white capitalize">{task}</div>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <span>{data.calls} calls</span>
                      <span className="text-emerald-400">${data.cost.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Data Management Tab */}
      {activeTab === 'data' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-violet-400" /> System Information</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Publications', value: PUBLICATIONS.length },
                { label: 'Ideas', value: state.ideas.length },
                { label: 'Articles', value: state.articles.length },
                { label: 'Pitches', value: state.pitches.length },
                { label: 'Research', value: state.research.length },
                { label: 'Earnings', value: state.earnings.length },
                { label: 'Feed Items', value: state.giststack.length },
                { label: 'Version', value: 'V5.1' },
              ].map(item => (
                <div key={item.label} className="p-2 bg-zinc-800/50 rounded-lg">
                  <div className="text-xs text-zinc-500">{item.label}</div>
                  <div className="text-sm font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button onClick={exportData} className="flex items-center justify-center gap-2 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-sm text-white hover:border-violet-500/50 transition-colors">
              <Download className="w-4 h-4 text-violet-400" /> Export All
            </button>
            <button onClick={importData} className="flex items-center justify-center gap-2 p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-sm text-white hover:border-violet-500/50 transition-colors">
              <Upload className="w-4 h-4 text-blue-400" /> Import Data
            </button>
            <button onClick={clearData} className="flex items-center justify-center gap-2 p-3 bg-zinc-900/60 border border-red-500/20 rounded-xl text-sm text-red-400 hover:border-red-500/50 transition-colors">
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
