/**
 * Public sales page — no auth required.
 * Route: /offer/:id
 *
 * Shows product details and a Stripe Checkout "Buy Now" button.
 * Accessible to anyone with the link.
 */
import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShoppingCart, CheckCircle2, AlertCircle } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ebook: "eBook",
  course: "Online Course",
  lead_magnet: "Free Resource",
  checklist: "Checklist",
  template: "Template",
  worksheet: "Worksheet",
  swipe_file: "Swipe File",
  toolkit: "Toolkit",
  cheat_sheet: "Cheat Sheet",
};

export default function OfferPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);

  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: offer, isLoading, error } = trpc.stripe.getOffer.useQuery(
    { productId },
    { enabled: !isNaN(productId), retry: false }
  );

  const createSession = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      setBuyError(err.message);
      setBuying(false);
    },
  });

  const handleBuy = async () => {
    if (!offer) return;
    setBuying(true);
    setBuyError(null);
    const base = window.location.origin;
    createSession.mutate({
      productId: offer.id,
      successUrl: `${base}/offer/${offer.id}?purchased=1`,
      cancelUrl: `${base}/offer/${offer.id}`,
    });
  };

  // Success state (returned from Stripe redirect)
  const urlParams = new URLSearchParams(window.location.search);
  const purchased = urlParams.get("purchased") === "1" || success;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Offer not found</p>
          <p className="text-sm text-slate-500">This offer may have been removed or is no longer available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header strip */}
      <div className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-medium">
          Elite Writer
        </p>
      </div>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-8">

          {purchased ? (
            <div className="text-center space-y-4 py-16">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h1 className="text-2xl font-serif font-semibold text-slate-900 dark:text-slate-100">
                Thank you for your purchase!
              </h1>
              <p className="text-slate-500">
                You'll receive access details via email shortly.
              </p>
            </div>
          ) : (
            <>
              {/* Badge */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                  {TYPE_LABELS[offer.type ?? ""] ?? offer.type ?? "Offer"}
                </Badge>
                {offer.status === "draft" && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    Preview — not published
                  </Badge>
                )}
              </div>

              {/* Headline */}
              <div className="space-y-4">
                <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {offer.name}
                </h1>

                {offer.description && (
                  <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed whitespace-pre-wrap">
                    {offer.description}
                  </p>
                )}
              </div>

              {/* Price + CTA */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
                {offer.price != null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                      ${offer.price.toFixed(2)}
                    </span>
                    <span className="text-slate-400 text-sm">USD · one-time</span>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm">Price not set</p>
                )}

                {buyError && (
                  <p className="text-sm text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {buyError}
                  </p>
                )}

                {offer.stripeEnabled && offer.price != null && offer.price > 0 ? (
                  <Button
                    size="lg"
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    onClick={handleBuy}
                    disabled={buying || (offer.status as string) === "paused"}
                  >
                    {buying ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to checkout…</>
                    ) : (
                      <><ShoppingCart className="mr-2 h-4 w-4" /> Buy Now</>
                    )}
                  </Button>
                ) : (
                  <Button size="lg" className="w-full" disabled>
                    {offer.stripeEnabled ? "No price set" : "Stripe not configured"}
                  </Button>
                )}

                <p className="text-xs text-slate-400 text-center">
                  Secure checkout powered by Stripe
                </p>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
