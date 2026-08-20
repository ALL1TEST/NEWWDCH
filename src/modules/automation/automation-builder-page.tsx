'use client';

import React, { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Zap, FileText, Sparkles, Send, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { postApi } from '@/lib/api-client';
import { useNavigationStore } from '@/lib/stores/navigation-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function AutomationBuilderPage() {
  const navigate = useNavigationStore((s) => s.navigate);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Step 1: Trigger
  const [triggerType, setTriggerType] = useState<'MANUAL' | 'SCHEDULED'>('SCHEDULED');
  const [frequency, setFrequency] = useState('DAILY');
  const [time, setTime] = useState('09:00');
  // Step 2: Content Generation
  const [topic, setTopic] = useState('');
  const [primaryKeyword, setPrimaryKeyword] = useState('');
  const [secondaryKeywords, setSecondaryKeywords] = useState('');
  const [tone, setTone] = useState('Professional');
  const [contentLength, setContentLength] = useState('Medium (800-1200 words)');
  // Step 3: SEO + Media (toggles)
  const [generateSeoTitle, setGenerateSeoTitle] = useState(true);
  const [generateMetaDescription, setGenerateMetaDescription] = useState(true);
  const [generateSlug, setGenerateSlug] = useState(true);
  const [generateFeaturedImage, setGenerateFeaturedImage] = useState(true);
  const [optimizeKeyword, setOptimizeKeyword] = useState(true);
  // Step 4: Final Action
  const [finalAction, setFinalAction] = useState('DRAFT');

  const createMutation = useMutation({
    mutationFn: () => {
      const workflowConfig = JSON.stringify({
        contentGeneration: { topic, primaryKeyword, secondaryKeywords, tone, contentLength, description },
        seoProcessing: { generateSeoTitle, generateMetaDescription, generateSlug, optimizeKeyword },
        media: { generateFeaturedImage },
        finalAction: { action: finalAction },
      });
      const scheduleConfig = JSON.stringify({ frequency, time });
      return postApi('/api/automations', { name, description, triggerType, scheduleConfig, workflowConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      toast.success('Automation created successfully');
      navigate('automation');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create automation'),
  });

  const steps = [
    { num: 1, label: 'Trigger', icon: Zap },
    { num: 2, label: 'Content', icon: FileText },
    { num: 3, label: 'SEO + Media', icon: Sparkles },
    { num: 4, label: 'Action', icon: Send },
  ];

  const canProceed = useMemo(() => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return topic.trim().length > 0;
    return true;
  }, [step, name, topic]);

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('automation')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Automation</h1>
          <p className="text-sm text-muted-foreground">Set up an automated content workflow.</p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.num}>
            <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors', step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              <s.icon className="h-4 w-4" />
              {s.label}
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Automation Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Daily SEO Article" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Trigger Type</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as 'MANUAL' | 'SCHEDULED')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANUAL">Manual — Run when admin clicks "Run Now"</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled — Run automatically at a specific time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {triggerType === 'SCHEDULED' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Time</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label>Article Topic *</Label>
                <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Productivity tips for remote workers" />
              </div>
              <div className="space-y-2">
                <Label>Primary Keyword</Label>
                <Input value={primaryKeyword} onChange={(e) => setPrimaryKeyword(e.target.value)} placeholder="e.g., remote work productivity" />
              </div>
              <div className="space-y-2">
                <Label>Secondary Keywords</Label>
                <Input value={secondaryKeywords} onChange={(e) => setSecondaryKeywords(e.target.value)} placeholder="comma, separated, keywords" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Professional">Professional</SelectItem>
                      <SelectItem value="Informative">Informative</SelectItem>
                      <SelectItem value="Casual">Casual</SelectItem>
                      <SelectItem value="Friendly">Friendly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Content Length</Label>
                  <Select value={contentLength} onValueChange={setContentLength}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Short (300-600 words)">Short (300-600 words)</SelectItem>
                      <SelectItem value="Medium (800-1200 words)">Medium (800-1200 words)</SelectItem>
                      <SelectItem value="Long (1500-2500 words)">Long (1500-2500 words)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm font-semibold">SEO Optimization</div>
              {[
                { label: 'Generate SEO optimized title', val: generateSeoTitle, set: setGenerateSeoTitle },
                { label: 'Generate meta description', val: generateMetaDescription, set: setGenerateMetaDescription },
                { label: 'Generate URL slug', val: generateSlug, set: setGenerateSlug },
                { label: 'Optimize for primary keyword', val: optimizeKeyword, set: setOptimizeKeyword },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <Label className="text-sm">{item.label}</Label>
                  <Switch checked={item.val} onCheckedChange={item.set} />
                </div>
              ))}
              <div className="text-sm font-semibold pt-2">Media</div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Generate featured image</Label>
                <Switch checked={generateFeaturedImage} onCheckedChange={setGenerateFeaturedImage} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Final Action</Label>
                <Select value={finalAction} onValueChange={setFinalAction}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Save as Draft</SelectItem>
                    <SelectItem value="REVIEW">Send to Review</SelectItem>
                    <SelectItem value="PUBLISH">Publish Immediately</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Workflow preview */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Workflow Preview</p>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>{triggerType === 'SCHEDULED' ? `Every ${frequency.toLowerCase()} at ${time}` : 'Manual trigger'}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-sky-500" /> <span>Generate: {topic || 'Untitled'}</span></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 text-sm"><Sparkles className="h-4 w-4 text-violet-500" /> <span>SEO + Media processing</span></div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-2 text-sm"><Send className="h-4 w-4 text-emerald-500" /> <span>{finalAction === 'DRAFT' ? 'Save as Draft' : finalAction === 'REVIEW' ? 'Send to Review' : 'Publish'}</span></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : navigate('automation')}>
          {step > 1 ? 'Back' : 'Cancel'}
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed}>Next</Button>
        ) : (
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !canProceed}>
            {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Create Automation
          </Button>
        )}
      </div>
    </div>
  );
}
