import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { trpc } from '@/lib/trpc';
import type { Brand, DigitalProduct, CustomerAvatar } from '@/lib/store';
import { PUBLICATIONS, getPublicationTier } from '@/lib/publications-data';
import { toast } from 'sonner';
import {
  Building2, Package, Users, Target, TrendingUp, Plus, Edit2, Trash2,
  ExternalLink, ChevronDown, ChevronRight, DollarSign, Zap, Globe,
  ShoppingBag, BookOpen, GraduationCap, Crown, Layers, Rocket,
  ArrowRight, BarChart3, Eye, Heart, Brain, Megaphone,
} from 'lucide-react';

const PRODUCT_TYPES: { value: DigitalProduct['type']; label: string; icon: typeof Package }[] = [
  { value: 'course', label: 'Online Course', icon: GraduationCap },
  { value: 'ebook', label: 'eBook / Guide', icon: BookOpen },
  { value: 'membership', label: 'Membership', icon: Crown },
  { value: 'coaching', label: 'Coaching', icon: Users },
  { value: 'template', label: 'Template Pack', icon: Layers },
  { value: 'saas', label: 'SaaS / App', icon: Globe },
  { value: 'supplement', label: 'Supplement', icon: Heart },
  { value: 'physical', label: 'Physical Product', icon: ShoppingBag },
  { value: 'other', label: 'Other', icon: Package },
];

const STATUS_COLORS: Record<string, string> = {
  concept: 'bg-zinc-500/20 text-zinc-400',
  building: 'bg-amber-500/20 text-amber-400',
  launched: 'bg-emerald-500/20 text-emerald-400',
  scaling: 'bg-violet-500/20 text-violet-400',
};

const BRAND_COLORS = ['#e879a0', '#a78bfa', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#c084fc'];

export default function Brands() {
  const { state, addBrand, updateBrand, deleteBrand, addProduct, updateProduct, deleteProduct } = useApp();
  const createBrandDb = trpc.data.brands.create.useMutation();
  const deleteBrandDb = trpc.data.brands.delete.useMutation();
  const createProductDb = trpc.data.products.create.useMutation();
  const [brandIdMap] = useState<Map<string, number>>(() => new Map());
  const [expandedBrand, setExpandedBrand] = useState<string | null>(state.brands[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<'overview' | 'avatar' | 'products' | 'publications' | 'funnel'>('overview');
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<DigitalProduct | null>(null);

  // New brand form
  const [newBrand, setNewBrand] = useState({ name: '', niche: '', description: '', website: '' });
  // New product form
  const [newProduct, setNewProduct] = useState({
    name: '', type: 'course' as DigitalProduct['type'], price: '', margin_pct: '90',
    description: '', landing_url: '', cta_text: '', status: 'concept' as DigitalProduct['status'],
  });

  const activeBrand = useMemo(() => state.brands.find(b => b.id === expandedBrand), [state.brands, expandedBrand]);

  const alignedPubs = useMemo(() => {
    if (!activeBrand) return [];
    return PUBLICATIONS.filter(p =>
      activeBrand.aligned_publication_ids.includes(p.id) ||
      activeBrand.aligned_topics.some(t => p.topics.toLowerCase().includes(t.toLowerCase()))
    );
  }, [activeBrand]);

  // Revenue totals
  const totals = useMemo(() => {
    const contentRev = state.earnings.filter(e => e.type === 'content').reduce((s, e) => s + e.amount, 0);
    const productRev = state.earnings.filter(e => e.type === 'product').reduce((s, e) => s + e.amount, 0);
    return { content: contentRev, product: productRev, total: contentRev + productRev };
  }, [state.earnings]);

  const handleCreateBrand = () => {
    if (!newBrand.name.trim()) { toast.error('Brand name is required'); return; }
    const color = BRAND_COLORS[state.brands.length % BRAND_COLORS.length];
    addBrand({
      name: newBrand.name.trim(),
      niche: newBrand.niche.trim(),
      description: newBrand.description.trim(),
      website: newBrand.website.trim(),
      color,
      avatar: {
        id: '', name: 'Default Avatar', demographics: '', psychographics: '',
        pain_points: [], desires: [], media_habits: [], buying_triggers: [],
      },
      aligned_publication_ids: [],
      aligned_topics: [],
      products: [],
      content_revenue_goal: 25000,
      product_revenue_goal: 25000,
      monthly_content_revenue: 0,
      monthly_product_revenue: 0,
    });
    createBrandDb.mutate({ name: newBrand.name.trim(), niche: newBrand.niche.trim(), description: newBrand.description.trim(), website: newBrand.website.trim(), color }, {
      onSuccess: (r: any) => { if (r?.id) brandIdMap.set(newBrand.name.trim(), r.id); }
    });
    setNewBrand({ name: '', niche: '', description: '', website: '' });
    setShowNewBrand(false);
    toast.success(`Brand "${newBrand.name}" created`);
  };

  const handleCreateProduct = () => {
    if (!activeBrand || !newProduct.name.trim()) { toast.error('Product name is required'); return; }
    addProduct(activeBrand.id, {
      brand_id: activeBrand.id,
      name: newProduct.name.trim(),
      type: newProduct.type,
      price: parseFloat(newProduct.price) || 0,
      margin_pct: parseFloat(newProduct.margin_pct) || 90,
      description: newProduct.description.trim(),
      landing_url: newProduct.landing_url.trim(),
      cta_text: newProduct.cta_text.trim() || 'Learn More',
      status: newProduct.status,
      monthly_revenue: 0,
      monthly_units: 0,
    });
    setNewProduct({ name: '', type: 'course', price: '', margin_pct: '90', description: '', landing_url: '', cta_text: '', status: 'concept' });
    setShowNewProduct(false);
    toast.success(`Product "${newProduct.name}" added`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Brand & Product Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {state.brands.length} brands — Publication-aligned funnels for $200K/month
          </p>
        </div>
        <button
          onClick={() => setShowNewBrand(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Brand
        </button>
      </div>

      {/* Revenue Goals */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Content Revenue</span>
            <Megaphone className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">${totals.content.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Goal: $100K/mo</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, (totals.content / 100000) * 100)}%` }} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Product Revenue</span>
            <ShoppingBag className="w-4 h-4 text-violet-400" />
          </div>
          <p className="text-xl font-bold text-violet-400">${totals.product.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Goal: $100K/mo</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, (totals.product / 100000) * 100)}%` }} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400">${totals.total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Goal: $200K/mo</p>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(100, (totals.total / 200000) * 100)}%` }} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Active Brands</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold">{state.brands.length}</p>
          <p className="text-xs text-muted-foreground">
            {state.brands.reduce((s, b) => s + b.products.length, 0)} products total
          </p>
        </div>
      </div>

      {/* Brand List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Brand selector */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Your Brands</h3>
          {state.brands.map(brand => (
            <button
              key={brand.id}
              onClick={() => { setExpandedBrand(brand.id); setActiveTab('overview'); }}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                expandedBrand === brand.id
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: brand.color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{brand.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{brand.niche}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium">{brand.products.length} products</p>
                  <p className="text-[10px] text-muted-foreground">{brand.aligned_publication_ids.length} pubs</p>
                </div>
              </div>
            </button>
          ))}

          {/* New Brand Modal */}
          {showNewBrand && (
            <div className="p-4 border border-primary/30 rounded-lg bg-card space-y-3">
              <h4 className="text-sm font-semibold">Create New Brand</h4>
              <input placeholder="Brand Name (e.g., Second Spring)" value={newBrand.name}
                onChange={e => setNewBrand(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm" />
              <input placeholder="Niche (e.g., Women's Health)" value={newBrand.niche}
                onChange={e => setNewBrand(p => ({ ...p, niche: e.target.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm" />
              <textarea placeholder="Brand description..." value={newBrand.description}
                onChange={e => setNewBrand(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-20 resize-none" />
              <input placeholder="Website URL" value={newBrand.website}
                onChange={e => setNewBrand(p => ({ ...p, website: e.target.value }))}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm" />
              <div className="flex gap-2">
                <button onClick={handleCreateBrand} className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">Create</button>
                <button onClick={() => setShowNewBrand(false)} className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Brand detail */}
        {activeBrand ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Brand header */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: activeBrand.color }}>
                    {activeBrand.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{activeBrand.name}</h2>
                    <p className="text-xs text-muted-foreground">{activeBrand.niche}</p>
                  </div>
                </div>
                <button onClick={() => deleteBrand(activeBrand.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{activeBrand.description}</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-muted/50 p-1 rounded-lg">
              {(['overview', 'avatar', 'products', 'publications', 'funnel'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all capitalize ${
                    activeTab === tab ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Funnel visualization */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Publication-to-Product Funnel
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Aligned Publications', value: alignedPubs.length, color: 'bg-blue-500', icon: BookOpen, desc: 'Publications matching brand topics' },
                      { label: 'Articles Published', value: state.articles.filter(a => a.brand_id === activeBrand.id && a.status === 'published').length, color: 'bg-emerald-500', icon: Megaphone, desc: 'Content driving free traffic' },
                      { label: 'Reader → Lead', value: '2-5%', color: 'bg-amber-500', icon: Users, desc: 'CTA conversion from articles' },
                      { label: 'Products Available', value: activeBrand.products.length, color: 'bg-violet-500', icon: Package, desc: 'Digital products for monetization' },
                      { label: 'Lead → Customer', value: '3-8%', color: 'bg-rose-500', icon: DollarSign, desc: 'Product purchase conversion' },
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${step.color}/20 flex items-center justify-center shrink-0`}>
                          <step.icon className={`w-4 h-4 ${step.color.replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{step.label}</span>
                            <span className="text-sm font-bold">{step.value}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                        </div>
                        {i < 4 && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Revenue goals */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Content Revenue Goal</p>
                    <p className="text-lg font-bold text-emerald-400">${activeBrand.content_revenue_goal.toLocaleString()}/mo</p>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (activeBrand.monthly_content_revenue / activeBrand.content_revenue_goal) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs text-muted-foreground mb-1">Product Revenue Goal</p>
                    <p className="text-lg font-bold text-violet-400">${activeBrand.product_revenue_goal.toLocaleString()}/mo</p>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, (activeBrand.monthly_product_revenue / activeBrand.product_revenue_goal) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-3">Aligned Topics</h3>
                  <div className="flex flex-wrap gap-2">
                    {activeBrand.aligned_topics.map(topic => (
                      <span key={topic} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">{topic}</span>
                    ))}
                    {activeBrand.aligned_topics.length === 0 && (
                      <p className="text-xs text-muted-foreground">No topics configured yet</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'avatar' && (
              <AvatarEditor avatar={activeBrand.avatar} brandId={activeBrand.id} updateBrand={updateBrand} />
            )}

            {activeTab === 'products' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{activeBrand.products.length} Digital Products</h3>
                  <button onClick={() => setShowNewProduct(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium">
                    <Plus className="w-3 h-3" /> Add Product
                  </button>
                </div>

                {activeBrand.products.map(product => (
                  <div key={product.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {(() => { const T = PRODUCT_TYPES.find(t => t.value === product.type); return T ? <T.icon className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-primary" />; })()}
                        <div>
                          <h4 className="font-medium text-sm">{product.name}</h4>
                          <p className="text-xs text-muted-foreground capitalize">{product.type.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[product.status]}`}>
                          {product.status}
                        </span>
                        <button onClick={() => deleteProduct(activeBrand.id, product.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{product.description}</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Price</p>
                        <p className="text-sm font-bold">${product.price}</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Margin</p>
                        <p className="text-sm font-bold">{product.margin_pct}%</p>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs text-muted-foreground">Profit/Sale</p>
                        <p className="text-sm font-bold text-emerald-400">${(product.price * product.margin_pct / 100).toFixed(0)}</p>
                      </div>
                    </div>
                    {product.cta_text && (
                      <div className="mt-3 p-2 bg-primary/5 border border-primary/20 rounded-md">
                        <p className="text-[10px] text-muted-foreground mb-0.5">Article CTA</p>
                        <p className="text-xs font-medium text-primary">{product.cta_text}</p>
                      </div>
                    )}
                    {/* Units needed calculator */}
                    <div className="mt-3 p-2 bg-muted/30 rounded-md">
                      <p className="text-[10px] text-muted-foreground">To reach $100K/mo product revenue from this product alone:</p>
                      <p className="text-xs font-medium">
                        {product.price > 0 ? `${Math.ceil(100000 / (product.price * product.margin_pct / 100))} sales/mo` : 'Set a price first'} 
                        {product.price > 0 && <span className="text-muted-foreground"> = {Math.ceil(100000 / (product.price * product.margin_pct / 100) / 30)} sales/day</span>}
                      </p>
                    </div>
                  </div>
                ))}

                {/* New product form */}
                {showNewProduct && (
                  <div className="bg-card border border-primary/30 rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-semibold">Add Digital Product</h4>
                    <input placeholder="Product Name" value={newProduct.name}
                      onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={newProduct.type} onChange={e => setNewProduct(p => ({ ...p, type: e.target.value as DigitalProduct['type'] }))}
                        className="px-3 py-2 bg-muted border border-border rounded-md text-sm">
                        {PRODUCT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <select value={newProduct.status} onChange={e => setNewProduct(p => ({ ...p, status: e.target.value as DigitalProduct['status'] }))}
                        className="px-3 py-2 bg-muted border border-border rounded-md text-sm">
                        <option value="concept">Concept</option>
                        <option value="building">Building</option>
                        <option value="launched">Launched</option>
                        <option value="scaling">Scaling</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Price ($)" type="number" value={newProduct.price}
                        onChange={e => setNewProduct(p => ({ ...p, price: e.target.value }))}
                        className="px-3 py-2 bg-muted border border-border rounded-md text-sm" />
                      <input placeholder="Margin %" type="number" value={newProduct.margin_pct}
                        onChange={e => setNewProduct(p => ({ ...p, margin_pct: e.target.value }))}
                        className="px-3 py-2 bg-muted border border-border rounded-md text-sm" />
                    </div>
                    <textarea placeholder="Product description..." value={newProduct.description}
                      onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-16 resize-none" />
                    <input placeholder="Landing page URL" value={newProduct.landing_url}
                      onChange={e => setNewProduct(p => ({ ...p, landing_url: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm" />
                    <input placeholder="CTA text (e.g., 'Start Your Free Assessment')" value={newProduct.cta_text}
                      onChange={e => setNewProduct(p => ({ ...p, cta_text: e.target.value }))}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm" />
                    <div className="flex gap-2">
                      <button onClick={handleCreateProduct} className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">Add Product</button>
                      <button onClick={() => setShowNewProduct(false)} className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm">Cancel</button>
                    </div>
                  </div>
                )}

                {activeBrand.products.length === 0 && !showNewProduct && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No products yet</p>
                    <p className="text-xs">Add digital products to monetize your publication traffic</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'publications' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{alignedPubs.length} Aligned Publications</h3>
                <p className="text-xs text-muted-foreground">
                  These publications match your brand's niche and customer avatar. Articles published here drive free traffic to your products.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {alignedPubs.slice(0, 20).map(pub => (
                    <div key={pub.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{pub.name}</p>
                        <p className="text-xs text-muted-foreground">{pub.category} — {pub.pay_min && pub.pay_max ? `$${pub.pay_min}-$${pub.pay_max}` : pub.pay_structure}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ml-2 ${
                        (() => { const t = getPublicationTier(pub); return t === 'Tier 1' ? 'bg-amber-500/20 text-amber-400' : t === 'Tier 2' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-500/20 text-zinc-400'; })()
                      }`}>{getPublicationTier(pub)}</span>
                    </div>
                  ))}
                </div>
                {alignedPubs.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center">+ {alignedPubs.length - 20} more publications</p>
                )}
                {alignedPubs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No aligned publications found</p>
                    <p className="text-xs">Add topics to your brand to match with publications</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'funnel' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Full Funnel Strategy
                </h3>

                {/* Funnel stages */}
                {[
                  {
                    stage: 'TOFU — Awareness',
                    color: 'border-blue-500/30 bg-blue-500/5',
                    icon: Eye,
                    iconColor: 'text-blue-400',
                    description: 'Publish authority-building articles in aligned publications to reach your customer avatar',
                    metrics: `${alignedPubs.length} aligned publications, targeting ${activeBrand.avatar.demographics || 'your ideal customer'}`,
                    action: 'Write articles that address avatar pain points with data-driven insights',
                  },
                  {
                    stage: 'MOFU — Engagement',
                    color: 'border-amber-500/30 bg-amber-500/5',
                    icon: Heart,
                    iconColor: 'text-amber-400',
                    description: 'Include strategic CTAs in articles that drive readers to lead magnets',
                    metrics: `CTA: "${activeBrand.products[0]?.cta_text || 'Download Free Guide'}"`,
                    action: 'Every article ends with a relevant CTA to your lead magnet or free tool',
                  },
                  {
                    stage: 'BOFU — Conversion',
                    color: 'border-emerald-500/30 bg-emerald-500/5',
                    icon: DollarSign,
                    iconColor: 'text-emerald-400',
                    description: 'Convert leads into customers through your digital product suite',
                    metrics: `${activeBrand.products.length} products, avg price $${activeBrand.products.length > 0 ? Math.round(activeBrand.products.reduce((s, p) => s + p.price, 0) / activeBrand.products.length) : 0}`,
                    action: 'Automated email sequences, webinars, and product launches',
                  },
                  {
                    stage: 'Retention — Scale',
                    color: 'border-violet-500/30 bg-violet-500/5',
                    icon: Rocket,
                    iconColor: 'text-violet-400',
                    description: 'Upsell, cross-sell, and build recurring revenue from your customer base',
                    metrics: `Target: $${(activeBrand.product_revenue_goal).toLocaleString()}/mo product revenue`,
                    action: 'Membership tiers, coaching programs, and community access',
                  },
                ].map((stage, i) => (
                  <div key={i} className={`border rounded-lg p-4 ${stage.color}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <stage.icon className={`w-4 h-4 ${stage.iconColor}`} />
                      <h4 className="text-sm font-semibold">{stage.stage}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{stage.description}</p>
                    <p className="text-xs font-medium mb-1">{stage.metrics}</p>
                    <p className="text-[10px] text-muted-foreground italic">{stage.action}</p>
                  </div>
                ))}

                {/* Revenue math */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-3">Revenue Math for {activeBrand.name}</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Content revenue (articles + syndication)</span>
                      <span className="font-medium">${activeBrand.content_revenue_goal.toLocaleString()}/mo</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Product revenue (digital products)</span>
                      <span className="font-medium">${activeBrand.product_revenue_goal.toLocaleString()}/mo</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Articles needed (at avg $2K/article)</span>
                      <span className="font-medium">{Math.ceil(activeBrand.content_revenue_goal / 2000)}/mo</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-border">
                      <span className="text-muted-foreground">Traffic needed (at 2% lead conversion)</span>
                      <span className="font-medium">{(Math.ceil(activeBrand.product_revenue_goal / (activeBrand.products[0]?.price || 50) / 0.05 / 0.02)).toLocaleString()} visitors/mo</span>
                    </div>
                    <div className="flex justify-between py-1 font-bold text-sm">
                      <span>Total brand revenue target</span>
                      <span className="text-primary">${(activeBrand.content_revenue_goal + activeBrand.product_revenue_goal).toLocaleString()}/mo</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select a brand or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Avatar Editor sub-component ──
function AvatarEditor({ avatar, brandId, updateBrand }: { avatar: CustomerAvatar; brandId: string; updateBrand: (id: string, u: Partial<Brand>) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(avatar);

  const handleSave = () => {
    updateBrand(brandId, { avatar: form });
    setEditing(false);
    toast.success('Avatar updated');
  };

  if (editing) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Edit Customer Avatar
        </h3>
        <input placeholder="Avatar Name (e.g., Sarah — The Overwhelmed Achiever)" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm" />
        <textarea placeholder="Demographics (age, income, profession, family)" value={form.demographics}
          onChange={e => setForm(f => ({ ...f, demographics: e.target.value }))}
          className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-16 resize-none" />
        <textarea placeholder="Psychographics (values, beliefs, motivations)" value={form.psychographics}
          onChange={e => setForm(f => ({ ...f, psychographics: e.target.value }))}
          className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-16 resize-none" />
        <div>
          <label className="text-xs text-muted-foreground">Pain Points (one per line)</label>
          <textarea value={form.pain_points.join('\n')}
            onChange={e => setForm(f => ({ ...f, pain_points: e.target.value.split('\n').filter(Boolean) }))}
            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-24 resize-none" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Desires (one per line)</label>
          <textarea value={form.desires.join('\n')}
            onChange={e => setForm(f => ({ ...f, desires: e.target.value.split('\n').filter(Boolean) }))}
            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-24 resize-none" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Media Habits (one per line)</label>
          <textarea value={form.media_habits.join('\n')}
            onChange={e => setForm(f => ({ ...f, media_habits: e.target.value.split('\n').filter(Boolean) }))}
            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-20 resize-none" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Buying Triggers (one per line)</label>
          <textarea value={form.buying_triggers.join('\n')}
            onChange={e => setForm(f => ({ ...f, buying_triggers: e.target.value.split('\n').filter(Boolean) }))}
            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-sm h-20 resize-none" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">Save Avatar</button>
          <button onClick={() => setEditing(false)} className="px-3 py-2 bg-muted text-muted-foreground rounded-md text-sm">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Customer Avatar
          </h3>
          <button onClick={() => { setForm(avatar); setEditing(true); }}
            className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Edit2 className="w-3 h-3" /> Edit
          </button>
        </div>
        <h4 className="font-medium text-sm mb-2">{avatar.name}</h4>
        {avatar.demographics && (
          <div className="mb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Demographics</p>
            <p className="text-xs">{avatar.demographics}</p>
          </div>
        )}
        {avatar.psychographics && (
          <div className="mb-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Psychographics</p>
            <p className="text-xs">{avatar.psychographics}</p>
          </div>
        )}
      </div>

      {avatar.pain_points.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Brain className="w-3 h-3" /> Pain Points
          </h4>
          <ul className="space-y-1">
            {avatar.pain_points.map((p, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span> {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {avatar.desires.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Heart className="w-3 h-3" /> Desires
          </h4>
          <ul className="space-y-1">
            {avatar.desires.map((d, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">•</span> {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {avatar.media_habits.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Eye className="w-3 h-3" /> Media Habits
          </h4>
          <ul className="space-y-1">
            {avatar.media_habits.map((m, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-blue-400 mt-0.5">•</span> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {avatar.buying_triggers.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Target className="w-3 h-3" /> Buying Triggers
          </h4>
          <ul className="space-y-1">
            {avatar.buying_triggers.map((t, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span className="text-amber-400 mt-0.5">•</span> {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
