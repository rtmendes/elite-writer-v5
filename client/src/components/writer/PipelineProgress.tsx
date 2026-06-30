import React from 'react';
import { cn } from '@/lib/utils';
import {
  Search, FileText, PenLine, Image, Wand2, BarChart3, Package, Target,
  CheckCircle2, Circle, Loader2,
} from 'lucide-react';

// ── Stage definitions ─────────────────────────────────────────────────────────

export type PipelineStageId =
  | 'topic'
  | 'research'
  | 'brief'
  | 'draft'
  | 'illustrate'
  | 'enhance'
  | 'score'
  | 'package';

export type StageStatus = 'pending' | 'active' | 'done' | 'skipped';

export interface PipelineStageState {
  id: PipelineStageId;
  status: StageStatus;
  subStep?: string; // current sub-step label, e.g. "Researching sources…"
}

const STAGE_META: Record<PipelineStageId, { label: string; icon: React.ElementType; durationHint: number }> = {
  topic:      { label: 'Topic & Angle',  icon: Target,    durationHint: 0 },
  research:   { label: 'Research',       icon: Search,    durationHint: 30 },
  brief:      { label: 'Brief / Outline',icon: FileText,  durationHint: 15 },
  draft:      { label: 'Draft',          icon: PenLine,   durationHint: 45 },
  illustrate: { label: 'Illustrate',     icon: Image,     durationHint: 20 },
  enhance:    { label: 'Enhance',        icon: Wand2,     durationHint: 10 },
  score:      { label: 'Score',          icon: BarChart3, durationHint: 10 },
  package:    { label: 'Package',        icon: Package,   durationHint: 10 },
};

export const INITIAL_STAGES: PipelineStageState[] = (
  Object.keys(STAGE_META) as PipelineStageId[]
).map((id) => ({ id, status: 'pending' as StageStatus }));

// ── Overall % helper ──────────────────────────────────────────────────────────

function calcPercent(stages: PipelineStageState[]): number {
  const done   = stages.filter((s) => s.status === 'done').length;
  const active = stages.find((s) => s.status === 'active');
  if (!active) return done === 0 ? 0 : Math.round((done / stages.length) * 100);
  const activeIdx = stages.findIndex((s) => s.id === active.id);
  // Treat active stage as ~50% through
  return Math.round(((activeIdx + 0.5) / stages.length) * 100);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  stages: PipelineStageState[];
  /** If false, the bar is hidden (no pipeline in progress and never ran) */
  visible: boolean;
  className?: string;
}

export function PipelineProgress({ stages, visible, className }: Props) {
  if (!visible) return null;

  const pct = calcPercent(stages);
  const activeStage = stages.find((s) => s.status === 'active');

  return (
    <div
      className={cn(
        'border-b border-border bg-background/95 backdrop-blur-sm px-4 py-2 shrink-0',
        className
      )}
    >
      {/* Top row: label + percent */}
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {activeStage ? (
            <Loader2 className="w-3 h-3 text-emerald-400 animate-spin shrink-0" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
          )}
          <span className="text-[11px] font-medium text-muted-foreground truncate">
            {activeStage
              ? (activeStage.subStep || `${STAGE_META[activeStage.id].label}…`)
              : pct === 100
              ? 'Pipeline complete'
              : 'Pipeline ready'}
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stage chips */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {stages.map((stage) => {
          const meta = STAGE_META[stage.id];
          const Icon = meta.icon;
          return (
            <div
              key={stage.id}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap shrink-0 transition-colors',
                stage.status === 'done'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : stage.status === 'active'
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/35'
                  : stage.status === 'skipped'
                  ? 'bg-muted/30 text-muted-foreground/40 border border-border/30'
                  : 'bg-muted/40 text-muted-foreground/60 border border-border/40'
              )}
            >
              {stage.status === 'done' ? (
                <CheckCircle2 className="w-2.5 h-2.5" />
              ) : stage.status === 'active' ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin" />
              ) : (
                <Circle className="w-2.5 h-2.5" />
              )}
              <Icon className="w-2.5 h-2.5" />
              {meta.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── State machine helpers (call from Writer.tsx) ───────────────────────────────

export function stageActivate(
  stages: PipelineStageState[],
  id: PipelineStageId,
  subStep?: string
): PipelineStageState[] {
  return stages.map((s) =>
    s.id === id
      ? { ...s, status: 'active', subStep }
      : s.status === 'active'
      ? { ...s, status: 'done', subStep: undefined }
      : s
  );
}

export function stageDone(stages: PipelineStageState[], id: PipelineStageId): PipelineStageState[] {
  return stages.map((s) =>
    s.id === id ? { ...s, status: 'done', subStep: undefined } : s
  );
}

export function stageReset(stages: PipelineStageState[]): PipelineStageState[] {
  return stages.map((s) => ({ ...s, status: 'pending', subStep: undefined }));
}

export function stageAllDone(stages: PipelineStageState[]): PipelineStageState[] {
  return stages.map((s) =>
    s.status === 'pending' || s.status === 'active'
      ? { ...s, status: s.id === 'illustrate' || s.id === 'package' ? 'skipped' : 'done', subStep: undefined }
      : s
  );
}
