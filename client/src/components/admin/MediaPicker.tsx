/**
 * MediaPicker — pick an image from the library to attach to a record
 * (Admin UX; used in the EditDrawer's Media group for articles).
 * Shows the current featured image + a "Choose from library" dialog grid.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Image as ImageIcon, X, Search } from "lucide-react";

export function MediaPicker({
  value, onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const images = trpc.library.images.list.useQuery({ search: search || undefined, limit: 100 }, { enabled: open });

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Featured image</label>
      {value ? (
        <div className="relative w-40">
          <img src={value} alt="" className="h-28 w-40 rounded-lg border object-cover" />
          <button
            className="absolute -right-2 -top-2 rounded-full border bg-background p-1 shadow"
            title="Remove" onClick={() => onChange(null)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <ImageIcon className="h-4 w-4" /> Choose from library
        </Button>
      )}
      {value && (
        <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setOpen(true)}>Change</Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Choose image</DialogTitle></DialogHeader>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {(images.data ?? []).map((img) => (
              <button key={img.id} className="overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary"
                onClick={() => { onChange(img.imageUrl); setOpen(false); }}>
                <img src={img.thumbnailUrl || img.imageUrl} alt={img.altText || img.name}
                  loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            ))}
            {images.data?.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No images. Upload some in Media Library.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
