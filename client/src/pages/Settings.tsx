import { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon, Key, Target, DollarSign,
  Palette, Database, Download, Upload, Trash2, Info
} from 'lucide-react';
import { BRAND_VOICES } from '@/lib/templates';
import { PUBLICATIONS } from '@/lib/publications-data';

export default function Settings() {
  const { state, updateSettings } = useApp();
  const [apiKey, setApiKey] = useState(state.settings.openai_key);
  const [dailyTarget, setDailyTarget] = useState(state.settings.daily_target.toString());
  const [monthlyGoal, setMonthlyGoal] = useState(state.settings.monthly_revenue_goal.toString());
  const [brandVoice, setBrandVoice] = useState(state.settings.brand_voice);

  const handleSave = () => {
    updateSettings({
      openai_key: apiKey,
      daily_target: parseInt(dailyTarget) || 10,
      monthly_revenue_goal: parseInt(monthlyGoal) || 100000,
      brand_voice: brandVoice,
    });
    toast.success('Settings saved');
  };

  const handleExportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elite-writer-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            localStorage.setItem('elite_writer_v5_state', JSON.stringify(data));
            toast.success('Data imported — refreshing...');
            setTimeout(() => window.location.reload(), 1000);
          } catch {
            toast.error('Invalid JSON file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleClearData = () => {
    if (confirm('Are you sure? This will delete all your data.')) {
      localStorage.removeItem('elite_writer_v5_state');
      toast.success('Data cleared — refreshing...');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-muted-foreground" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your Elite Writer workspace
        </p>
      </div>

      {/* API Configuration */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            API Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">OpenAI API Key</label>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..." />
            <p className="text-xs text-muted-foreground mt-1">
              Used for AI-powered scoring, research assistance, and content generation. Your key is stored locally only.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Writing Preferences */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Writing Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Default Brand Voice</label>
            <select value={brandVoice} onChange={e => setBrandVoice(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
              {BRAND_VOICES.map(b => (
                <option key={b.id} value={b.name}>{b.name} — {b.audience}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Daily Idea Target</label>
            <Input type="number" value={dailyTarget} onChange={e => setDailyTarget(e.target.value)}
              placeholder="10" />
            <p className="text-xs text-muted-foreground mt-1">Number of article ideas to generate per day</p>
          </div>
        </CardContent>
      </Card>

      {/* Financial Goals */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Financial Goals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Monthly Revenue Goal ($)</label>
            <Input type="number" value={monthlyGoal} onChange={e => setMonthlyGoal(e.target.value)}
              placeholder="100000" />
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Publications in database</span>
            <Badge variant="outline" className="font-mono">{PUBLICATIONS.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total ideas</span>
            <Badge variant="outline" className="font-mono">{state.ideas.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total articles</span>
            <Badge variant="outline" className="font-mono">{state.articles.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total pitches</span>
            <Badge variant="outline" className="font-mono">{state.pitches.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Research notes</span>
            <Badge variant="outline" className="font-mono">{state.research.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Earnings recorded</span>
            <Badge variant="outline" className="font-mono">{state.earnings.length}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <Badge variant="outline" className="font-mono">V5.0</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 gap-2 text-xs" onClick={handleExportData}>
              <Download className="w-3.5 h-3.5" /> Export All Data
            </Button>
            <Button variant="outline" className="flex-1 gap-2 text-xs" onClick={handleImportData}>
              <Upload className="w-3.5 h-3.5" /> Import Data
            </Button>
          </div>
          <Button variant="destructive" className="w-full gap-2 text-xs" onClick={handleClearData}>
            <Trash2 className="w-3.5 h-3.5" /> Clear All Data
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} className="w-full">Save Settings</Button>
    </div>
  );
}
