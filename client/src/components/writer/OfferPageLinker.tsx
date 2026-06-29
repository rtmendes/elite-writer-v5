import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";

interface Props {
  articleId: number | null | undefined;
}

export function OfferPageLinker({ articleId }: Props) {
  const [copied, setCopied] = useState<number | null>(null);

  const { data: products, isLoading } = trpc.productCreation.listByArticle.useQuery(
    { articleId: articleId! },
    { enabled: !!articleId }
  );

  if (!articleId) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        Save the article first, then generate a product to get an offer page link.
      </p>
    );
  }

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!products || products.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        No products yet for this article. Use the Products tab to generate one.
      </p>
    );
  }

  const copyLink = (id: number) => {
    const url = `${window.location.origin}/offer/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      toast.success("Link copied");
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <div className="space-y-2">
      {products.map((p) => {
        const url = `/offer/${p.id}`;
        const full = `${window.location.origin}${url}`;
        return (
          <div key={p.id} className="rounded-md border border-border bg-muted/30 p-2.5 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium truncate">{p.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className="text-[9px] py-0 h-4">{p.type}</Badge>
                  {p.price && (
                    <span className="text-[10px] text-muted-foreground">${Number(p.price).toFixed(2)}</span>
                  )}
                  <Badge
                    variant={p.status === "active" ? "default" : "secondary"}
                    className="text-[9px] py-0 h-4"
                  >
                    {p.status ?? "draft"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <code className="text-[9px] text-muted-foreground truncate flex-1 bg-background/50 px-1.5 py-0.5 rounded">
                {full}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => copyLink(p.id)}
                title="Copy link"
              >
                {copied === p.id ? (
                  <Globe className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => window.open(url, "_blank")}
                title="Open offer page"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
