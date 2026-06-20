/**
 * Video Scripts — VSL, TikTok/short, YouTube, explainer, and UGC ad script
 * generator (ported + expanded from the old app). Free-model generation with
 * format-specific structure; copy or hand off to the editor.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Clapperboard, Loader2, Copy, Sparkles, RotateCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const FORMAT_BLURB: Record<string, string> = {
  vsl: "Long-form sales letter — hook → mechanism → offer → guarantee → CTA",
  tiktok: "Under 30s — scroll-stopping hook → payoff → soft CTA",
  youtube: "8–12 min — cold open → value segments → retention hooks → CTA",
  explainer: "60–120s — problem → how-it-works → benefit → CTA",
  ugc: "Authentic creator ad — skeptic-to-convert arc with shot direction",
};

export default function VideoScripts() {
  const formats = trpc.videoScripts.formats.useQuery();
  const generate = trpc.videoScripts.generate.useMutation();
  const [format, setFormat] = useState<string>("vsl");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [script, setScript] = useState("");

  const run = async () => {
    if (!topic.trim()) return;
    try {
      const r = await generate.mutateAsync({ format: format as any, topic: topic.trim(), audience: audience.trim() || undefined, offer: offer.trim() || undefined });
      setScript(r.script);
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-[1100px] mx-auto">
      <div className="flex items-center gap-2">
        <Clapperboard className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white">Video Scripts</h1>
        <span className="text-sm text-zinc-500">VSL · short-form · YouTube · explainer · UGC</span>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {formats.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[34px] w-20 rounded-lg bg-zinc-800/60" />
            ))
          ) : formats.isError ? (
            <button onClick={() => formats.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white text-sm">
              <RotateCw className="w-3.5 h-3.5" /> Couldn't load formats — retry
            </button>
          ) : (
            (formats.data ?? []).map((f: any) => (
              <button key={f.id} onClick={() => setFormat(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${format === f.id ? "bg-violet-600 border-violet-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"}`}>
                {f.label}
              </button>
            ))
          )}
        </div>
        <p className="text-xs text-zinc-600">{FORMAT_BLURB[format]}</p>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Topic / angle (required) — e.g. 'AI marketing dept for SMB owners'"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
        <div className="flex flex-col md:flex-row gap-2">
          <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Audience (optional)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
          <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Offer to drive to (optional)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600" />
        </div>
        <button onClick={run} disabled={generate.isPending || !topic.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-50">
          {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Generate script
        </button>
      </div>

      {generate.isPending && <div className="h-40 animate-pulse rounded-xl bg-zinc-800/60" />}

      {script && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Script</span>
            <button onClick={() => { navigator.clipboard.writeText(script); toast.success("Copied"); }}
              className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"><Copy className="w-3.5 h-3.5" /> Copy</button>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-zinc-200 leading-relaxed font-sans">{script}</pre>
        </div>
      )}
    </div>
  );
}
