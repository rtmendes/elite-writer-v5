/**
 * Research Share — P3a
 * Public-facing share view for a research item/folder/project via share token.
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Loader2, BookOpen } from "lucide-react";

export default function ResearchShare() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const q = trpc.researchLibrary.shares.resolve.useQuery({ token }, { enabled: !!token });

  if (q.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] text-slate-100">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!q.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f1a] text-slate-100 gap-3">
        <BookOpen className="w-10 h-10 text-slate-600" />
        <p className="text-sm text-slate-400">Share link not found or revoked.</p>
      </div>
    );
  }

  const { share, item, folder, project } = q.data as any;

  if (share.ownerType === "item" && item) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-slate-100 p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-xs text-amber-400 font-medium uppercase tracking-widest">
          <BookOpen className="w-4 h-4" /> Research Item
        </div>
        <h1 className="font-serif text-2xl font-semibold mb-3">{item.title}</h1>
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-sm text-amber-400 hover:underline mb-4">
            <ExternalLink className="w-3.5 h-3.5" />
            {item.url}
          </a>
        )}
        {item.authors?.length > 0 && (
          <p className="text-xs text-slate-400 mb-1">Authors: {(item.authors as string[]).join(", ")}</p>
        )}
        {item.year && <p className="text-xs text-slate-400 mb-1">Year: {item.year}</p>}
        {item.publication && <p className="text-xs text-slate-400 mb-1">Source: {item.publication}</p>}
        {item.abstract && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Abstract</p>
            <p className="text-sm text-slate-400 leading-relaxed">{item.abstract}</p>
          </div>
        )}
        {item.notes && (
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Notes</p>
            <p className="text-sm text-slate-400 leading-relaxed">{item.notes}</p>
          </div>
        )}
      </div>
    );
  }

  if (share.ownerType === "folder" && folder) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-slate-100 p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-xs text-amber-400 font-medium uppercase tracking-widest">
          <BookOpen className="w-4 h-4" /> Research Folder
        </div>
        <h1 className="font-serif text-2xl font-semibold">{folder.name}</h1>
      </div>
    );
  }

  if (share.ownerType === "project" && project) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-slate-100 p-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-xs text-amber-400 font-medium uppercase tracking-widest">
          <BookOpen className="w-4 h-4" /> Research Project
        </div>
        <h1 className="font-serif text-2xl font-semibold">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">{project.description}</p>
        )}
      </div>
    );
  }

  return null;
}
