/**
 * ProductPanel — Generate products from article content
 * eBooks, courses, lead magnets, email sequences
 */
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  Package, BookOpen, GraduationCap, Gift, Mail,
  Loader2, Lightbulb, DollarSign, ArrowRight, Eye,
} from 'lucide-react';

interface ProductPanelProps {
  title: string;
  content: string;
  brandVoice?: string;
  articleId?: number;
}

export function ProductPanel({ title, content, brandVoice, articleId }: ProductPanelProps) {
  const [activeTab, setActiveTab] = useState('analyze');
  const [leadMagnetType, setLeadMagnetType] = useState<string>('checklist');
  const [opportunities, setOpportunities] = useState<any>(null);
  const [productResult, setProductResult] = useState<any>(null);
  const [productType, setProductType] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const analyzeOpp = trpc.productCreation.analyzeOpportunities.useMutation();
  const genEbook = trpc.productCreation.generateEbook.useMutation();
  const genCourse = trpc.productCreation.generateCourse.useMutation();
  const genLeadMagnet = trpc.productCreation.generateLeadMagnet.useMutation();
  const genEmail = trpc.productCreation.generateEmailSequence.useMutation();

  const isBusy = analyzeOpp.isPending || genEbook.isPending || genCourse.isPending ||
                 genLeadMagnet.isPending || genEmail.isPending;

  const handleAnalyze = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await analyzeOpp.mutateAsync({ articleTitle: title, articleContent: content });
      if (result.success) {
        setOpportunities(result.data);
        toast.success(`Found ${result.data?.opportunities?.length || 0} product opportunities`);
      }
    } catch (err: any) {
      toast.error('Analysis failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleGenerateEbook = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await genEbook.mutateAsync({
        articleTitle: title,
        articleContent: content,
        brandVoice,
        articleId,
      });
      if (result.success) {
        setProductResult({ type: 'ebook', ...result });
        setProductType('ebook');
        toast.success('eBook structure created');
      }
    } catch (err: any) {
      toast.error('eBook generation failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleGenerateCourse = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await genCourse.mutateAsync({
        articleTitle: title,
        articleContent: content,
        articleId,
      });
      if (result.success) {
        setProductResult({ type: 'course', ...result });
        setProductType('course');
        toast.success('Course structure created');
      }
    } catch (err: any) {
      toast.error('Course generation failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleGenerateLeadMagnet = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await genLeadMagnet.mutateAsync({
        articleTitle: title,
        articleContent: content,
        type: leadMagnetType as any,
        brandVoice,
        articleId,
      });
      if (result.success) {
        setProductResult({ type: 'leadMagnet', ...result });
        setProductType('leadMagnet');
        toast.success('Lead magnet created');
      }
    } catch (err: any) {
      toast.error('Lead magnet failed: ' + (err.message || 'Unknown error'));
    }
  };

  const handleGenerateEmail = async () => {
    if (!content.trim()) { toast.error('Write some content first'); return; }
    try {
      const result = await genEmail.mutateAsync({
        articleTitle: title,
        articleContent: content,
        emailCount: 5,
        goal: 'nurture',
      });
      if (result.success) {
        setProductResult({ type: 'email', ...result });
        setProductType('email');
        toast.success('Email sequence created');
      }
    } catch (err: any) {
      toast.error('Email sequence failed: ' + (err.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-3 p-3">
      {/* Analyze Button */}
      <Button
        className="w-full h-9 text-xs gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
        onClick={handleAnalyze}
        disabled={isBusy || !content.trim()}
      >
        {analyzeOpp.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
        {analyzeOpp.isPending ? 'Analyzing...' : 'Analyze Product Opportunities'}
      </Button>

      {/* Opportunities */}
      {opportunities?.opportunities?.length > 0 && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-emerald-400">Top Opportunities</p>
              {opportunities.recommendedFirst && (
                <Badge variant="outline" className="text-[8px]">
                  Start: {opportunities.recommendedFirst.slice(0, 30)}
                </Badge>
              )}
            </div>
            {opportunities.opportunities.slice(0, 4).map((opp: any, i: number) => (
              <div key={i} className="flex items-start gap-1.5 p-1 rounded hover:bg-emerald-500/10">
                <Badge variant="outline" className="text-[8px] shrink-0 mt-0.5">{opp.type}</Badge>
                <div className="min-w-0">
                  <p className="text-[10px] font-medium truncate">{opp.name}</p>
                  <p className="text-[9px] text-muted-foreground">{opp.description?.slice(0, 60)}</p>
                  <div className="flex gap-2 mt-0.5">
                    <span className="text-[8px] text-emerald-400">{opp.suggestedPrice}</span>
                    <span className="text-[8px] text-muted-foreground">{opp.difficulty}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Product Generation Buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline" size="sm"
          className="h-9 text-[10px] gap-1 flex-col py-1.5"
          onClick={handleGenerateEbook}
          disabled={isBusy || !content.trim()}
        >
          {genEbook.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
          eBook
        </Button>
        <Button
          variant="outline" size="sm"
          className="h-9 text-[10px] gap-1 flex-col py-1.5"
          onClick={handleGenerateCourse}
          disabled={isBusy || !content.trim()}
        >
          {genCourse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GraduationCap className="w-3.5 h-3.5" />}
          Course
        </Button>
      </div>

      <div className="flex gap-1.5">
        <Select value={leadMagnetType} onValueChange={setLeadMagnetType}>
          <SelectTrigger className="h-8 text-[10px] flex-1">
            <Gift className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checklist">Checklist</SelectItem>
            <SelectItem value="template">Template</SelectItem>
            <SelectItem value="worksheet">Worksheet</SelectItem>
            <SelectItem value="swipe_file">Swipe File</SelectItem>
            <SelectItem value="toolkit">Toolkit</SelectItem>
            <SelectItem value="cheat_sheet">Cheat Sheet</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm" variant="outline"
          className="h-8 text-[10px] gap-1 px-3"
          onClick={handleGenerateLeadMagnet}
          disabled={isBusy || !content.trim()}
        >
          {genLeadMagnet.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3 h-3" />}
          Create
        </Button>
      </div>

      <Button
        variant="outline" size="sm"
        className="w-full h-8 text-xs gap-1.5"
        onClick={handleGenerateEmail}
        disabled={isBusy || !content.trim()}
      >
        {genEmail.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
        Generate Email Sequence
      </Button>

      {/* Product Results */}
      {productResult && (
        <>
          <Button
            variant="outline" size="sm"
            className="w-full h-7 text-[10px] gap-1 border-emerald-500/30 text-emerald-400"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="w-3 h-3" /> View {productType === 'ebook' ? 'eBook' : productType === 'course' ? 'Course' : productType === 'email' ? 'Email Sequence' : 'Lead Magnet'} Details
          </Button>

          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {productType === 'ebook' ? 'eBook Structure' :
                   productType === 'course' ? 'Course Structure' :
                   productType === 'email' ? 'Email Sequence' : 'Lead Magnet'}
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh]">
                <div className="p-4 space-y-3">
                  {/* eBook Results */}
                  {productType === 'ebook' && productResult.structure && (
                    <>
                      <h3 className="text-lg font-bold">{productResult.structure.title}</h3>
                      {productResult.structure.subtitle && (
                        <p className="text-muted-foreground">{productResult.structure.subtitle}</p>
                      )}
                      <p className="text-sm">{productResult.structure.description}</p>
                      <Accordion type="multiple" className="w-full">
                        {productResult.structure.chapters?.map((ch: any, i: number) => (
                          <AccordionItem key={i} value={`ch-${i}`}>
                            <AccordionTrigger className="text-sm">
                              Chapter {ch.number}: {ch.title}
                            </AccordionTrigger>
                            <AccordionContent>
                              <p className="text-sm text-muted-foreground mb-2">{ch.summary}</p>
                              {ch.keyTakeaways?.map((t: string, j: number) => (
                                <p key={j} className="text-xs text-muted-foreground">• {t}</p>
                              ))}
                              <p className="text-xs text-muted-foreground/60 mt-1">{ch.wordTarget} words</p>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                      {productResult.previewChapter && (
                        <div className="mt-4">
                          <h4 className="text-sm font-semibold mb-2">Chapter 1 Preview</h4>
                          <div className="prose prose-sm prose-invert max-w-none bg-muted/30 p-3 rounded-md">
                            <pre className="whitespace-pre-wrap text-xs">{productResult.previewChapter.slice(0, 2000)}</pre>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Course Results */}
                  {productType === 'course' && productResult.course && (
                    <>
                      <h3 className="text-lg font-bold">{productResult.course.title}</h3>
                      <p className="text-sm italic">{productResult.course.tagline}</p>
                      <p className="text-sm">{productResult.course.description}</p>
                      {productResult.course.learningOutcomes?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Learning Outcomes:</p>
                          {productResult.course.learningOutcomes.map((o: string, i: number) => (
                            <p key={i} className="text-xs text-emerald-400">✓ {o}</p>
                          ))}
                        </div>
                      )}
                      <Accordion type="multiple" className="w-full">
                        {productResult.course.modules?.map((mod: any, i: number) => (
                          <AccordionItem key={i} value={`mod-${i}`}>
                            <AccordionTrigger className="text-sm">
                              Module {mod.number}: {mod.title}
                            </AccordionTrigger>
                            <AccordionContent>
                              <p className="text-sm text-muted-foreground mb-2">{mod.description}</p>
                              {mod.lessons?.map((l: any, j: number) => (
                                <div key={j} className="flex items-center gap-2 text-xs mb-1">
                                  <Badge variant="outline" className="text-[8px]">{l.type}</Badge>
                                  <span>{l.title}</span>
                                  <span className="text-muted-foreground">{l.duration}</span>
                                </div>
                              ))}
                              {mod.assignment && (
                                <p className="text-xs text-blue-400 mt-1">📝 {mod.assignment}</p>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </>
                  )}

                  {/* Lead Magnet Results */}
                  {productType === 'leadMagnet' && productResult.leadMagnet && (
                    <>
                      <h3 className="text-lg font-bold">{productResult.leadMagnet.title}</h3>
                      <p className="text-sm">{productResult.leadMagnet.description}</p>
                      <div className="bg-muted/30 p-3 rounded-md">
                        <p className="text-sm font-semibold mb-1">Opt-in Copy:</p>
                        <p className="text-sm font-bold text-emerald-400">{productResult.leadMagnet.optInHeadline}</p>
                        <p className="text-xs text-muted-foreground">{productResult.leadMagnet.optInSubtext}</p>
                        <Button size="sm" className="mt-2 text-xs">{productResult.leadMagnet.ctaText || 'Download Now'}</Button>
                      </div>
                      {productResult.leadMagnet.content?.sections?.map((s: any, i: number) => (
                        <div key={i}>
                          <p className="text-sm font-semibold">{s.heading}</p>
                          {s.items?.map((item: string, j: number) => (
                            <p key={j} className="text-xs text-muted-foreground">☐ {item}</p>
                          ))}
                          {s.proTip && <p className="text-xs text-amber-400 mt-1">💡 {s.proTip}</p>}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Email Sequence Results */}
                  {productType === 'email' && productResult.sequence?.emails && (
                    <>
                      <h3 className="text-lg font-bold">{productResult.sequence.sequenceName}</h3>
                      <Accordion type="multiple" className="w-full">
                        {productResult.sequence.emails.map((email: any, i: number) => (
                          <AccordionItem key={i} value={`email-${i}`}>
                            <AccordionTrigger className="text-sm">
                              Day {email.day}: {email.subject}
                            </AccordionTrigger>
                            <AccordionContent>
                              <p className="text-xs text-muted-foreground italic mb-2">Preview: {email.previewText}</p>
                              <pre className="whitespace-pre-wrap text-xs bg-muted/30 p-2 rounded">{email.body}</pre>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-[8px]">CTA: {email.cta}</Badge>
                                <span className="text-[9px] text-muted-foreground">{email.purpose}</span>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </>
                  )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
