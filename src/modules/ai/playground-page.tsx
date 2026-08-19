'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getApi, postApi } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from 'sonner';
import type { PaginatedResponse } from '@/shared/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Send, Trash2, Copy, Loader2, Play, Settings2, Bot, User, Zap,
} from 'lucide-react';

// -------------------- Types --------------------

interface AiProvider {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
}

interface AiModel {
  id: string;
  name: string;
  providerId: string;
}

interface PlaygroundMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface PlaygroundResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  responseTimeMs: number;
  provider: string;
}

// -------------------- Component --------------------

export function PlaygroundPage() {
  const [userProviderId, setUserProviderId] = useState('');
  const [userModelId, setUserModelId] = useState('');
  const providerId = userProviderId || (activeProviders.length > 0 ? activeProviders[0].id : '');
  const modelId = userModelId || (models.length > 0 ? models[0].id : '');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topP, setTopP] = useState(1);
  const [frequencyPenalty, setFrequencyPenalty] = useState(0);
  const [presencePenalty, setPresencePenalty] = useState(0);
  const [jsonMode, setJsonMode] = useState(false);
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [responseInfo, setResponseInfo] = useState<PlaygroundResponse | null>(null);
  const [showParams, setShowParams] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch active providers
  const { data: providersData } = useQuery({
    queryKey: queryKeys.aiProviders.list({ isActive: true }),
    queryFn: () => getApi<PaginatedResponse<AiProvider>>('/api/ai/providers', { isActive: true, pageSize: 100 }),
  });
  const activeProviders = providersData?.data ?? [];

  // Fetch models for selected provider
  const { data: modelsData } = useQuery({
    queryKey: queryKeys.aiModels.list({ providerId: providerId || undefined }),
    queryFn: () => getApi<PaginatedResponse<AiModel>>('/api/ai/models', {
      providerId: providerId || undefined,
      pageSize: 200,
    }),
    enabled: !!providerId,
  });
  const models = modelsData?.data ?? [];

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async () => {
      const userMsg: PlaygroundMessage = { role: 'user', content: inputValue };
      const allMessages = [...messages, userMsg];
      setInputValue('');
      setMessages(allMessages);
      setIsSending(true);
      setResponseInfo(null);
      const res = await postApi<PlaygroundResponse>('/api/ai/playground', {
        providerId,
        modelId,
        messages: allMessages,
        temperature,
        maxTokens,
        topP,
        frequencyPenalty,
        presencePenalty,
        jsonMode,
      });
      return { res, allMessages };
    },
    onSuccess: ({ res, allMessages }) => {
      setMessages([...allMessages, { role: 'assistant', content: res.content }]);
      setResponseInfo(res);
      setIsSending(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to get response');
      setIsSending(false);
    },
  });

  const handleSend = () => {
    if (!inputValue.trim() || isSending || !providerId || !modelId) {
      if (!providerId || !modelId) toast.error('Select a provider and model first');
      return;
    }
    sendMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setResponseInfo(null);
  };

  const handleCopyResponse = () => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) {
      navigator.clipboard.writeText(lastAssistant.content);
      toast.success('Response copied');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_240px] gap-4 h-[calc(100vh-200px)] min-h-[500px]">
      {/* Left Panel: Config */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Configuration
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 pb-4">
            <div className="grid gap-2">
              <Label className="text-xs">Provider</Label>
              <Select value={providerId} onValueChange={setUserProviderId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {activeProviders.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Model</Label>
              <Select value={modelId} onValueChange={setUserModelId}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Parameters</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowParams(!showParams)}>
                  {showParams ? 'Collapse' : 'Expand'}
                </Button>
              </div>
              {showParams && (
                <div className="space-y-3">
                  <div className="grid gap-1">
                    <div className="flex justify-between text-xs"><span>Temperature</span><span className="text-zinc-500">{temperature}</span></div>
                    <Slider min={0} max={2} step={0.1} value={[temperature]} onValueChange={([v]) => setTemperature(v)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs" htmlFor="pg-max-tokens">Max Tokens</Label>
                    <Input id="pg-max-tokens" type="number" className="text-sm h-8" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)} />
                  </div>
                  <div className="grid gap-1">
                    <div className="flex justify-between text-xs"><span>Top P</span><span className="text-zinc-500">{topP}</span></div>
                    <Slider min={0} max={1} step={0.05} value={[topP]} onValueChange={([v]) => setTopP(v)} />
                  </div>
                  <div className="grid gap-1">
                    <div className="flex justify-between text-xs"><span>Frequency Penalty</span><span className="text-zinc-500">{frequencyPenalty}</span></div>
                    <Slider min={0} max={2} step={0.1} value={[frequencyPenalty]} onValueChange={([v]) => setFrequencyPenalty(v)} />
                  </div>
                  <div className="grid gap-1">
                    <div className="flex justify-between text-xs"><span>Presence Penalty</span><span className="text-zinc-500">{presencePenalty}</span></div>
                    <Slider min={0} max={2} step={0.1} value={[presencePenalty]} onValueChange={([v]) => setPresencePenalty(v)} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">JSON Mode</Label>
                    <Switch checked={jsonMode} onCheckedChange={setJsonMode} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </Card>

      {/* Center Panel: Chat */}
      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Play className="h-4 w-4" /> Playground
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCopyResponse} disabled={!messages.some((m) => m.role === 'assistant')}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClear} disabled={messages.length === 0}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Clear
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 && !isSending ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400">
              <Bot className="h-12 w-12 mb-3 text-zinc-300" />
              <p className="text-sm">Send a message to start a conversation</p>
              <p className="text-xs mt-1">Select a provider and model from the left panel</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-zinc-800 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                      {msg.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                    </div>
                    <div className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-900'}`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="bg-zinc-100 rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="resize-none flex-1"
              disabled={isSending}
            />
            <Button
              onClick={handleSend}
              disabled={isSending || !inputValue.trim() || !providerId || !modelId}
              className="self-end"
              size="sm"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>

      {/* Right Panel: Response Info */}
      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Response Info
          </CardTitle>
        </CardHeader>
        <div className="flex-1 p-4 pt-2 space-y-4">
          {responseInfo ? (
            <>
              <InfoItem label="Input Tokens" value={responseInfo.inputTokens.toLocaleString()} />
              <InfoItem label="Output Tokens" value={responseInfo.outputTokens.toLocaleString()} />
              <Separator />
              <InfoItem label="Total Tokens" value={responseInfo.totalTokens.toLocaleString()} />
              <InfoItem label="Cost" value={`$${responseInfo.cost.toFixed(6)}`} />
              <InfoItem label="Response Time" value={`${responseInfo.responseTimeMs}ms`} />
              <InfoItem label="Provider" value={responseInfo.provider} />
            </>
          ) : (
            <div className="text-center text-zinc-400 text-sm mt-8">
              <Zap className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
              <p>No response yet</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
