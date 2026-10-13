'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  CircleHelp,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSupportPanelStore } from '@/lib/stores/support-panel-store';
import { useLocaleStore, useT } from '@/lib/i18n';

// ============================================================
// HELP / SUPPORT FLOATING PANEL WITH AI EXPERT SYSTEM
// ============================================================
// Right-side floating support assistant panel powered by Karmax AI
// and comprehensive platform knowledge base.
// Handles any question about WordPress sync, publishing, SEO,
// AI configuration, subscriptions, media, automations, and more.
// ============================================================

interface SupportSuggestion {
  key: string;
}

const SUGGESTIONS: SupportSuggestion[] = [
  { key: 'support.suggestion1' }, // How do I connect my website?
  { key: 'support.suggestion2' }, // How do I publish an article?
  { key: 'support.suggestion3' }, // How do I configure AI?
  { key: 'support.suggestion4' }, // How do I manage my subscription?
  { key: 'support.suggestion5' }, // How do I connect WordPress?
];

interface SupportMessage {
  id: number;
  from: 'assistant' | 'user';
  text: string;
  source?: 'ai' | 'knowledge-base' | 'fallback';
}

function FormattedMessage({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} className="h-1.5" />;
        }

        // Render inline bold and code snippets
        const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
        const rendered = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-foreground">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={pIdx}
                className="rounded bg-muted-foreground/20 px-1 py-0.5 font-mono text-xs text-foreground"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        });

        const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
        const isStep = /^\d+\.\s/.test(line.trim());

        return (
          <p
            key={idx}
            className={cn(
              isBullet && 'ml-2 list-disc pl-1',
              isStep && 'font-medium text-foreground',
            )}
          >
            {rendered}
          </p>
        );
      })}
    </div>
  );
}

export function SupportPanel() {
  const isOpen = useSupportPanelStore((s) => s.isOpen);
  const closePanel = useSupportPanelStore((s) => s.close);
  const locale = useLocaleStore((s) => s.locale);
  const { t } = useT();

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const now = new Date();
  const timeLabel = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);

  const handleSend = async (rawText?: string) => {
    const query = (rawText ?? input).trim();
    if (!query || isTyping) return;

    setInput('');
    const userMsgId = ++idRef.current;

    const newMessages = [
      ...messages,
      { id: userMsgId, from: 'user' as const, text: query },
    ];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.from,
        content: m.text,
      }));

      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          locale,
        }),
      });

      const json = await res.json();
      const reply = json?.data?.reply || t('support.greeting');
      const source = json?.data?.source;

      setMessages((prev) => [
        ...prev,
        {
          id: ++idRef.current,
          from: 'assistant',
          text: reply,
          source,
        },
      ]);
    } catch (err) {
      console.error('[SupportPanel] Failed to communicate with support AI:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: ++idRef.current,
          from: 'assistant',
          text: t('support.autoReply'),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestion = (question: string) => {
    handleSend(question);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => (!o ? closePanel() : undefined)}>
      <SheetContent
        side="right"
        className="z-[60] flex flex-col gap-0 overflow-hidden p-0 left-3 right-3 top-3 bottom-3 h-auto w-auto rounded-2xl border shadow-xl sm:left-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[460px] sm:max-w-[460px]"
        aria-describedby={undefined}
      >
        {/* ---------- Header ---------- */}
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <div>
                <SheetTitle className="text-base font-semibold leading-none">
                  {t('support.title')}
                </SheetTitle>
                <span className="text-[11px] text-muted-foreground">
                  AI Specialist · Online
                </span>
              </div>
            </div>

            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMessages([])}
                className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                title="Reset conversation"
              >
                <RotateCcw className="h-3 w-3" />
                <span>{locale === 'fr' ? 'Effacer' : locale === 'ar' ? 'مسح' : 'Clear'}</span>
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* ---------- Conversation ---------- */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-5"
          role="log"
          aria-live="polite"
          aria-label={t('support.title')}
        >
          {/* Timestamp divider */}
          <p className="mb-4 text-center text-[11px] font-medium text-muted-foreground">
            {t('support.today')} · {timeLabel}
          </p>

          {/* Default greeting */}
          <div className="flex">
            <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground shadow-xs">
              <FormattedMessage text={t('support.greeting')} />
            </div>
          </div>

          {/* Quick-help suggestions (clickable instant prompts) */}
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label={t('support.suggestionsLabel')}
          >
            {SUGGESTIONS.map(({ key }) => (
              <button
                key={key}
                type="button"
                disabled={isTyping}
                onClick={() => handleSuggestion(t(key))}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-foreground/30 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t(key)}
              </button>
            ))}
          </div>

          {/* Conversation turns */}
          <div className="mt-4 flex flex-col gap-3">
            {messages.map((m) =>
              m.from === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-xs">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex flex-col items-start gap-1">
                  <div className="max-w-[90%] break-words rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed text-foreground shadow-xs">
                    <FormattedMessage text={m.text} />
                  </div>
                </div>
              ),
            )}

            {/* AI Typing indicator */}
            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-md bg-muted px-4 py-3 text-xs text-muted-foreground shadow-xs">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/60" />
                  <span className="ml-1 text-[11px] font-medium text-foreground/80">
                    Karmax AI is writing...
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Footer: Composer ---------- */}
        <div className="border-t border-border px-5 pb-5 pt-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <Input
              data-support-input
              value={input}
              disabled={isTyping}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isTyping ? 'Please wait...' : t('support.inputPlaceholder')}
              className="h-10 flex-1 rounded-full border-border bg-background px-4 text-sm focus-visible:ring-ring focus-visible:ring-offset-0 disabled:opacity-60"
              aria-label={t('support.inputPlaceholder')}
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isTyping}
              aria-label={t('support.send')}
              className={cn(
                'h-10 w-10 shrink-0 rounded-full transition-transform active:scale-95',
                (!input.trim() || isTyping) && 'opacity-50 cursor-not-allowed',
              )}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
