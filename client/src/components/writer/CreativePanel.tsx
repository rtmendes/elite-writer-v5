/**
 * CreativePanel — AI Image Generation, Infographics, and Mini Apps
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Image, BarChart3, AppWindow, Loader2, Sparkles, Plus,
  Palette, Lightbulb, Download, Copy, Eye,
} from 'lucide-react';

interface CreativePanelProps {
  title: string;
  content: string;
  articleId?: number;
  onInsertContent: (markdown: string) => void;
  targetPublication?: string;
}

export function CreativePanel({ title, content, articleId, onInsertContent, targetPublication }: CreativePanelProps) {
  const [activeTab, setActiveTab] = useState('images');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState('editorial');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [infographicHtml, setInfographicHtml] = useState<string | null>(null);
  const [miniAppHtml, setMiniAppHtml] = useState<string | null>(null);
  const [miniAppType, setMiniAppType] = useState('calculator');
  const [chartType, setChartType] = useState('statistics');
  const [infographicTopic, setInfographicTopic] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [suggestions, setSuggestions] = useState<any>(null);

  const suggestImages = trpc.creative.suggestImages.useMutation();
  const generateImage = trpc.creative.generateArticleImage.useMutation();
  const generateInfographic = trpc.creative.generateInfographic.useMutation();
  const generateMiniApp = trpc.creative.generateMiniApp.useMutation();
  const suggestMiniApps = trpc.creative.suggestMiniApps.useMutation();

  const isBusy = suggestImages.isPending || generateImage.isPending ||
                 generateInfographic.isPending || generateMiniApp.isPending || suggestMiniApps.isPending;

  const handleSuggestImages = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await suggestImages.mutateAsync({ title, content, targetPublication });
      if (result.success) {
        setSuggestions(result.data);
        toast.success('Image suggestions generated');
      }
    } catch (err: any) {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleGenerateImage = async (prompt?: string) => {
    const p = prompt || imagePrompt;
    if (!p.trim()) { toast.error('Enter an image prompt'); return; }
    try {
      const result = await generateImage.mutateAsync({
        prompt: p,
        style: imageStyle as any,
        articleTitle: title,
        articleId,
        type: 'hero',
      });
      if (result.success) {
        setGeneratedImage(result.imageUrl);
        toast.success(`Image generated via ${result.source}`);
      }
    } catch (err: any) {
      toast.error('Image generation failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleGenerateInfographic = async () => {
    const topic = infographicTopic || title;
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await generateInfographic.mutateAsync({
        title: topic,
        content,
        chartType: chartType as any,
        colorScheme: 'dark',
        articleTitle: title,
      });
      if (result.success && result.data?.html) {
        setInfographicHtml(result.data.html);
        setPreviewContent(result.data.html);
        setPreviewTitle(result.data.title || 'Infographic');
        setPreviewOpen(true);
        toast.success('Infographic generated');
      }
    } catch (err: any) {
      toast.error('Infographic failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleGenerateMiniApp = async (type?: string) => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await generateMiniApp.mutateAsync({
        articleTitle: title,
        articleContent: content,
        appType: (type || miniAppType) as any,
      });
      if (result.success && result.data?.html) {
        setMiniAppHtml(result.data.html);
        setPreviewContent(result.data.html);
        setPreviewTitle(result.data.name || 'Mini App');
        setPreviewOpen(true);
        toast.success(`Mini app created: ${result.data.name}`);
      }
    } catch (err: any) {
      toast.error('Mini app failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSuggestMiniApps = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await suggestMiniApps.mutateAsync({ articleTitle: title, articleContent: content });
      if (result.success) {
        setSuggestions(result.data);
        toast.success('Mini app suggestions generated');
      }
    } catch (err: any) {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    }
  };

  const insertImageMarkdown = (url: string, alt: string) => {
    // data: URLs mean R2 was unavailable — insert an img tag so the browser renders
    // the inline blob. For R2 URLs (http/https) use standard markdown syntax.
    const content = url.startsWith('data:')
      ? `\n\n<img src="${url}" alt="${alt}" style="max-width:100%;border-radius:8px;" />\n\n`
      : `\n\n![${alt}](${url})\n\n`;
    onInsertContent(content);
    toast.success('Image inserted');
  };

  const insertEmbedBlock = (html: string, caption: string) => {
    // Wrap HTML in a details/summary block for markdown compatibility
    const block = `\n\n<details open>\n<summary>${caption}</summary>\n\n${html}\n\n</details>\n\n`;
    onInsertContent(block);
    toast.success('Embed block inserted');
  };

  return (
    <div className="space-y-3 p-3">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3 h-8">
          <TabsTrigger value="images" className="text-[10px] gap-1">
            <Image className="w-3 h-3" /> Images
          </TabsTrigger>
          <TabsTrigger value="infographics" className="text-[10px] gap-1">
            <BarChart3 className="w-3 h-3" /> Infographic
          </TabsTrigger>
          <TabsTrigger value="miniapps" className="text-[10px] gap-1">
            <AppWindow className="w-3 h-3" /> Mini Apps
          </TabsTrigger>
        </TabsList>

        {/* Images Tab */}
        <TabsContent value="images" className="space-y-2 mt-2">
          <Button
            variant="outline" size="sm"
            className="w-full h-8 text-xs gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={handleSuggestImages}
            disabled={isBusy || !content.trim()}
          >
            {suggestImages.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
            Suggest Images for Article
          </Button>

          <div className="flex gap-1.5">
            <Input
              placeholder="Image description..."
              value={imagePrompt}
              onChange={e => setImagePrompt(e.target.value)}
              className="text-xs h-8 flex-1"
            />
          </div>

          <div className="flex gap-1.5">
            <Select value={imageStyle} onValueChange={setImageStyle}>
              <SelectTrigger className="h-8 text-[10px] flex-1">
                <Palette className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editorial">Editorial</SelectItem>
                <SelectItem value="bloomberg">Bloomberg</SelectItem>
                <SelectItem value="forbes">Forbes</SelectItem>
                <SelectItem value="atlantic">The Atlantic</SelectItem>
                <SelectItem value="nyt">NYT Style</SelectItem>
                <SelectItem value="abstract">Abstract</SelectItem>
                <SelectItem value="photographic">Photographic</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm" className="h-8 text-xs gap-1 px-3"
              onClick={() => handleGenerateImage()}
              disabled={isBusy || !imagePrompt.trim()}
            >
              {generateImage.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Generate
            </Button>
          </div>

          {/* Image suggestions */}
          {suggestions?.heroImage && activeTab === 'images' && (
            <Card className="border-purple-500/20 bg-purple-500/5">
              <CardContent className="p-2 space-y-1.5">
                <p className="text-[10px] font-semibold text-purple-400">Suggested Images</p>
                <button
                  className="text-[10px] text-blue-400 hover:underline block"
                  onClick={() => { setImagePrompt(suggestions.heroImage.prompt); handleGenerateImage(suggestions.heroImage.prompt); }}
                >
                  🖼 Hero: {suggestions.heroImage.concept?.slice(0, 80)}
                </button>
                {suggestions.inlineImages?.slice(0, 3).map((img: any, i: number) => (
                  <button
                    key={i}
                    className="text-[10px] text-muted-foreground hover:text-blue-400 block text-left"
                    onClick={() => { setImagePrompt(img.prompt); handleGenerateImage(img.prompt); }}
                  >
                    📷 {img.concept?.slice(0, 80)}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Generated image */}
          {generatedImage && (
            <Card className="border-green-500/20 bg-green-500/5 overflow-hidden">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full h-32 object-cover"
              />
              <CardContent className="p-2 flex gap-1.5">
                <Button
                  size="sm" variant="outline"
                  className="flex-1 h-7 text-[10px] gap-1"
                  onClick={() => insertImageMarkdown(generatedImage, title)}
                >
                  <Plus className="w-3 h-3" /> Insert
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => { navigator.clipboard.writeText(generatedImage); toast.success('Copied'); }}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Infographics Tab */}
        <TabsContent value="infographics" className="space-y-2 mt-2">
          <Input
            placeholder="What to visualize..."
            value={infographicTopic}
            onChange={e => setInfographicTopic(e.target.value)}
            className="text-xs h-8"
          />
          <div className="flex gap-1.5">
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger className="h-8 text-[10px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="statistics">Statistics</SelectItem>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="comparison">Comparison</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
                <SelectItem value="flowchart">Flowchart</SelectItem>
                <SelectItem value="process">Process</SelectItem>
                <SelectItem value="list">Visual List</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm" className="h-8 text-xs gap-1 px-3"
              onClick={handleGenerateInfographic}
              disabled={isBusy || !content.trim()}
            >
              {generateInfographic.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
              Generate
            </Button>
          </div>

          {/* Infographic suggestions from image analysis */}
          {suggestions?.infographicOpportunities?.length > 0 && activeTab === 'infographics' && (
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="p-2 space-y-1">
                <p className="text-[10px] font-semibold text-blue-400">Opportunities</p>
                {suggestions.infographicOpportunities.map((inf: any, i: number) => (
                  <button
                    key={i}
                    className="text-[10px] text-muted-foreground hover:text-blue-400 block text-left"
                    onClick={() => {
                      setInfographicTopic(inf.title || inf.dataPoint);
                      setChartType(inf.chartType || 'statistics');
                    }}
                  >
                    📊 {inf.title}: {inf.description?.slice(0, 60)}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {infographicHtml && (
            <div className="flex gap-1.5">
              <Button
                size="sm" variant="outline"
                className="flex-1 h-7 text-[10px] gap-1"
                onClick={() => insertEmbedBlock(infographicHtml, 'Infographic')}
              >
                <Plus className="w-3 h-3" /> Insert in Article
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={() => { setPreviewContent(infographicHtml); setPreviewTitle('Infographic'); setPreviewOpen(true); }}
              >
                <Eye className="w-3 h-3" /> Preview
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Mini Apps Tab */}
        <TabsContent value="miniapps" className="space-y-2 mt-2">
          <Button
            variant="outline" size="sm"
            className="w-full h-8 text-xs gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            onClick={handleSuggestMiniApps}
            disabled={isBusy || !content.trim()}
          >
            {suggestMiniApps.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
            Suggest Mini Apps
          </Button>

          <div className="flex gap-1.5">
            <Select value={miniAppType} onValueChange={setMiniAppType}>
              <SelectTrigger className="h-8 text-[10px] flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calculator">Calculator</SelectItem>
                <SelectItem value="quiz">Knowledge Quiz</SelectItem>
                <SelectItem value="assessment">Self-Assessment</SelectItem>
                <SelectItem value="comparison">Comparison Tool</SelectItem>
                <SelectItem value="checklist_interactive">Interactive Checklist</SelectItem>
                <SelectItem value="estimator">Estimator</SelectItem>
                <SelectItem value="scorecard">Scorecard</SelectItem>
                <SelectItem value="decision_tree">Decision Tree</SelectItem>
                <SelectItem value="roi_calculator">ROI Calculator</SelectItem>
                <SelectItem value="survey">Survey</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm" className="h-8 text-xs gap-1 px-3"
              onClick={() => handleGenerateMiniApp()}
              disabled={isBusy || !content.trim()}
            >
              {generateMiniApp.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <AppWindow className="w-3 h-3" />}
              Build
            </Button>
          </div>

          {/* Mini app suggestions */}
          {suggestions?.suggestions?.length > 0 && activeTab === 'miniapps' && (
            <Card className="border-cyan-500/20 bg-cyan-500/5">
              <CardContent className="p-2 space-y-1.5">
                <p className="text-[10px] font-semibold text-cyan-400">Suggested Apps</p>
                {suggestions.suggestions.map((s: any, i: number) => (
                  <button
                    key={i}
                    className="block text-left w-full hover:bg-cyan-500/10 rounded p-1"
                    onClick={() => handleGenerateMiniApp(s.type)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-cyan-300">{s.name}</span>
                      <Badge variant="outline" className="text-[8px] font-mono px-1 py-0">{s.type}</Badge>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{s.description?.slice(0, 80)}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {miniAppHtml && (
            <div className="flex gap-1.5">
              <Button
                size="sm" variant="outline"
                className="flex-1 h-7 text-[10px] gap-1"
                onClick={() => insertEmbedBlock(miniAppHtml, 'Interactive Tool')}
              >
                <Plus className="w-3 h-3" /> Insert in Article
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={() => { setPreviewContent(miniAppHtml); setPreviewTitle('Mini App'); setPreviewOpen(true); }}
              >
                <Eye className="w-3 h-3" /> Preview
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> {previewTitle}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <div className="p-4">
              <div dangerouslySetInnerHTML={{ __html: previewContent }} />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
