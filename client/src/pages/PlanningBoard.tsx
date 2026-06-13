/**
 * Planning Board — draggable org / data-flow map of businesses & departments
 * (ported from the old app). Add nodes, drag to position, connect with arrows,
 * recolor, rename, delete. Persisted to userSettings.planning_board.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Network, Plus, Link2, Trash2, Save } from "lucide-react";

interface Node { id: string; label: string; x: number; y: number; color: string }
interface Edge { from: string; to: string }
interface Board { nodes: Node[]; edges: Edge[] }

const COLORS = ["#7f77dd", "#1d9e75", "#d85a30", "#378add", "#ba7517", "#d4537e"];
const uid = () => Math.random().toString(36).slice(2, 9);

export default function PlanningBoard() {
  const settings = trpc.data.settings.get.useQuery();
  const update = trpc.data.settings.upsert.useMutation();

  const [board, setBoard] = useState<Board>({ nodes: [], edges: [] });
  const [loaded, setLoaded] = useState(false);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings.data && !loaded) {
      const b = (settings.data as any)?.planning_board;
      if (b?.nodes) setBoard(b);
      setLoaded(true);
    }
  }, [settings.data, loaded]);

  const persist = useCallback(async (b: Board) => {
    await update.mutateAsync({ settings: { planning_board: b } as any });
    setDirty(false);
    toast.success("Board saved");
  }, [update]);

  const mutate = (next: Board) => { setBoard(next); setDirty(true); };

  const addNode = () => {
    const n: Node = { id: uid(), label: "New node", x: 60 + board.nodes.length * 24 % 400, y: 80 + (board.nodes.length * 40) % 300, color: COLORS[board.nodes.length % COLORS.length] };
    mutate({ ...board, nodes: [...board.nodes, n] });
  };
  const delNode = (id: string) => mutate({ nodes: board.nodes.filter((n) => n.id !== id), edges: board.edges.filter((e) => e.from !== id && e.to !== id) });
  const rename = (id: string, label: string) => mutate({ ...board, nodes: board.nodes.map((n) => n.id === id ? { ...n, label } : n) });
  const recolor = (id: string) => mutate({ ...board, nodes: board.nodes.map((n) => n.id === id ? { ...n, color: COLORS[(COLORS.indexOf(n.color) + 1) % COLORS.length] } : n) });

  const onConnect = (id: string) => {
    if (!connectFrom) { setConnectFrom(id); return; }
    if (connectFrom === id) { setConnectFrom(null); return; }
    if (!board.edges.some((e) => e.from === connectFrom && e.to === id)) {
      mutate({ ...board, edges: [...board.edges, { from: connectFrom, to: id }] });
    }
    setConnectFrom(null);
  };

  const onPointerDown = (e: React.PointerEvent, n: Node) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    dragRef.current = { id: n.id, dx: e.clientX - rect.left - n.x, dy: e.clientY - rect.top - n.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left - dragRef.current.dx);
    const y = Math.max(0, e.clientY - rect.top - dragRef.current.dy);
    setBoard((b) => ({ ...b, nodes: b.nodes.map((nd) => nd.id === dragRef.current!.id ? { ...nd, x, y } : nd) }));
    setDirty(true);
  };
  const onPointerUp = () => { dragRef.current = null; };

  const nodeById = (id: string) => board.nodes.find((n) => n.id === id);

  return (
    <div className="p-4 max-w-[1300px] mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Network className="w-5 h-5 text-violet-400" />
        <h1 className="text-xl font-bold text-white">Planning Board</h1>
        <span className="text-sm text-zinc-500">map businesses, departments & data flows</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={addNode} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm"><Plus className="w-4 h-4" /> Node</button>
          <button onClick={() => persist(board)} disabled={!dirty || update.isPending} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm disabled:opacity-50"><Save className="w-4 h-4" /> {dirty ? "Save" : "Saved"}</button>
        </div>
      </div>
      {connectFrom && <div className="mb-2 text-xs text-violet-300">Connect mode — click a target node to draw an arrow, or click the same node to cancel.</div>}

      <div ref={canvasRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
        className="relative rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden" style={{ height: 560, touchAction: "none" }}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#888780" /></marker></defs>
          {board.edges.map((e, i) => {
            const a = nodeById(e.from), b = nodeById(e.to);
            if (!a || !b) return null;
            return <line key={i} x1={a.x + 70} y1={a.y + 22} x2={b.x + 70} y2={b.y + 22} stroke="#888780" strokeWidth={1.5} markerEnd="url(#arrow)" />;
          })}
        </svg>
        {board.nodes.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-600">Empty board — add a node to start mapping.</div>}
        {board.nodes.map((n) => (
          <div key={n.id} onPointerDown={(e) => onPointerDown(e, n)}
            className="absolute select-none rounded-lg border px-3 py-2 cursor-move" style={{ left: n.x, top: n.y, width: 140, background: n.color + "22", borderColor: n.color }}>
            <input value={n.label} onChange={(e) => rename(n.id, e.target.value)} onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-transparent text-sm text-white outline-none mb-1" />
            <div className="flex items-center gap-1.5">
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => onConnect(n.id)} title="Connect" className={`p-1 rounded ${connectFrom === n.id ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white"}`}><Link2 className="w-3 h-3" /></button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => recolor(n.id)} title="Recolor" className="p-1 rounded text-zinc-400 hover:text-white"><span className="block w-3 h-3 rounded-full" style={{ background: n.color }} /></button>
              <button onPointerDown={(e) => e.stopPropagation()} onClick={() => delNode(n.id)} title="Delete" className="p-1 rounded text-red-400 hover:text-red-300 ml-auto"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-600">Drag nodes to position · click the link icon then another node to connect · click the dot to recolor · changes persist when you hit Save.</p>
    </div>
  );
}
